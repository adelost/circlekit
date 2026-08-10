import { service, field, finiteValueRef, port } from "@v1d/product-spec";
import { flightJumpEventContract } from "./flight.js";
import { continuousTrackStateContract } from "./settings.js";

export const watchAccountPresentationContract = {
  id: "sync.watch-account-presentation",
  kind: "state",
  boundary: "presentation",
  fields: [
    field("state", finiteValueRef("sync.watch-account-state")),
    field("pairingCode", "string", { nullable: true }),
    field("message", "string", { nullable: true }),
  ],
} as const;

export const watchAccountActionContract = {
  id: "sync.watch-account-action",
  kind: "event",
  boundary: "ui-event",
  fields: [field("action", finiteValueRef("sync.watch-account-action"))],
} as const;

/** Watch account pairing and token custody; the pairing flow state machine stays native UI. */
export const watchAccountOwner = service({
  id: "sync.watch-account-owner",
  inputs: [port("action", watchAccountActionContract)],
  outputs: [port("presentation", watchAccountPresentationContract)],
  runtime: {
    stateOwner: "instance", lifetime: "process", durability: "durable", clockDomain: "monotonic",
    contextInputs: ["network.pairing-transport", "storage.watch-token"],
    effects: [
      "network.pairing-start",
      "network.pairing-poll",
      "network.pairing-revoke",
      "storage.watch-token-write",
      "storage.watch-token-clear",
    ],
  },
});

/** Durable per-account outbox: jump upload, delete tombstones and acks; HTTP transport stays native. */
export const syncOutboxOwner = service({
  id: "sync.outbox-owner",
  inputs: [port("jump", flightJumpEventContract)],
  outputs: [],
  runtime: {
    stateOwner: "external", lifetime: "process", durability: "durable", clockDomain: "wall",
    contextInputs: ["sync.account-credentials", "storage.trackbook-sync-state", "network.trackbook-api"],
    effects: ["network.jump-upload", "network.jump-delete", "storage.sync-ack-write"],
  },
});

/** Continuous track session upload gated by the user setting; recorder and transport stay native. */
export const continuousTrackOwner = service({
  id: "sync.continuous-track-owner",
  inputs: [port("enabled", continuousTrackStateContract)],
  outputs: [],
  runtime: {
    stateOwner: "instance", lifetime: "process", durability: "transient", clockDomain: "wall",
    contextInputs: ["sync.account-credentials", "recording.session-track"],
    effects: ["network.session-upload"],
  },
});
