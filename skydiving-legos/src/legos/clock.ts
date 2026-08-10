import { field } from "@v1d/product-spec";

/** Canonical wall-clock tick; consumers that derive time-varying data bind it as DATA. */
export const wallClockPresentationContract = {
  id: "runtime.wall-clock-presentation",
  kind: "state",
  boundary: "presentation",
  fields: [field("nowEpochMs", "integer", { unit: "si.millisecond", clockDomain: "wall" })],
} as const;
