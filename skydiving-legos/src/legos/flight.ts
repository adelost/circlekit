import {
  configField,
  configInput,
  contextPort,
  demandPort,
  derive,
  service,
  field,
  finiteValueRef,
  port,
  valueRef,
} from "@v1d/product-spec";
import { flightLocationStateContract, serviceDemandContract } from "./location.js";
import { compassStateContract } from "./attitude.js";
import { weatherDemandContract, weatherPriorityContextContract } from "./weather.js";

export const flightAltimeterStateContract = {
  id: "flight.altimeter-state",
  kind: "state",
  boundary: "service-internal",
  fields: [
    field("hasFix", "boolean"),
    field("relativeAltitudeM", "number", { unit: "si.meter" }),
    field("displayAltitudeM", "number", { unit: "si.meter" }),
    field("rawAltitudeM", "number", { unit: "si.meter" }),
    field("verticalSpeedMs", "number", { unit: "si.meter-per-second" }),
    field("safetyVerticalSpeedMs", "number", { unit: "si.meter-per-second" }),
    field("trend", finiteValueRef("flight.altitude-trend")),
    field("pressureHpa", "number", { unit: "si.hectopascal", nullable: true }),
    field("staleSensor", "boolean"),
  ],
} as const;

export const flightPressureHistoryContract = {
  id: "flight.pressure-history",
  kind: "snapshot",
  boundary: "presentation",
  fields: [field("samples", valueRef("pressure.history-samples"))],
} as const;

export const altitudeReferenceStatusContract = {
  id: "flight.altitude-reference-status",
  kind: "state",
  boundary: "presentation",
  fields: [field("status", valueRef("pressure.altitude-reference"))],
} as const;

export const autoGroundReferenceModeContract = {
  id: "flight.auto-ground-reference-mode",
  kind: "state",
  boundary: "service-internal",
  fields: [field("mode", finiteValueRef("flight.auto-ground-reference-mode"))],
} as const;

export const autoGroundModePresentationContract = {
  id: "flight.auto-ground-mode-presentation",
  kind: "state",
  boundary: "presentation",
  fields: [field("mode", finiteValueRef("flight.auto-ground-reference-mode"))],
} as const;

export const autoGroundModePresentationDerivation = derive({
  id: "flight.auto-ground-mode-presentation-derivation",
  inputs: [port("mode", autoGroundReferenceModeContract)],
  outputs: [port("state", autoGroundModePresentationContract)],
  runtime: {
    stateOwner: "none", lifetime: "call", durability: "transient", clockDomain: "none",
    contextInputs: [], effects: [],
  },
});

export const altitudeReferenceActionContract = {
  id: "flight.altitude-reference-action",
  kind: "event",
  boundary: "ui-event",
  fields: [field("action", finiteValueRef("flight.altitude-reference-action"))],
} as const;

export const flightImpactSampleContract = {
  id: "flight.impact-sample",
  kind: "event",
  boundary: "service-internal",
  fields: [
    field("timeEpochMs", "integer", { unit: "si.millisecond", clockDomain: "wall" }),
    field("altitudeM", "number", { unit: "si.meter" }),
    field("sinkSpeedMs", "number", { unit: "si.meter-per-second" }),
  ],
} as const;

export const flightPhaseStateContract = {
  id: "flight.phase-state",
  kind: "state",
  boundary: "service-internal",
  fields: [field("phase", finiteValueRef("flight.phase"))],
} as const;

/** UI projection of the safety phase; the detector's internal state remains
 * available to alarm, recording and audio services without crossing the
 * presentation boundary. */
export const flightPhasePresentationContract = {
  id: "flight.phase-presentation",
  kind: "state",
  boundary: "presentation",
  fields: [field("phase", finiteValueRef("flight.phase"))],
} as const;

export const flightPhasePresentationDerivation = derive({
  id: "flight.phase-presentation-derivation",
  inputs: [port("phase", flightPhaseStateContract)],
  outputs: [port("state", flightPhasePresentationContract)],
  runtime: {
    stateOwner: "none", lifetime: "call", durability: "transient", clockDomain: "none",
    contextInputs: [], effects: [],
  },
});

/** Selected native flight feed needed by the live spatial renderer. */
export const flightLiveSpatialContract = {
  id: "flight.live-spatial",
  kind: "snapshot",
  boundary: "presentation",
  fields: [field("paths", valueRef("flight.path-history"))],
} as const;

export const flightJumpEventContract = {
  id: "flight.jump-event",
  kind: "event",
  boundary: "service-internal",
  fields: [field("flightId", "string")],
} as const;

const transient = { durability: "transient", clockDomain: "none" } as const;

/** One native SensorCoordinator owns both high-rate sensor pipelines. */
export const instrumentRuntimeOwner = service({
  id: "flight.instrument-runtime",
  inputs: [demandPort("demand", serviceDemandContract)],
  outputs: [
    port("compassState", compassStateContract),
    port("altimeterState", flightAltimeterStateContract),
    port("pressureHistory", flightPressureHistoryContract),
    port("impact", flightImpactSampleContract),
  ],
  configInputs: [
    configInput("pressureAcquisition"),
    configInput("attitudeAcquisition"),
    configInput("autoZeroPolicy", [
      configField("stablePressureAltitudeSpreadM", "number", { unit: "si.meter", min: 0 }),
      configField("startupWindowMs", "integer", { unit: "si.millisecond", positive: true }),
      configField("unverifiedStartWindowMs", "integer", {
        unit: "si.millisecond", gteField: "startupWindowMs",
      }),
      configField("airborneAmbiguousOffsetM", "number", { unit: "si.meter", min: 0 }),
      configField("expireAfterAppInactivityMs", "integer", { unit: "si.millisecond", min: 0 }),
      configField("minimumCorrectionM", "number", { unit: "si.meter", min: 0 }),
      configField("takeoffAltitudeM", "number", { unit: "si.meter", min: 0 }),
      configField("takeoffVerticalSpeedMs", "number", { unit: "si.meter-per-second", min: 0 }),
      configField("takeoffDebounceMs", "integer", { unit: "si.millisecond", min: 0 }),
    ]),
  ],
  runtime: {
    stateOwner: "instance", lifetime: "process", durability: "transient", clockDomain: "monotonic",
    contextInputs: [
      "device.pressure-sensor",
      "debug.pressure-control",
      "device.rotation-vector-sensor",
      "device.display-rotation",
      "lifecycle.process",
      "flight.input-mode",
      "altimeter.reference-calibration",
    ],
    effects: ["sensor.pressure-subscription", "sensor.attitude-subscription"],
  },
});

/** Owns calibration/reference state; capture math and persistence stay native. */
export const flightAltitudeReferenceOwner = service({
  id: "flight.altitude-reference-owner",
  inputs: [port("action", altitudeReferenceActionContract)],
  outputs: [
    port("status", altitudeReferenceStatusContract),
    port("autoGroundMode", autoGroundReferenceModeContract),
  ],
  runtime: {
    stateOwner: "instance", lifetime: "process", durability: "durable", clockDomain: "wall",
    contextInputs: ["flight.altimeter-state", "weather.briefing", "location.home"],
    effects: ["altimeter.reference-calibration", "storage.altitude-reference"],
  },
});

/** Phase detection plus alarm/vario policy; the HUD snapshot seam stays native until typed UI wiring lands. */
export const flightRuntimeOwner = service({
  id: "flight.runtime-owner",
  inputs: [
    port("state", flightAltimeterStateContract),
    port("position", flightLocationStateContract),
  ],
  outputs: [
    port("phase", flightPhaseStateContract),
    port("liveSpatial", flightLiveSpatialContract),
    demandPort("weatherDemand", weatherDemandContract),
    contextPort("weatherPriorityContext", weatherPriorityContextContract),
  ],
  runtime: {
    stateOwner: "instance", lifetime: "process", durability: "transient", clockDomain: "wall",
    contextInputs: ["simulation.flight-feed"],
    effects: ["alarm.altitude-ladder", "cue.vario-policy", "presentation.flight-snapshot"],
  },
});

/** Jump lifecycle owner: logging, grading and sync; detection math stays native. */
export const flightCoordinatorOwner = service({
  id: "flight.coordinator-owner",
  inputs: [
    port("phase", flightPhaseStateContract),
    port("state", flightAltimeterStateContract),
    port("impact", flightImpactSampleContract),
    port("position", flightLocationStateContract),
    port("compass", compassStateContract),
  ],
  outputs: [port("jumpEvent", flightJumpEventContract)],
  runtime: {
    stateOwner: "instance", lifetime: "process", durability: "durable", clockDomain: "wall",
    contextInputs: [
      "location.engine-state",
      "weather.wind-layers",
      "flight.jump-context",
    ],
    effects: ["flight.jump-log-write", "presentation.complication-refresh"],
  },
});

/** Altitude audio cues gated by phase; playback and mixing stay native. */
export const flightAudioCue = service({
  id: "flight.audio-cue",
  inputs: [port("phase", flightPhaseStateContract)],
  outputs: [],
  runtime: {
    stateOwner: "instance", lifetime: "process", ...transient,
    contextInputs: ["settings.audio-cues"],
    effects: ["audio.altitude-cues", "vario.reset"],
  },
});
