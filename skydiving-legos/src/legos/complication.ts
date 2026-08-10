import { service } from "@v1d/product-spec";

/** Watch-face landing complication; payload text derives from durable stores per host request. */
export const landingComplicationOwner = service({
  id: "complication.landing-owner",
  inputs: [],
  outputs: [],
  runtime: {
    stateOwner: "none", lifetime: "call", durability: "transient", clockDomain: "wall",
    contextInputs: ["host.complication-request", "storage.flight-replays", "storage.power-settings"],
    effects: ["host.complication-data"],
  },
});
