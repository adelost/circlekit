import {
  configField,
  configInput,
  demandPort,
  service,
  field,
  finiteValueRef,
  port,
  valueRef,
} from "@v1d/product-spec";
import { positionFlightFixContract, serviceDemandContract } from "./location.js";

export const recordingHostCommandContract = {
  id: "recording.host-command",
  kind: "event",
  boundary: "service-internal",
  fields: [
    field("kind", finiteValueRef("recording.command-kind")),
    field("source", finiteValueRef("recording.source"), { nullable: true }),
  ],
} as const;

export const flightCatalogContract = {
  id: "flight.catalog",
  kind: "state",
  boundary: "presentation",
  fields: [field("entries", valueRef("flight.catalog-entries"))],
} as const;

export const recordingSessionPresentationContract = {
  id: "recording.session-presentation",
  kind: "state",
  boundary: "presentation",
  fields: [field("stage", finiteValueRef("recording.stage"))],
} as const;

export const flightHistoryContract = {
  id: "flight.history",
  kind: "state",
  boundary: "presentation",
  fields: [field("entries", valueRef("flight.history-entry-list"))],
} as const;

export const quarantinedReplaysContract = {
  id: "flight.quarantined-replays",
  kind: "state",
  boundary: "presentation",
  fields: [field("count", "integer")],
} as const;

export const flightPathsPresentationContract = {
  id: "flight.paths-presentation",
  kind: "state",
  boundary: "presentation",
  fields: [field("paths", valueRef("flight.path-history"))],
} as const;

export const selectedFlightRequestContract = {
  id: "flight.selected-replay-request",
  kind: "event",
  boundary: "ui-event",
  fields: [field("filename", "string", { nullable: true })],
} as const;

export const selectedFlightPresentationContract = {
  id: "flight.selected-replay-presentation",
  kind: "state",
  boundary: "presentation",
  fields: [
    field("filename", "string", { nullable: true }),
    field("session", valueRef("flight.replay-session"), { nullable: true }),
    field("progress", "number"),
  ],
} as const;

/** App-facing recording owner; synthetic intent handling stays native. */
export const recordingRuntimeOwner = service({
  id: "recording.runtime-owner",
  inputs: [],
  outputs: [port("session", recordingSessionPresentationContract)],
  runtime: {
    stateOwner: "instance",
    lifetime: "process",
    durability: "durable",
    clockDomain: "wall",
    contextInputs: ["flight.synthetic-altitude", "recording.user-intent", "storage.recording-state"],
    effects: ["recording.command-dispatch", "storage.recording-state-read", "storage.recording-state-write"],
  },
});

/** A foreground host plus its ingestion runtime; repositories and codecs remain native details. */
export const foregroundIngestionOwner = service({
  id: "recording.foreground-ingestion-owner",
  inputs: [
    port("position", positionFlightFixContract),
  ],
  outputs: [],
  // The automatic jump algorithm as data: start/stop thresholds, debounces,
  // fail-safe bounds and the armed-stage pre-roll window. Sink thresholds are
  // positive magnitudes ("falling faster than N"); the native binding owns
  // the sign convention. The state machine itself (phases, candidates,
  // debounce mechanics, fall-departure landing) stays native.
  configInputs: [configInput("flightTransitions", [
    configField("climbThresholdMs", "number", { unit: "si.meter-per-second", min: 0 }),
    configField("ascentFloorM", "number", { unit: "si.meter", min: 0 }),
    configField("ascentDebounceMs", "integer", { unit: "si.millisecond", min: 0 }),
    configField("freefallSinkMs", "number", { unit: "si.meter-per-second", positive: true }),
    configField("directFreefallDebounceMs", "integer", { unit: "si.millisecond", min: 0 }),
    configField("ascentCanopyDropM", "number", { unit: "si.meter", min: 0 }),
    configField("canopySinkMs", "number", { unit: "si.meter-per-second", min: 0 }),
    configField("canopyDebounceMs", "integer", { unit: "si.millisecond", min: 0 }),
    configField("landingAltitudeM", "number", { unit: "si.meter", min: 0 }),
    configField("minimumLandingDescentM", "number", { unit: "si.meter", min: 0 }),
    configField("landingVerticalSpeedMs", "number", { unit: "si.meter-per-second", min: 0 }),
    configField("landingGroundSpeedMs", "number", { unit: "si.meter-per-second", min: 0 }),
    configField("landingDebounceMs", "integer", { unit: "si.millisecond", min: 0 }),
    configField("minimumRecordingMs", "integer", { unit: "si.millisecond", min: 0 }),
    configField("ascentStillTimeoutMs", "integer", { unit: "si.millisecond", positive: true }),
    configField("preRollKeepMs", "integer", { unit: "si.millisecond", positive: true }),
    configField("preRollPrependMs", "integer", { unit: "si.millisecond", positive: true }),
  ])],
  runtime: {
    stateOwner: "instance",
    lifetime: "operation",
    durability: "durable",
    clockDomain: "wall",
    contextInputs: [
      "host.foreground-service-command",
      "device.pressure-stream",
      "device.location",
      "clock.monotonic",
      "storage.recording-state",
      "storage.recording-journal",
      "storage.recording-pending",
    ],
    effects: [
      "host.recording-start",
      "host.recording-stop",
      "notification.recording",
      "storage.recording-state-write",
      "storage.recording-journal-write",
      "storage.recording-pending-write",
    ],
  },
});

/** One flight-log owner hides capture, recovery import, ledger and store implementation details. */
export const flightLogOwner = service({
  id: "recording.flight-log-owner",
  inputs: [
    demandPort("demand", serviceDemandContract),
    port("selectReplay", selectedFlightRequestContract),
  ],
  outputs: [
    port("catalog", flightCatalogContract),
    port("history", flightHistoryContract),
    port("quarantined", quarantinedReplaysContract),
    port("paths", flightPathsPresentationContract),
    port("selectedReplay", selectedFlightPresentationContract),
  ],
  runtime: {
    stateOwner: "instance",
    lifetime: "process",
    durability: "durable",
    clockDomain: "wall",
    contextInputs: [
      "flight.phase",
      "location.state",
      "altimeter.state",
      "landing.impact-stream",
      "weather.snapshot",
      "attitude.compass-state",
      "flight.selected-snapshot",
      "recording.session",
      "storage.recording-pending",
      "replay.load-request",
      "storage.flight-replays",
      "storage.flight-index",
      "storage.flight-tombstones",
    ],
    effects: [
      "flight.session-capture",
      "flight.recovery-import",
      "storage.flight-transaction",
      "storage.recording-pending-delete",
      "replay.session-load",
    ],
  },
});
