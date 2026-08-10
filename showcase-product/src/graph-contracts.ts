import {
  field,
  navigationActivePageContract,
  navigationRouteContract,
  valueRef,
} from "@v1d/product-spec";

export const SHOWCASE_NAVIGATION_ID = "showcase.navigation";
export const showcaseActivePageContract = navigationActivePageContract(SHOWCASE_NAVIGATION_ID);
export const showcaseRouteContract = navigationRouteContract(SHOWCASE_NAVIGATION_ID);

/** Immutable catalog data read by every native Showcase renderer. */
export const showcaseCatalogContract = {
  id: "showcase.catalog-presentation",
  kind: "snapshot",
  boundary: "presentation",
  fields: [
    field("revision", "integer"),
    field("sections", valueRef("showcase.section-list")),
    field("cases", valueRef("showcase.case-list")),
  ],
} as const;

/** The selected catalog case/scenario, independent of any host navigation API. */
export const showcaseNavigationContract = {
  id: "showcase.navigation-presentation",
  kind: "state",
  boundary: "presentation",
  fields: [
    field("caseId", "string", { nullable: true }),
    field("scenarioId", "string", { nullable: true }),
  ],
} as const;

/** A mounted Showcase component asks the native navigation owner to open itself. */
export const showcaseOpenActionContract = {
  id: "showcase.open-action",
  kind: "event",
  boundary: "ui-event",
  fields: [
    field("caseId", "string"),
    field("scenarioId", "string", { nullable: true }),
  ],
} as const;
