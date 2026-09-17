import assert from "node:assert/strict";
import test from "node:test";
import { defineLanes } from "@v1d/product-spec";
import { emitLanesKotlin } from "../src/core/index.js";

const lanes = defineLanes({
  id: "acme.lanes",
  lanes: {
    pressure: { isolation: "dedicated", ordering: "serial", reason: "A late sample is a late altitude." },
    incident: { isolation: "shared", ordering: "serial", reason: "Receipts, off every hot path." },
  },
  streams: ["stream.pressure"],
  rides: { "stream.pressure": "pressure", "service.incident": "incident", "service.report": "incident", "service.menu": "ui" },
});

const options = {
  packageName: "com.acme.generated",
  symbolPrefix: "Acme",
  sourceFile: "appspec/products/acme/runtime/lanes.ts",
  sourceSha: "test",
  threadNamePrefix: "acme-",
  debugExpression: "com.acme.BuildConfig.DEBUG",
};

test("each lane is built once, dedicated as a named HandlerThread and shared as a named single-thread executor", () => {
  const kotlin = emitLanesKotlin(lanes, options);
  assert.match(kotlin, /val pressure = GeneratedAcmeLane\.Dedicated\("pressure", "acme-pressure"\)/u);
  assert.match(kotlin, /val incident = GeneratedAcmeLane\.Shared\("incident", "acme-incident"\)/u);
  assert.match(kotlin, /val ui = GeneratedAcmeLane\.Ui\(\)/u);
  assert.match(kotlin, /val all: List<GeneratedAcmeLane> = listOf\(pressure, incident, ui\)/u);
  assert.equal(kotlin.split("HandlerThread(threadName).apply { start() }").length - 1, 1, "one HandlerThread construction, in the lane type");
  assert.equal(kotlin.split("Executors.newSingleThreadExecutor").length - 1, 1, "one executor construction, in the lane type");
  assert.match(kotlin, /private val thread: HandlerThread by lazy/u, "nothing starts before a rider uses its lane");
});

test("require() checks the lane only in a debug build, and every lane states its fulfilment", () => {
  const kotlin = emitLanesKotlin(lanes, options);
  assert.match(kotlin, /private val laneChecks: Boolean get\(\) = com\.acme\.BuildConfig\.DEBUG/u);
  assert.equal(kotlin.split("if (laneChecks) check(").length - 1, 3, "dedicated, shared and UI each check under the debug flag");
  assert.match(kotlin, /A late sample is a late altitude\. Rides: stream\.pressure\. android: HandlerThread\(acme-pressure\), fulfilment: full/u);
  assert.match(kotlin, /Rides: service\.incident, service\.report\. android: single-thread executor\(acme-incident\), fulfilment: full/u);
  assert.match(kotlin, /The main looper\. Rides: service\.menu\. android: main looper, fulfilment: full/u);
});

test("lanes that break a law are refused before any Kotlin is written", () => {
  const broken = { ...lanes, rides: { ...lanes.rides, "stream.pressure": "ui" } } as never;
  assert.throws(() => emitLanesKotlin(broken, options), /stream\.pressure rides the UI lane; a stream never does/u);
});
