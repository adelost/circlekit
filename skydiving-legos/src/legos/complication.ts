import { service } from "@v1d/product-spec";

/** Watch-face landing complication; payload text derives from durable stores per host request. */
/**
 * WHAT: Publishes landing complication data for host requests.
 * WHY: Keeps replay storage and power settings outside watch-face rendering.
 */
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
