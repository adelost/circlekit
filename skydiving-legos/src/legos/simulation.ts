import { service, field, port, valueRef } from "@v1d/product-spec";
import { compassStateContract } from "./attitude.js";

export const simulationPresentationContract = {
  id: "simulation.presentation",
  kind: "state",
  boundary: "presentation",
  fields: [field("state", valueRef("simulation.state"))],
} as const;

/** One simulator owner; physics stays native and UI receives one immutable state. */
/**
 * WHAT: Tracks simulated flight state and exposes its current presentation.
 * WHY: Keeps native physics and simulation feeds separate from UI controls.
 */
export const simulationRuntimeOwner = service({
  id: "simulation.runtime-owner",
  inputs: [port("compass", compassStateContract)],
  outputs: [port("presentation", simulationPresentationContract)],
  runtime: {
    stateOwner: "instance",
    lifetime: "process",
    durability: "transient",
    clockDomain: "monotonic",
    contextInputs: ["clock.monotonic", "weather.wind"],
    effects: ["simulation.flight-feed"],
  },
});
