import assert from "node:assert/strict";
import test from "node:test";
import {
  derive,
  field,
  findIdenticalDuplication,
  findMergeCandidates,
  port,
  present,
  refuseDuplication,
  service,
  effectKind,
  patternFor,
} from "../src/index.js";

const contract = (id: string, fields: ReturnType<typeof field>[] = [], kind = "state", boundary = "presentation") =>
  ({ id, kind, boundary, fields } as const) as never;

const reading = contract("fixture.reading", [field("value", "number")]);
const sameShape = contract("fixture.same-shape", [field("value", "number")]);
const model = contract("fixture.model", [field("label", "string")]);
const event = contract("fixture.tap", [], "event", "ui-event");
const otherEvent = contract("fixture.press", [], "event", "ui-event");

const serviceRuntime = {
  stateOwner: "instance", lifetime: "process", durability: "transient",
  clockDomain: "none", contextInputs: [], effects: ["storage.fixture-write"],
} as const;
const pure = { ...serviceRuntime, effects: [] } as const;

type Finding = { readonly case: string; readonly message: string; readonly site: string };
const messages = (findings: readonly Finding[]) => findings.map(({ message }) => message);
const only = (findings: readonly Finding[], kind: string): Finding[] =>
  findings.filter((finding) => finding.case === kind);

test("D1 refuses two node types that declare the same effects under the same context, by name", () => {
  const shared = { ...serviceRuntime, contextInputs: ["build.distribution"], effects: ["build.read"] } as const;
  const first = service({ id: "fixture.capabilities", inputs: [], outputs: [port("out", reading)], runtime: shared } as const);
  const second = service({ id: "fixture.guard", inputs: [], outputs: [port("out", model)], runtime: shared } as const);
  assert.throws(() => refuseDuplication([first, second]),
    /duplication refused: 2 node types declare the effects build\.read under the same context: fixture\.capabilities, fixture\.guard/);
  // A different context is not the same declaration twice; D2 decides whether they are one shape.
  const elsewhere = service({
    id: "fixture.elsewhere", inputs: [], outputs: [port("out", model)],
    runtime: { ...shared, contextInputs: ["network.connectivity"] },
  } as const);
  assert.deepEqual(findIdenticalDuplication([first, elsewhere]), []);
});

test("D1 refuses two contracts with the same fields, and never two that carry nothing", () => {
  const producer = service({ id: "fixture.producer", inputs: [], outputs: [port("out", reading)], runtime: serviceRuntime } as const);
  const twin = service({
    id: "fixture.twin", inputs: [], outputs: [port("out", sameShape)],
    runtime: { ...serviceRuntime, effects: ["storage.twin-write"] },
  } as const);
  assert.throws(() => refuseDuplication([producer, twin]),
    /2 contracts declare the fields value: fixture\.reading, fixture\.same-shape/);
  // Two payloadless events are two signals, not one contract: the id IS the event.
  const tap = service({ id: "fixture.tap-service", inputs: [port("in", event)], outputs: [port("out", model)], runtime: serviceRuntime } as const);
  const press = service({
    id: "fixture.press-service", inputs: [port("in", otherEvent)], outputs: [port("out", reading)],
    runtime: { ...serviceRuntime, effects: ["storage.press-write"] },
  } as const);
  assert.deepEqual(only(findIdenticalDuplication([tap, press]), "identical-contracts"), []);
});

test("D1 refuses a derive that answers with the contract it was given", () => {
  const passing = derive({ id: "fixture.passing", inputs: [port("in", reading)], outputs: [port("out", reading)], runtime: pure } as const);
  assert.throws(() => refuseDuplication([passing]),
    /derive 'fixture\.passing' answers with the contract it was given, 'fixture\.reading', so it computes nothing/);
});

test("D1 refuses a service that forwards every output straight from its inputs", () => {
  const relaying = service({
    id: "fixture.relay",
    inputs: [port("in", reading), port("also", model)],
    outputs: [port("out", reading)],
    runtime: serviceRuntime,
  } as const);
  assert.throws(() => refuseDuplication([relaying]),
    /service 'fixture\.relay' forwards every output contract straight from its inputs \(fixture\.reading\)/);
});

test("D1 refuses durable state with more than one writer, naming the effect and every writer", () => {
  const durable = { ...serviceRuntime, durability: "durable", effects: ["storage.journal-write"] } as const;
  const one = service({ id: "fixture.writer-a", inputs: [], outputs: [port("out", reading)], runtime: { ...durable, contextInputs: ["a"] } } as const);
  const two = service({ id: "fixture.writer-b", inputs: [], outputs: [port("out", model)], runtime: { ...durable, contextInputs: ["b"] } } as const);
  assert.throws(() => refuseDuplication([one, two]),
    /durable effect 'storage\.journal-write' has 2 writers: fixture\.writer-a, fixture\.writer-b/);
});

test("every D1 refusal names the file and line the declaration was written on", () => {
  const passing = derive({ id: "fixture.sited", inputs: [port("in", reading)], outputs: [port("out", reading)], runtime: pure } as const);
  const [found] = findIdenticalDuplication([passing]);
  assert.match(found!.site, /duplication\.test\.(ts|js):\d+$/);
  assert.match(found!.message, /\[.*duplication\.test\.(ts|js):\d+\]$/);
});

test("D2 warns that services of one shape could be one pattern, and names which", () => {
  const durableStore = {
    stateOwner: "instance", lifetime: "process", durability: "durable",
    clockDomain: "none", contextInputs: [], effects: ["storage.home-write"],
  } as const;
  const home = service({ id: "fixture.home-store", inputs: [], outputs: [port("out", reading)], runtime: durableStore } as const);
  const sites = service({
    id: "fixture.sites-store", inputs: [], outputs: [port("out", model)],
    runtime: { ...durableStore, effects: ["storage.sites-write"] },
  } as const);
  const [warning] = only(findMergeCandidates([home, sites]), "service-shape");
  assert.match(warning!.message,
    /2 services share one shape \(store, durable, process\) and could be store instances: fixture\.home-store, fixture\.sites-store/);
  assert.match(warning!.message, /Answer with a pattern or with distinct: "<why>"/);
});

test("D2 never groups an effect the closed list does not name", () => {
  assert.equal(effectKind("audio.altitude-cues"), "other");
  assert.equal(effectKind("clock.read"), "store");
  assert.equal(effectKind("network.weather-request"), "network");
  assert.equal(effectKind("sensor.pressure-subscription"), "sensor");
  assert.equal(effectKind("ui.navigation"), "ui");
  assert.equal(patternFor(["network", "store"]), "fetchService");
  const audible = {
    stateOwner: "instance", lifetime: "process", durability: "durable",
    clockDomain: "none", contextInputs: [], effects: ["audio.altitude-cues"],
  } as const;
  const one = service({ id: "fixture.audio-a", inputs: [], outputs: [port("out", reading)], runtime: audible } as const);
  const two = service({ id: "fixture.audio-b", inputs: [], outputs: [port("out", model)], runtime: { ...audible, effects: ["audio.warning"] } } as const);
  assert.deepEqual(only(findMergeCandidates([one, two]), "service-shape"), []);
});

test("D2 warns about a present that reshapes nothing, and about two presents of one shape", () => {
  const mirroring = present({ id: "fixture.mirror", inputs: [port("in", model)], outputs: [port("out", model)], runtime: pure } as const);
  assert.deepEqual(only(findIdenticalDuplication([mirroring]), "pass-through"), []);
  assert.match(messages(only(findMergeCandidates([mirroring]), "present-shape")).join(" "),
    /present 'fixture\.mirror' hands on contracts it was given \(fixture\.model\), so it reshapes nothing/);
  const first = present({ id: "fixture.view-a", inputs: [port("in", reading)], outputs: [port("out", model)], runtime: pure } as const);
  const second = present({ id: "fixture.view-b", inputs: [port("in", reading)], outputs: [port("out", model)], runtime: pure } as const);
  assert.match(messages(only(findMergeCandidates([first, second]), "present-shape")).join(" "),
    /2 presents take and give the same contracts, so one of them could serve all: fixture\.view-a, fixture\.view-b/);
});

test("D2 warns about a node type used once that is not named domain logic", () => {
  const once = service({ id: "fixture.only-once", inputs: [], outputs: [port("out", reading)], runtime: serviceRuntime } as const);
  const nodes = [{ id: "fixture.instance", nodeTypeRef: "fixture.only-once", config: {}, bindings: {} }] as never;
  assert.match(messages(only(findMergeCandidates([once], nodes), "one-off")).join(" "),
    /node type 'fixture\.only-once' has one instance and is not named domain logic/);
  const named = { ...once, domain: "the one recording session this product records" } as const;
  assert.deepEqual(only(findMergeCandidates([named], nodes), "one-off"), []);
});

test("D2 warns about a wall of payloadless contracts of one kind", () => {
  const tap = service({ id: "fixture.tap-a", inputs: [port("in", event)], outputs: [port("out", model)], runtime: serviceRuntime } as const);
  const press = service({
    id: "fixture.tap-b", inputs: [port("in", otherEvent)], outputs: [port("out", reading)],
    runtime: { ...serviceRuntime, effects: ["storage.tap-b-write"] },
  } as const);
  assert.match(messages(only(findMergeCandidates([tap, press]), "empty-contracts")).join(" "),
    /2 ui-event event contracts carry no payload at all, so each one is only its own name: fixture\.press, fixture\.tap/);
});

test("a warning is answered where the declaration is: distinct for a shape, domain for a one-off", () => {
  const durableStore = {
    stateOwner: "instance", lifetime: "process", durability: "durable",
    clockDomain: "none", contextInputs: [], effects: ["storage.home-write"],
  } as const;
  const home = service({ id: "fixture.home-store", inputs: [], outputs: [port("out", reading)], runtime: durableStore } as const);
  const sites = service({
    id: "fixture.sites-store", inputs: [], outputs: [port("out", model)],
    runtime: { ...durableStore, effects: ["storage.sites-write"] },
  } as const);
  const answered = { ...sites, distinct: "its writes are ordered against the recording lane" } as const;
  assert.deepEqual(only(findMergeCandidates([home, answered]), "service-shape"), []);
  // A pattern already carries its instances, so the merge has happened and nothing is proposed.
  const carried = { ...sites, pattern: "store" } as const;
  assert.deepEqual(only(findMergeCandidates([home, carried]), "service-shape"), []);
});
