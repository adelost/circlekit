import assert from "node:assert/strict";
import test from "node:test";
import { defineMachine, step, type MachineCell } from "../src/index.js";

/**
 * Skyvw row 171. The reference is Skyvw's recording session stage table, transcribed from
 * jumpcore/src/main/java/com/adelost/jumpcore/recording/RecordingSessionTable.kt: 4 states, 11 inputs, 8 guards,
 * 17 cells, exclusive, and an input with no cell leaves the stage where it is.
 */

const states = ["STOPPED", "ARMED", "BUFFERING", "RECORDING"] as const;
const inputs = [
  "Start", "RecordNow", "AltitudeObserved", "ExitConfirmed", "ExitPromotes", "BufferingDeadline", "RecordingDeadline",
  "GroundObserved", "Rearm", "Stop", "CancelNoJump",
] as const;
const guards = [
  "AUTOMATIC", "EXIT_CONFIRMED", "LEASE_EXPIRED", "ABOVE_GPS_HEIGHT", "ABOVE_RECORDING_HEIGHT", "BUFFERING_DEADLINE_PASSED",
  "RECORDING_DEADLINE_PASSED", "START_NOW",
] as const;
type State = (typeof states)[number];
type Guard = (typeof guards)[number];

const active: readonly State[] = ["ARMED", "BUFFERING", "RECORDING"];

const recording = defineMachine({
  id: "recording.session",
  states,
  initial: "STOPPED",
  inputs,
  guards,
  cells: [
    { id: "stopped.start.armed", from: "STOPPED", on: "Start", to: "ARMED", forbids: ["START_NOW"] },
    { id: "stopped.start.recording", from: "STOPPED", on: "Start", to: "RECORDING", requires: ["START_NOW"] },
    { id: "armed.record-now", from: "ARMED", on: "RecordNow", to: "RECORDING" },
    { id: "buffering.record-now", from: "BUFFERING", on: "RecordNow", to: "RECORDING" },
    {
      id: "armed.altitude.buffering", from: "ARMED", on: "AltitudeObserved", to: "BUFFERING",
      requires: ["AUTOMATIC", "ABOVE_GPS_HEIGHT"], forbids: ["LEASE_EXPIRED", "ABOVE_RECORDING_HEIGHT"],
    },
    {
      id: "armed.altitude.recording", from: "ARMED", on: "AltitudeObserved", to: "RECORDING",
      requires: ["AUTOMATIC", "ABOVE_RECORDING_HEIGHT"], forbids: ["LEASE_EXPIRED"],
    },
    {
      id: "buffering.altitude.recording", from: "BUFFERING", on: "AltitudeObserved", to: "RECORDING",
      requires: ["AUTOMATIC", "ABOVE_RECORDING_HEIGHT"], forbids: ["LEASE_EXPIRED"],
    },
    { id: "armed.exit-promotes", from: "ARMED", on: "ExitPromotes", to: "RECORDING" },
    { id: "buffering.exit-promotes", from: "BUFFERING", on: "ExitPromotes", to: "RECORDING" },
    {
      id: "buffering.deadline", from: "BUFFERING", on: "BufferingDeadline", to: "ARMED",
      requires: ["AUTOMATIC", "BUFFERING_DEADLINE_PASSED"], forbids: ["EXIT_CONFIRMED"],
    },
    { id: "recording.deadline", from: "RECORDING", on: "RecordingDeadline", to: "STOPPED", requires: ["AUTOMATIC", "RECORDING_DEADLINE_PASSED"] },
    ...active.flatMap((from): MachineCell<State, (typeof inputs)[number], Guard>[] => [
      { id: `${from.toLowerCase()}.stop`, from, on: "Stop", to: "STOPPED" },
      { id: `${from.toLowerCase()}.cancel-no-jump`, from, on: "CancelNoJump", to: "STOPPED", requires: ["AUTOMATIC"] },
    ]),
  ],
  updates: [
    { on: "ExitConfirmed", fields: ["exitConfirmed"] },
    { on: "GroundObserved", fields: ["bufferingRearmGroundObserved"] },
    { on: "Rearm", fields: ["bufferingLeaseExpired", "bufferingRearmGroundObserved"] },
  ],
  rests: ["STOPPED", "ARMED"],
  deadlines: ["BufferingDeadline", "RecordingDeadline"],
  ordering: "exclusive",
  otherwise: "stay",
});

const held = (...names: Guard[]): ReadonlySet<Guard> => new Set(names);

/** Every subset of the machine's guards: 256 fact combinations. */
function everyGuardSet(): ReadonlySet<Guard>[] {
  return Array.from({ length: 1 << guards.length }, (_, bits) => new Set(guards.filter((_, index) => (bits >> index) & 1)));
}

test("the recording session holds without loss: 4 states, 11 inputs, 8 guards, 17 cells in declared order", () => {
  assert.equal(recording.states.length, 4);
  assert.equal(recording.inputs.length, 11);
  assert.equal(recording.guards.length, 8);
  assert.equal(recording.cells.length, 17);
  assert.deepEqual(recording.cells.slice(0, 2).map(({ id, requires, forbids }) => [id, requires, forbids]), [
    ["stopped.start.armed", [], ["START_NOW"]],
    ["stopped.start.recording", ["START_NOW"], []],
  ]);
  assert.ok(Object.isFrozen(recording) && Object.isFrozen(recording.cells[0]!.requires));
});

test("step answers as RecordingSessionTable does: start, altitude, exit, deadlines, stop and cancel", () => {
  const cases: [State, (typeof inputs)[number], ReadonlySet<Guard>, State, string | null][] = [
    ["STOPPED", "Start", held("AUTOMATIC"), "ARMED", "stopped.start.armed"],
    ["STOPPED", "Start", held("START_NOW"), "RECORDING", "stopped.start.recording"],
    // Starting an active session is a cell the table does not have, and the stage does not move.
    ["ARMED", "Start", held("START_NOW"), "ARMED", null],
    ["BUFFERING", "RecordNow", held(), "RECORDING", "buffering.record-now"],
    ["ARMED", "AltitudeObserved", held("AUTOMATIC", "ABOVE_GPS_HEIGHT"), "BUFFERING", "armed.altitude.buffering"],
    // Promotion may take both steps in one tick.
    ["ARMED", "AltitudeObserved", held("AUTOMATIC", "ABOVE_GPS_HEIGHT", "ABOVE_RECORDING_HEIGHT"), "RECORDING", "armed.altitude.recording"],
    ["ARMED", "AltitudeObserved", held("AUTOMATIC", "ABOVE_RECORDING_HEIGHT", "LEASE_EXPIRED"), "ARMED", null],
    ["ARMED", "AltitudeObserved", held("ABOVE_RECORDING_HEIGHT"), "ARMED", null],
    // A detector-confirmed exit is the jump, whatever the lease.
    ["BUFFERING", "ExitPromotes", held("LEASE_EXPIRED"), "RECORDING", "buffering.exit-promotes"],
    ["BUFFERING", "BufferingDeadline", held("AUTOMATIC", "BUFFERING_DEADLINE_PASSED"), "ARMED", "buffering.deadline"],
    ["BUFFERING", "BufferingDeadline", held("AUTOMATIC", "BUFFERING_DEADLINE_PASSED", "EXIT_CONFIRMED"), "BUFFERING", null],
    ["RECORDING", "RecordingDeadline", held("AUTOMATIC"), "RECORDING", null],
    ["RECORDING", "RecordingDeadline", held("AUTOMATIC", "RECORDING_DEADLINE_PASSED"), "STOPPED", "recording.deadline"],
    ["BUFFERING", "Stop", held(), "STOPPED", "buffering.stop"],
    ["RECORDING", "CancelNoJump", held(), "RECORDING", null],
    ["RECORDING", "CancelNoJump", held("AUTOMATIC"), "STOPPED", "recording.cancel-no-jump"],
    ["STOPPED", "Stop", held(), "STOPPED", null],
    // RecordingSessionTableTest's ghost: ground observed never moves ARMED.
    ["ARMED", "GroundObserved", held("AUTOMATIC"), "ARMED", null],
  ];
  for (const [from, input, guardsHeld, to, cellId] of cases) {
    assert.deepEqual(step(recording, from, input, guardsHeld), { to, cellId }, `${input} in ${from} with ${[...guardsHeld].join(", ") || "no guards"}`);
  }
});

test("inputs that only update fields never move a stage, under any facts", () => {
  for (const state of states) for (const input of ["ExitConfirmed", "GroundObserved", "Rearm"] as const) for (const guardsHeld of everyGuardSet()) {
    assert.deepEqual(step(recording, state, input, guardsHeld), { to: state, cellId: null });
  }
});

test("every declared cell is the answer for some state and facts, and at most one cell matches any of them", () => {
  const reached = new Set<string>();
  for (const cell of recording.cells) for (const guardsHeld of everyGuardSet()) {
    const matching = recording.cells.filter((candidate) => candidate.from === cell.from && candidate.on === cell.on
      && candidate.requires.every((guard) => guardsHeld.has(guard)) && !candidate.forbids.some((guard) => guardsHeld.has(guard)));
    assert.ok(matching.length <= 1, `${matching.map(({ id }) => id).join(", ")} all match`);
    const { cellId } = step(recording, cell.from, cell.on, guardsHeld);
    if (cellId !== null) reached.add(cellId);
  }
  assert.deepEqual(recording.cells.map(({ id }) => id).filter((id) => !reached.has(id)), []);
});

test("step refuses a state, input or guard the machine does not declare", () => {
  assert.throws(() => step(recording, "LANDED" as never, "Stop", held()), /machine 'recording\.session' has no state 'LANDED'/u);
  assert.throws(() => step(recording, "ARMED", "Pause" as never, held()), /has no input 'Pause'/u);
  assert.throws(() => step(recording, "ARMED", "Stop", new Set(["TYPO"]) as never), /has no guard 'TYPO'/u);
});

/** The recording machine with [change] applied, as a caller that bypasses the types would pass it. */
function refusedWith(change: Record<string, unknown>): () => unknown {
  return () => defineMachine({ ...recording, ...change } as never);
}

test("law 1: a cell or update naming an undeclared state, input or guard is refused by name", () => {
  const cells = [...recording.cells, { id: "armed.pause", from: "ARMED", on: "Pause", to: "PAUSED", requires: ["TIRED"] }];
  assert.throws(refusedWith({ cells }), (error: Error) => {
    assert.match(error.message, /cell armed\.pause goes to 'PAUSED', which is not a declared state/u);
    assert.match(error.message, /cell armed\.pause is on 'Pause', which is not a declared input/u);
    assert.match(error.message, /cell armed\.pause names guard 'TIRED', which is not a declared guard/u);
    return true;
  });
  assert.throws(refusedWith({ updates: [...recording.updates, { on: "Snooze", fields: ["x"] }] }), /update on 'Snooze' names an input that is not declared/u);
});

test("law 2: with exclusive, two cells for one state and input that no guard tells apart are refused", () => {
  const cells = recording.cells.map((cell) => cell.id === "stopped.start.armed" ? { ...cell, forbids: [] } : cell);
  assert.throws(refusedWith({ cells }),
    /cells stopped\.start\.armed and stopped\.start\.recording both take Start in STOPPED and no guard one requires is one the other forbids/u);
});

test("law 3: with first-match the declared order decides, and a cell an earlier one always wins over is refused", () => {
  // Automatic starts arm, a start-now records: both hold for an automatic start-now, and nothing tells the cells apart.
  const cells = recording.cells.map((cell) => cell.id === "stopped.start.armed" ? { ...cell, requires: ["AUTOMATIC"], forbids: [] } : cell);
  assert.throws(refusedWith({ cells }), /cells stopped\.start\.armed and stopped\.start\.recording both take Start in STOPPED/u);
  const armedFirst = defineMachine({ ...recording, cells, ordering: "first-match" } as never) as typeof recording;
  assert.deepEqual(step(armedFirst, "STOPPED", "Start", held("AUTOMATIC", "START_NOW")), { to: "ARMED", cellId: "stopped.start.armed" });
  assert.deepEqual(step(armedFirst, "STOPPED", "Start", held("START_NOW")), { to: "RECORDING", cellId: "stopped.start.recording" });
  const recordingFirst = defineMachine({ ...recording, cells: [cells[1]!, cells[0]!, ...cells.slice(2)], ordering: "first-match" } as never) as typeof recording;
  assert.deepEqual(step(recordingFirst, "STOPPED", "Start", held("AUTOMATIC", "START_NOW")), { to: "RECORDING", cellId: "stopped.start.recording" });
  const never = { id: "stopped.start.never", from: "STOPPED", on: "Start", to: "RECORDING", requires: ["AUTOMATIC", "START_NOW"], forbids: [] };
  assert.throws(refusedWith({ cells: [cells[0]!, never, ...cells.slice(1)], ordering: "first-match" }),
    /cell stopped\.start\.never can never match: with ordering first-match the declared order decides, and stopped\.start\.armed comes first and matches whenever stopped\.start\.never does/u);
});

test("law 4: a state no cell reaches from the initial state is refused", () => {
  const cells = recording.cells.filter(({ to }) => to !== "BUFFERING");
  assert.throws(refusedWith({ cells }), /no cell reaches BUFFERING from STOPPED/u);
});

test("law 5: a function anywhere in the declaration is refused with where it sits", () => {
  const cells = recording.cells.map((cell, index) => index === 4 ? { ...cell, requires: [() => true] } : cell);
  assert.throws(refusedWith({ cells }), /the declaration\.cells\[4\]\.requires\[0\] is a function; guards are names and facts are supplied by the caller/u);
});

test("law 6: an input on no cell or update is refused until it is listed under ignored", () => {
  const withNap = { inputs: [...recording.inputs, "Nap"] };
  assert.throws(refusedWith(withNap), /input Nap is on no cell or update and not listed under ignored/u);
  const napping = defineMachine({ ...recording, ...withNap, ignored: ["Nap"] } as never) as typeof recording;
  assert.deepEqual(step(napping, "RECORDING", "Nap" as never, held()), { to: "RECORDING", cellId: null });
});

test("law 7: a state that is not a rest and that no deadline leaves is refused by name", () => {
  // Row 122: the phase froze in a state nothing could leave, and nothing in the form had to say so.
  assert.throws(refusedWith({ rests: ["STOPPED"] }),
    /state ARMED is not a rest and no deadline input leaves it; list it under rests or give it a cell on one of BufferingDeadline, RecordingDeadline/u);
});

test("law 7: a deadline cell that goes back where it came from is not a way out", () => {
  const looping = recording.cells.map((cell) => cell.id === "buffering.deadline" ? { ...cell, to: "BUFFERING" } : cell);
  assert.throws(refusedWith({ cells: looping }), /state BUFFERING is not a rest and no deadline input leaves it/u);
});

test("law 7: a rest that is not a state, and a deadline that is not an input, are refused by name", () => {
  assert.throws(refusedWith({ rests: ["STOPPED", "ARMED", "LANDED"] }), /rest 'LANDED' is not a declared state/u);
  assert.throws(refusedWith({ deadlines: ["BufferingDeadline", "Sunset"] }), /deadline 'Sunset' is not a declared input/u);
});

test("law 7: no deadlines at all is legal when every state is a rest, and names the first state that is not", () => {
  const resting = defineMachine({ ...recording, deadlines: [], rests: states } as never) as typeof recording;
  assert.deepEqual([...resting.deadlines], []);
  assert.throws(refusedWith({ deadlines: [], rests: ["STOPPED", "ARMED", "RECORDING"] }),
    /state BUFFERING is not a rest and no deadline input leaves it; list it under rests or give it a cell on a deadline input/u);
});

test("otherwise refuse turns an input with no matching cell into an error, and an update still only stays", () => {
  const strict = defineMachine({ ...recording, otherwise: "refuse" } as never) as typeof recording;
  assert.throws(() => step(strict, "ARMED", "Start", held("START_NOW")),
    /machine 'recording\.session' refuses Start in ARMED: no cell matches the guards held \(START_NOW\)/u);
  assert.deepEqual(step(strict, "ARMED", "GroundObserved", held()), { to: "ARMED", cellId: null });
});
