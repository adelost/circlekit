import assert from "node:assert/strict";
import test from "node:test";
import { defineLanes, lanesIr } from "@v1d/product-spec";
import { emitFullGraph, emitLanesKotlin } from "../src/core/index.js";

const lanes = defineLanes({
  id: "acme.lanes",
  lanes: {
    pressure: { isolation: "dedicated", owner: "pressure-hub", lifetime: "process", ordering: "serial", reason: "A late sample is a late altitude." },
    recording: { isolation: "dedicated", owner: "recording-service", lifetime: "owner", ordering: "serial", reason: "The session journal." },
    incident: { isolation: "shared", lifetime: "process", ordering: "serial", reason: "Receipts, off every hot path." },
  },
  streams: ["stream.pressure"],
  rides: {
    "stream.pressure": { lane: "pressure", owner: "pressure-hub" },
    "service.recording": { lane: "recording", owner: "recording-service" },
    "service.incident": "incident",
    "service.report": "incident",
    "service.menu": "ui",
  },
});

const options = {
  packageName: "com.acme.generated",
  symbolPrefix: "Acme",
  sourceFile: "appspec/products/acme/runtime/lanes.ts",
  sourceSha: "test",
  threadNamePrefix: "acme-",
  debugExpression: "com.acme.BuildConfig.DEBUG",
};

test("process lanes are built once, owner lanes are opened by their owner, and each kind is constructed in one place", () => {
  const kotlin = emitLanesKotlin(lanes, options);
  assert.match(kotlin, /val pressure = GeneratedAcmeLane\.Dedicated\("pressure", "acme-pressure", closable = false\)/u);
  assert.match(kotlin, /fun openRecording\(\): GeneratedAcmeLane\.Dedicated = GeneratedAcmeLane\.Dedicated\("recording", "acme-recording", closable = true\)/u);
  assert.match(kotlin, /val incident = GeneratedAcmeLane\.Shared\("incident", "acme-incident"\)/u);
  assert.match(kotlin, /val all: List<GeneratedAcmeLane> = listOf\(pressure, incident, ui\)/u);
  assert.equal(kotlin.split("HandlerThread(threadName).apply { start() }").length - 1, 1, "one HandlerThread construction, in the lane type");
  assert.equal(kotlin.split("Executors.newSingleThreadExecutor").length - 1, 1, "one executor construction, in the lane type");
  assert.match(kotlin, /check\(closable\) \{ "\$name lane lives for the process and is never closed" \}/u);
});

test("require() checks the lane only in a debug build, and every lane states its fulfilment", () => {
  const kotlin = emitLanesKotlin(lanes, options);
  assert.match(kotlin, /private val laneChecks: Boolean get\(\) = com\.acme\.BuildConfig\.DEBUG/u);
  assert.equal(kotlin.split("if (laneChecks) check(").length - 1, 3, "dedicated, shared and UI each check under the debug flag");
  assert.match(kotlin, /internal enum class GeneratedAcmeLaneFulfilment \{ FULL, DEGRADED, UNSUPPORTED \}/u);
  assert.match(kotlin, /"pressure: dedicated serial -> HandlerThread\(acme-pressure\), fulfilment full",\n {8}"recording: dedicated serial -> HandlerThread\(acme-recording\), fulfilment full",\n {8}"incident: shared serial -> single-thread executor\(acme-incident\), fulfilment full",/u);
  assert.match(kotlin, /A late sample is a late altitude\. Owner: pressure-hub\. Rides: stream\.pressure\./u);
});

test("lanes that break a law are refused before any Kotlin is written", () => {
  const broken = { ...lanes, rides: { ...lanes.rides, "service.audio": { lane: "pressure", owner: "audio-player" } } } as never;
  assert.throws(() => emitLanesKotlin(broken, options), /service\.audio works for 'audio-player' and may not ride 'pressure'/u);
});

test("the product graph draws each lane as a subgraph with its riders inside", () => {
  const graph = emitFullGraph({
    nodeTypes: [], nodes: [], components: [],
    portRegistry: { nodePorts: [], componentPorts: [], bindings: [] },
    ...lanesIr(lanes),
  }, "out/product.json");
  assert.match(graph, /subgraph lane_pressure\["pressure lane<br\/><i>dedicated serial, owner pressure-hub, lives for the process<\/i>"\]\n {4}lane_pressure__stream_pressure\["stream\.pressure"\]\n {2}end/u);
  assert.match(graph, /subgraph lane_recording\["recording lane<br\/><i>dedicated serial, owner recording-service, lives with its owner<\/i>"\]/u);
  assert.match(graph, /subgraph lane_incident\["incident lane<br\/><i>shared serial, lives for the process<\/i>"\]\n {4}lane_incident__service_incident\["service\.incident"\]\n {4}lane_incident__service_report\["service\.report"\]\n {2}end/u);
  assert.match(graph, /subgraph lane_ui\["ui lane<br\/><i>the platform's main thread<\/i>"\]\n {4}lane_ui__service_menu\["service\.menu"\]/u);
});
