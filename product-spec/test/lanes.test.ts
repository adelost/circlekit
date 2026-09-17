import assert from "node:assert/strict";
import test from "node:test";
import { defineLanes, laneRideEdges, laneRiders, lanesIr } from "../src/index.js";

const lanes = {
  pressure: { isolation: "dedicated", owner: "pressure-hub", lifetime: "process", ordering: "serial", reason: "a late sample is a late altitude" },
  recording: { isolation: "dedicated", owner: "recording-service", lifetime: "owner", ordering: "serial", reason: "the session's journal" },
  incident: { isolation: "shared", lifetime: "process", ordering: "serial", reason: "receipts, off every hot path" },
} as const;

const rides = {
  "stream.pressure": { lane: "pressure", owner: "pressure-hub" },
  "service.pressure-processing": { lane: "pressure", owner: "pressure-hub" },
  "service.recording": { lane: "recording", owner: "recording-service" },
  "service.incident": "incident",
  "service.report": "incident",
  "service.menu": "ui",
} as const;

/** A declaration the type system would refuse, handed to the runtime laws as it would arrive from JSON. */
function untyped(overrides: Record<string, unknown>): () => unknown {
  return () => defineLanes({ id: "fixture.lanes", lanes, streams: ["stream.pressure"], rides, ...overrides } as never);
}

test("an owner's intake and processing share its lane, unrelated riders share a shared lane, and the rides read as edges", () => {
  const declared = defineLanes({ id: "fixture.lanes", lanes, streams: ["stream.pressure"], rides });
  assert.deepEqual(laneRiders(declared, "pressure"), ["stream.pressure", "service.pressure-processing"]);
  assert.deepEqual(laneRiders(declared, "incident"), ["service.incident", "service.report"]);
  assert.deepEqual(laneRideEdges(declared).slice(0, 1), [{ from: "stream.pressure", to: "pressure", owner: "pressure-hub" }]);
  assert.equal(lanesIr(declared).lanes?.rides.length, 6);
  assert.deepEqual(lanesIr(undefined), {});
});

test("a stream never rides the UI lane", () => {
  assert.throws(untyped({ streams: [], rides: { ...rides, "stream.pressure": "ui" } }), /stream\.pressure rides the UI lane; a stream never does/u);
});

test("unrelated work may not ride a dedicated lane, and a dedicated lane has a rider", () => {
  assert.throws(untyped({ rides: { ...rides, "service.audio": { lane: "pressure", owner: "audio-player" } } }),
    /service\.audio works for 'audio-player' and may not ride 'pressure', which belongs to 'pressure-hub'/u);
  assert.throws(untyped({ rides: { ...rides, "service.audio": "pressure" } }),
    /service\.audio rides dedicated lane 'pressure' without naming its owner 'pressure-hub'/u);
  const { "service.recording": _dropped, ...withoutRecording } = rides;
  assert.throws(untyped({ rides: withoutRecording }), /dedicated lane 'recording' has no rider/u);
});

test("only a dedicated lane lives and dies with its owner; a shared lane lives for the process and has no owner", () => {
  assert.throws(untyped({ lanes: { ...lanes, incident: { ...lanes.incident, lifetime: "owner" } } }),
    /shared lane 'incident' has no owner instance to live and die with; its lifetime is the process/u);
  assert.throws(untyped({ rides: { ...rides, "service.report": { lane: "incident", owner: "reporter" } } }),
    /service\.report names owner 'reporter' on shared lane 'incident', which has no owner/u);
});

test("every declared stream rides a lane", () => {
  assert.throws(untyped({ streams: ["stream.pressure", "stream.gps"] }), /stream\.gps is declared but rides no lane/u);
});

test("a ride names a declared lane or the UI lane", () => {
  assert.throws(untyped({ rides: { ...rides, "service.report": "uploads" } }), /service\.report rides 'uploads', which is not a declared lane/u);
});

test("a lane says why, uses known isolation, ordering and lifetime, names its owner when dedicated, and never takes the UI lane's name", () => {
  assert.throws(untyped({ lanes: { ...lanes, incident: { ...lanes.incident, reason: " " } } }), /lane 'incident' exists without saying why/u);
  assert.throws(untyped({ lanes: { ...lanes, incident: { ...lanes.incident, isolation: "pooled" } } }), /isolation 'pooled' is not one of dedicated, shared/u);
  assert.throws(untyped({ lanes: { ...lanes, incident: { ...lanes.incident, ordering: "parallel" } } }), /ordering 'parallel' is not one of serial/u);
  assert.throws(untyped({ lanes: { ...lanes, incident: { ...lanes.incident, lifetime: "forever" } } }), /lifetime 'forever' is not one of process, owner/u);
  assert.throws(untyped({ lanes: { ...lanes, pressure: { ...lanes.pressure, owner: "" } } }), /dedicated lane 'pressure' names no owner/u);
  assert.throws(untyped({ lanes: { ...lanes, ui: lanes.incident } }), /lane 'ui' is the platform's UI lane and cannot be declared/u);
  assert.throws(untyped({ rides: { ...rides, "worker.sync": "incident" } }), /rider 'worker\.sync' is not named stream\.<id> or service\.<id>/u);
});

test("every problem is named in one error", () => {
  assert.throws(untyped({ streams: ["stream.pressure", "stream.gps"], rides: { ...rides, "service.audio": "pressure" } }),
    (error: Error) => error.message.includes("stream.gps is declared but rides no lane") && error.message.includes("without naming its owner"));
});
