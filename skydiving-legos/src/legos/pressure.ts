import {
  configInput,
  service,
  field,
  finiteValueRef,
  port,
} from "@v1d/product-spec";

export const pressureObservation = "pressure.observation";
export const pressureContract = {
  id: pressureObservation,
  kind: "observation",
  boundary: "service-internal",
  fields: [
    field("pressureHpa", "number", { unit: "si.hectopascal" }),
    field("measurementTime", "integer", { unit: "si.nanosecond", clockDomain: "monotonic" }),
    field("accuracy", finiteValueRef("pressure.accuracy")),
    field("source", finiteValueRef("pressure.source")),
  ],
} as const;

const transient = { durability: "transient", clockDomain: "none" } as const;
export const pressureRecordingPlatform = service({
  id: "pressure.recording-platform",
  inputs: [],
  outputs: [port("observation", pressureContract)],
  configInputs: [configInput("acquisition")],
  runtime: {
    stateOwner: "instance", lifetime: "operation", durability: "transient", clockDomain: "monotonic",
    contextInputs: ["device.pressure-sensor", "device.location"], effects: ["sensor.recording-subscription"],
  },
});
export const pressureRecordingIngress = service({
  id: "pressure.recording-ingress",
  inputs: [port("pressure", pressureContract)],
  outputs: [],
  runtime: {
    stateOwner: "external", lifetime: "operation", ...transient,
    contextInputs: ["recording.session"], effects: ["recording.pressure-ingest"],
  },
});
