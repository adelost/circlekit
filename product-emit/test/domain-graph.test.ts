import assert from "node:assert/strict";
import test from "node:test";
import { domainGraphEmitter, domainOf, emitDomainGraph, emitFullGraph } from "../src/core/index.js";
import { fixtureProduct, fixtureTable } from "./capability-fixture.js";

const JSON_PATH = "generated/fixture.product.json";
const graph = () => emitDomainGraph(fixtureProduct, fixtureTable, JSON_PATH);
const owners = [...fixtureProduct.nodes, ...fixtureProduct.components];

test("the domain graph names every domain a node or component belongs to", () => {
  const domains = new Set(owners.map(({ id }) => domainOf(id)));
  assert.deepEqual([...domains].sort(), ["dial", "flight", "sensor", "watchface", "weather"]);
  for (const domain of domains) {
    assert.match(graph(), new RegExp(`^  ${domain}\\["${domain}<br/>`, "mu"), domain);
  }
  assert.match(graph(), /dial\["dial<br\/>1 node, 1 component"\]/u);
});

test("only cross-domain bindings are edges, labelled with the contract that crosses", () => {
  const solid = graph().split("\n").filter((row) => row.includes("-->"));
  assert.deepEqual(solid, [
    '  flight -->|"altitude"| dial',
    '  sensor -->|"observation"| flight',
  ]);
});

test("a domain with no port binding at all is drawn dashed red instead of being left out", () => {
  assert.match(graph(), /^  style weather stroke-dasharray/mu);
  assert.match(graph(), /^  style watchface stroke-dasharray/mu);
  assert.doesNotMatch(graph(), /style (dial|flight|sensor) stroke-dasharray/u);
});

test("a domain wired only inside itself is an island, drawn like any other domain", () => {
  const present = fixtureProduct.nodeTypes[4]!;
  const island = {
    ...fixtureProduct,
    nodeTypes: [...fixtureProduct.nodeTypes, { id: "logbook.present", kind: "present" as const, runtime: present.runtime }],
    nodes: [...fixtureProduct.nodes, { id: "logbook.present", nodeTypeRef: "logbook.present" }],
    components: [...fixtureProduct.components, { id: "logbook.list" }],
    portRegistry: {
      ...fixtureProduct.portRegistry,
      nodePorts: [...fixtureProduct.portRegistry.nodePorts, { ref: "logbook.present.model", ownerId: "logbook.present", contractRef: "logbook.model" }],
      componentPorts: [...fixtureProduct.portRegistry.componentPorts, { ref: "logbook.list.model", ownerId: "logbook.list", contractRef: "logbook.model" }],
      bindings: [...fixtureProduct.portRegistry.bindings, { from: "logbook.present.model", to: "logbook.list.model" }],
    },
  };
  const out = emitDomainGraph(island, fixtureTable, JSON_PATH);
  assert.match(out, /^  logbook\["logbook<br\/>1 node, 1 component"\]$/mu);
  assert.doesNotMatch(out, /style logbook stroke-dasharray/u);
  assert.doesNotMatch(out, /logbook -->/u);
});

test("state read without a port is a dashed edge from the domain that owns it", () => {
  assert.match(graph(), /^  weather -\.->\|"snapshot"\| flight$/mu);
});

test("the header names the product JSON and the capability table as its sources", () => {
  assert.match(graph(), new RegExp(`^%% GENERATED FROM ${JSON_PATH} \\(port bindings\\) and$`, "mu"));
  assert.match(graph(), /^%% fixture\/capabilities\.ts \(STATE_FEEDBACK rows, dashed\)\.$/mu);
});

test("the full graph puts every node and component inside its domain subgraph", () => {
  const full = emitFullGraph(fixtureProduct, JSON_PATH);
  for (const { id } of owners) assert.ok(full.includes(id.replace(".", "_")), id);
  assert.equal((full.match(/^  subgraph /gmu) ?? []).length, 5);
  assert.match(full, /dial_face\(\["face<br\/><i>component<\/i>"\]\)/u);
  assert.match(full, /dial_present\["present<br\/><i>present<\/i>"\]/u);
});

test("the emitter writes both pictures as mermaid artifacts", () => {
  const artifacts = domainGraphEmitter(
    { domains: "generated/fixture.domains.mmd", full: "generated/fixture.graph.mmd", productJsonPath: JSON_PATH },
    fixtureTable,
  ).emit(fixtureProduct as never);
  assert.deepEqual(artifacts.map(({ path, mediaType }) => [path, mediaType]), [
    ["generated/fixture.domains.mmd", "text/vnd.mermaid"],
    ["generated/fixture.graph.mmd", "text/vnd.mermaid"],
  ]);
});

test("a binding onto an unregistered port is an error, not a missing edge", () => {
  const broken = {
    ...fixtureProduct,
    portRegistry: {
      ...fixtureProduct.portRegistry,
      bindings: [...fixtureProduct.portRegistry.bindings, { from: "ghost.out", to: "flight.engine.pressure" }],
    },
  };
  assert.throws(() => emitDomainGraph(broken, fixtureTable, JSON_PATH), /unregistered port/u);
});

test("emission is deterministic", () => {
  assert.equal(graph(), graph());
  assert.equal(emitFullGraph(fixtureProduct, JSON_PATH), emitFullGraph(fixtureProduct, JSON_PATH));
});

test("ordering is by code unit, so two machines with different locales commit the same file", () => {
  const present = fixtureProduct.nodeTypes[4]!;
  const punctuated = {
    ...fixtureProduct,
    nodeTypes: [
      ...fixtureProduct.nodeTypes,
      { id: "flight-detail.x", kind: "present" as const, runtime: present.runtime },
      { id: "flight_log.x", kind: "present" as const, runtime: present.runtime },
    ],
    nodes: [
      ...fixtureProduct.nodes,
      { id: "flight-detail.x", nodeTypeRef: "flight-detail.x" },
      { id: "flight_log.x", nodeTypeRef: "flight_log.x" },
    ],
  };
  const lines = emitDomainGraph(punctuated, fixtureTable, JSON_PATH).split("\n");
  const hyphen = lines.findIndex((line) => line.startsWith('  flight_detail["flight-detail'));
  const underscore = lines.findIndex((line) => line.startsWith('  flight_log["flight_log'));
  assert.ok(hyphen > 0 && underscore > 0);
  // '-' is U+002D and '_' is U+005F; a locale collation may put them the other way round.
  assert.ok(hyphen < underscore, "hyphen sorts before underscore under code-unit order");
});
