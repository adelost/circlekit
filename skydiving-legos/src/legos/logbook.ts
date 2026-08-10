import { service, field, port, valueRef } from "@v1d/product-spec";

export const jumpSitesPresentationContract = {
  id: "logbook.jump-sites-presentation",
  kind: "snapshot",
  boundary: "presentation",
  fields: [field("sites", valueRef("logbook.jump-site-list"))],
} as const;

/** Deterministic tag suggestions plus durable user verdict deltas; wording lives in the UI layer. */
export const jumpTagsOwner = service({
  id: "logbook.tags-owner",
  inputs: [],
  outputs: [],
  runtime: {
    stateOwner: "external", lifetime: "call", durability: "durable", clockDomain: "wall",
    contextInputs: ["tags.verdict-intent", "storage.flight-annotations"],
    effects: ["storage.flight-annotation-write", "storage.flight-index-tag-write"],
  },
});

/** Jump site catalogue: user aliases always win, aviation-target enrichment is best effort. */
export const jumpSitesOwner = service({
  id: "logbook.sites-owner",
  inputs: [],
  outputs: [port("presentation", jumpSitesPresentationContract)],
  runtime: {
    stateOwner: "external", lifetime: "process", durability: "durable", clockDomain: "wall",
    contextInputs: ["sites.user-intent", "map.aviation-targets", "storage.jump-sites"],
    effects: ["storage.jump-sites-write"],
  },
});
