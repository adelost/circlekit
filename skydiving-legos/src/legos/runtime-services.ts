import {
  field,
  finiteValueRef,
  port,
  service,
  valueRef,
} from "@v1d/product-spec";
import { flightPhaseStateContract } from "./flight.js";
import { wallClockPresentationContract } from "./clock.js";
export { wallClockPresentationContract } from "./clock.js";

export const batteryObservationContract = {
  id: "runtime.battery-observation",
  kind: "observation",
  boundary: "service-internal",
  fields: [
    field("timeEpochMs", "integer", { unit: "si.millisecond", clockDomain: "wall" }),
    field("elapsedRealtimeNanos", "integer", { unit: "si.nanosecond", clockDomain: "monotonic" }),
    field("percentage", "integer", { unit: "percent", nullable: true }),
    field("charging", "boolean", { nullable: true }),
    field("provider", finiteValueRef("runtime.battery-provider")),
  ],
} as const;

export const runtimeIncidentContract = {
  id: "runtime.incident",
  kind: "event",
  boundary: "service-internal",
  fields: [
    field("kind", finiteValueRef("runtime.incident-kind")),
    field("occurredAtEpochMs", "integer", { unit: "si.millisecond", clockDomain: "wall" }),
    field("component", "string"),
    field("exceptionType", "string"),
    field("message", "string"),
    field("surface", "string"),
  ],
} as const;

export const fetchRequestContract = {
  id: "runtime.fetch-request",
  kind: "event",
  boundary: "service-internal",
  fields: [field("source", finiteValueRef("runtime.fetch-source"))],
} as const;

export const spatialRefreshContract = {
  id: "runtime.spatial-refresh",
  kind: "event",
  boundary: "ui-event",
  fields: [],
} as const;

export const statusRefreshContract = {
  id: "runtime.status-refresh",
  kind: "event",
  boundary: "ui-event",
  fields: [field("source", finiteValueRef("runtime.status-refresh-source"))],
} as const;

const transient = { durability: "transient", clockDomain: "none" } as const;

export const buildCapabilitiesContract = {
  id: "runtime.build-capabilities",
  kind: "snapshot",
  boundary: "presentation",
  fields: [
    field("developerSectionVisible", "boolean"),
    field("debugDataAvailable", "boolean"),
  ],
} as const;

export const batteryPresentationContract = {
  id: "runtime.battery-presentation",
  kind: "state",
  boundary: "presentation",
  fields: [field("state", valueRef("runtime.battery-state"))],
} as const;

export const fetchStatusPresentationContract = {
  id: "runtime.fetch-status-presentation",
  kind: "state",
  boundary: "presentation",
  fields: [field("sources", valueRef("runtime.fetch-source-statuses"))],
} as const;

export const networkProbePresentationContract = {
  id: "runtime.network-probe-presentation",
  kind: "state",
  boundary: "presentation",
  fields: [field("results", valueRef("runtime.network-probe-result-list"))],
} as const;

export const buildCapabilitiesSource = service({
  id: "runtime.build-capabilities-source",
  inputs: [],
  outputs: [port("presentation", buildCapabilitiesContract)],
  runtime: {
    stateOwner: "none", lifetime: "process", ...transient,
    contextInputs: ["build.distribution"], effects: ["build.distribution-read"],
  },
});

/** Platform battery reads; manager access stays native. */
export const batteryObservationSource = service({
  id: "runtime.battery-source",
  inputs: [],
  outputs: [port("observation", batteryObservationContract)],
  runtime: {
    stateOwner: "none", lifetime: "call", durability: "transient", clockDomain: "wall",
    contextInputs: ["device.battery-manager"], effects: ["device.battery-read"],
  },
});

/** Drain estimation and persistence; the HUD state seam stays native until typed UI wiring lands. */
export const batteryRuntimeOwner = service({
  id: "runtime.battery-runtime",
  inputs: [],
  outputs: [port("presentation", batteryPresentationContract)],
  runtime: {
    stateOwner: "instance", lifetime: "process", durability: "durable", clockDomain: "wall",
    contextInputs: ["device.battery-manager", "storage.battery-history"],
    effects: ["presentation.battery-state", "storage.battery-history-write"],
  },
});

export const wallClockSource = service({
  id: "runtime.wall-clock-source",
  inputs: [],
  outputs: [port("presentation", wallClockPresentationContract)],
  runtime: {
    stateOwner: "instance", lifetime: "process", durability: "transient", clockDomain: "wall",
    contextInputs: ["platform.wall-clock"], effects: ["clock.read"],
  },
});

/** Wraps every registered runtime service run; retry policy stays native. */
export const runtimeSupervisor = service({
  id: "runtime.supervisor",
  inputs: [],
  outputs: [port("incident", runtimeIncidentContract)],
  runtime: {
    stateOwner: "none", lifetime: "call", ...transient,
    contextInputs: ["runtime.service-execution"], effects: ["runtime.execution-observe"],
  },
});

/** Privacy-safe incident receipts: ledger plus user-driven share. */
export const diagnosticsReporter = service({
  id: "runtime.diagnostics-reporter",
  inputs: [],
  outputs: [port("networkProbes", networkProbePresentationContract)],
  runtime: {
    stateOwner: "external", lifetime: "process", durability: "durable", clockDomain: "wall",
    contextInputs: ["runtime.service-execution", "device.share-transport"],
    effects: ["diagnostics.incident-ledger-write", "diagnostics.report-share"],
  },
});

/** Decides when the product fetches; scheduling math stays native. */
export const fetchPolicyOwner = service({
  id: "runtime.fetch-policy",
  inputs: [
    port("phase", flightPhaseStateContract),
    port("manual", statusRefreshContract),
  ],
  outputs: [port("status", fetchStatusPresentationContract)],
  runtime: {
    stateOwner: "instance", lifetime: "process", ...transient,
    contextInputs: ["location.engine-state", "simulation.state", "settings.power"],
    effects: [
      "weather.briefing-fetch",
      "cloud.sync-fetch",
      "map.object-fetch",
      "map.tile-fetch",
      "airport.pressure-fetch",
      "aircraft.fetch",
    ],
  },
});

/** Executes fetches per source; transports and caches stay native. */
export const fetchDispatch = service({
  id: "runtime.fetch-dispatch",
  inputs: [
    port("atmosSceneRefresh", spatialRefreshContract),
    port("atmosControlsRefresh", spatialRefreshContract),
    port("cloudSceneRefresh", spatialRefreshContract),
    port("cloudControlsRefresh", spatialRefreshContract),
  ],
  outputs: [],
  runtime: {
    stateOwner: "external", lifetime: "operation", durability: "transient", clockDomain: "wall",
    contextInputs: ["network.connectivity"],
    effects: [
      "weather.briefing-fetch",
      "cloud.sync-fetch",
      "map.object-fetch",
      "map.tile-fetch",
      "airport.pressure-fetch",
      "aircraft.fetch",
    ],
  },
});
