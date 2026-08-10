import {
  field,
  finiteValueRef,
  valueRef,
} from "@v1d/product-spec";

export const attitudeObservationContract = {
  id: "attitude.observation",
  kind: "observation",
  boundary: "service-internal",
  fields: [
    field("x", "number"),
    field("y", "number"),
    field("z", "number"),
    field("w", "number"),
    field("measurementElapsedRealtimeNanos", "integer", {
      unit: "si.nanosecond",
      clockDomain: "monotonic",
    }),
    field("accuracy", finiteValueRef("attitude.accuracy")),
    field("source", finiteValueRef("attitude.source")),
    field("frame", valueRef("attitude.reference-frame")),
  ],
} as const;

export const displayRotationContract = {
  id: "attitude.display-rotation",
  kind: "state",
  boundary: "service-internal",
  fields: [field("quarterTurnsClockwise", "integer")],
} as const;

export const compassStateContract = {
  id: "attitude.compass-state",
  kind: "state",
  boundary: "presentation",
  fields: [
    field("rotation", valueRef("geometry.quaternion")),
    field("trueAttitude", valueRef("geometry.quaternion")),
    field("headingDeg", "number", { unit: "geo.degree" }),
    field("headingConfidence", "number", { unit: "ratio" }),
    field("pitchDeg", "number", { unit: "geo.degree" }),
    field("rollDeg", "number", { unit: "geo.degree" }),
    field("hasFix", "boolean"),
    // Whether the held attitude is still being refreshed. Sibling of the
    // barometer's staleSensor, and declared for the same reason: a consumer
    // that reads an attitude must be able to ask how old it is.
    field("staleAttitude", "boolean"),
    field("attitudeSourceAvailable", "boolean"),
    field("attitudeObservation", valueRef("attitude.observation"), { nullable: true }),
  ],
} as const;
