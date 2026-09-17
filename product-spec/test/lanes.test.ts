import assert from "node:assert/strict";
import test from "node:test";
import { defineLanes, laneRiders, type LaneRider } from "../src/index.js";

const lanes = {
  pressure: { isolation: "dedicated", ordering: "serial", reason: "a late sample is a late altitude" },
  recording: { isolation: "dedicated", ordering: "serial", reason: "the session's journal, alive when the app is gone" },
  incident: { isolation: "shared", ordering: "serial", reason: "receipts, off every hot path" },
} as const;

const rides = {
  "stream.pressure": "pressure",
  "service.recording": "recording",
  "service.incident": "incident",
  "service.report": "incident",
  "service.menu": "ui",
} as const;

/** A declaration the type system would refuse, handed to the runtime laws as it would arrive from JSON. */
function untyped(overrides: Record<string, unknown>): () => unknown {
  return () => defineLanes({ id: "fixture.lanes", lanes, streams: ["stream.pressure"], rides, ...overrides } as never);
}

test("lanes with one rider per dedicated lane, every stream riding off the UI, are accepted and list their riders", () => {
  const declared = defineLanes({ id: "fixture.lanes", lanes, streams: ["stream.pressure"], rides });
  assert.deepEqual(laneRiders(declared, "incident"), ["service.incident", "service.report"] satisfies LaneRider[]);
  assert.deepEqual(laneRiders(declared, "ui"), ["service.menu"]);
});

test("a stream never rides the UI lane", () => {
  assert.throws(untyped({ rides: { ...rides, "stream.pressure": "ui", "service.pressure-hub": "pressure" } }),
    /stream\.pressure rides the UI lane; a stream never does/u);
});

test("a dedicated lane has exactly one rider", () => {
  assert.throws(untyped({ rides: { ...rides, "service.audio": "pressure" } }),
    /dedicated lane 'pressure' has 2 riders \(stream\.pressure, service\.audio\); it takes exactly one/u);
  const { "service.recording": _dropped, ...withoutRecording } = rides;
  assert.throws(untyped({ rides: withoutRecording }), /dedicated lane 'recording' has 0 riders; it takes exactly one/u);
});

test("every declared stream rides a lane", () => {
  assert.throws(untyped({ streams: ["stream.pressure", "stream.gps"] }), /stream\.gps is declared but rides no lane/u);
});

test("a ride names a declared lane or the UI lane", () => {
  assert.throws(untyped({ rides: { ...rides, "service.report": "uploads" } }), /service\.report rides 'uploads', which is not a declared lane/u);
});

test("a lane says why, uses a known isolation and ordering, and never takes the UI lane's name", () => {
  assert.throws(untyped({ lanes: { ...lanes, incident: { ...lanes.incident, reason: " " } } }), /lane 'incident' exists without saying why/u);
  assert.throws(untyped({ lanes: { ...lanes, incident: { ...lanes.incident, isolation: "pooled" } } }), /isolation 'pooled' is not one of dedicated, shared/u);
  assert.throws(untyped({ lanes: { ...lanes, incident: { ...lanes.incident, ordering: "parallel" } } }), /ordering 'parallel' is not one of serial/u);
  assert.throws(untyped({ lanes: { ...lanes, ui: lanes.incident } }), /lane 'ui' is the platform's UI lane and cannot be declared/u);
  assert.throws(untyped({ rides: { ...rides, "worker.sync": "incident" } }), /rider 'worker\.sync' is not named stream\.<id> or service\.<id>/u);
});

test("every problem is named in one error", () => {
  assert.throws(untyped({ streams: ["stream.pressure", "stream.gps"], rides: { ...rides, "service.audio": "pressure" } }),
    (error: Error) => error.message.includes("stream.gps is declared but rides no lane") && error.message.includes("dedicated lane 'pressure' has 2 riders"));
});
