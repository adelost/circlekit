import { CIRCLEKIT_ASSET_CATALOG } from "@v1d/circlekit-assets";
import {
  componentPort,
  defineComponentType,
  defineProduct,
  defineProductNavigation,
  defineScreenComponentFamilyRegistry,
  defineStateAuthority,
  defineStatePresentation,
  field,
  navigationActivePageContract,
  port,
  present,
  service,
  statePresentationField,
  valueRef,
} from "@v1d/product-spec";
import {
  positionAvailabilities,
  positionFlightFixContract,
  positionObservationContract,
  positionPresentationContract,
  positionService,
  skydivingLegoCatalog as SKYDIVING_CATALOG,
} from "@v1d/skydiving-legos";

const LINK_NAVIGATION_ID = "link.navigation";
const linkActivePageContract = navigationActivePageContract(LINK_NAVIGATION_ID);

const linkPositionFixPresentationContract = {
  id: "link.position-fix-presentation",
  kind: "snapshot",
  boundary: "presentation",
  fields: [
    field("observation", valueRef(positionObservationContract.id)),
    field("breakBefore", "boolean"),
    field("gpsStatus", "string"),
  ],
} as const;

const linkPositionFixPresentation = present({
  id: "link.position-fix-presentation",
  inputs: [port("fix", positionFlightFixContract)],
  outputs: [port("model", linkPositionFixPresentationContract)],
  runtime: {
    stateOwner: "none",
    lifetime: "call",
    durability: "transient",
    clockDomain: "none",
    contextInputs: [],
    effects: [],
  },
} as const);

const linkPositionAvailabilityPresentation = defineStatePresentation(positionAvailabilities, {
  id: "link.position-availability",
  fields: [statePresentationField("label", "string")],
  cases: {
    off: { label: "GPS OFF" },
    "precise-required": { label: "PRECISE REQUIRED" },
    subscribing: { label: "SEARCHING" },
    live: { label: "GPS LIVE" },
    coarse: { label: "GPS COARSE" },
    stale: { label: "LAST SEEN" },
    failed: { label: "GPS ERROR" },
  },
});

const linkPositionAvailability = defineStateAuthority({
  id: "link.position-availability",
  source: {
    portRef: "position.service.presentation",
    contract: positionPresentationContract,
    stateField: "availability",
    states: positionAvailabilities,
  },
  presentation: linkPositionAvailabilityPresentation,
});

const linkNavigationService = service({
  id: "link.navigation-service",
  inputs: [],
  outputs: [port("activePage", linkActivePageContract)],
  runtime: {
    stateOwner: "instance",
    lifetime: "instance",
    durability: "transient",
    clockDomain: "none",
    contextInputs: [],
    effects: ["ui.navigation"],
  },
} as const);

const linkPositionPageType = defineComponentType({
  id: "link.position-page",
  requiredCapabilities: ["ui.component-tree"],
  inputs: [
    componentPort("availability", linkPositionAvailabilityPresentation.contract),
    componentPort("fix", linkPositionFixPresentationContract),
  ],
  outputs: [],
} as const);

const linkPageHostType = defineComponentType({
  id: "link.page-host",
  requiredCapabilities: ["ui.component-tree"],
  inputs: [componentPort("activePage", linkActivePageContract)],
  outputs: [],
} as const);

const linkPositionPage = {
  id: "position.page",
  componentTypeRef: linkPositionPageType.id,
  bindings: {
    inputs: {
      availability: linkPositionAvailability.presentationPortRef,
      fix: "position.fix-presentation.model",
    },
    events: {},
  },
} as const;

const linkPageHost = {
  id: "page.host",
  componentTypeRef: linkPageHostType.id,
  bindings: {
    inputs: { activePage: "navigation.service.activePage" },
    events: {},
  },
} as const;

const linkComponents = [linkPositionPage, linkPageHost] as const;
const linkSurfaces = ["round", "compact", "wide"] as const;

const linkComponentFamilies = defineScreenComponentFamilyRegistry(linkComponents, [{
  screen: "POSITION",
  family: {
    id: "link.position",
    trees: linkSurfaces.map((surface) => ({
      surface,
      mounts: [
        { instance: linkPositionPage.id, region: "primary" },
        { instance: linkPageHost.id, region: "page-host" },
      ],
    })),
  },
}] as const);

const linkNavigation = defineProductNavigation(linkComponentFamilies, {
  id: LINK_NAVIGATION_ID,
  pageSemantics: {
    POSITION: { guard: null, back: "system" },
  },
} as const);

export const linkProductDeclaration = {
  id: "link",
  rendererBindings: [{
    id: "link-kotlin",
    capabilities: ["ui.component-tree"],
  }],
  artifacts: [{
    id: "link-portable",
    rendererRefs: ["link-kotlin"],
    requiredCapabilities: ["ui.component-tree"],
    entryScreen: "POSITION",
    screenRefs: ["POSITION"],
    serves: ["round", "compact", "wide"],
  }],
  nodeTypes: [
    positionService,
    linkPositionFixPresentation,
    linkPositionAvailability.adapter.type,
    linkNavigationService,
  ],
  nodes: [
    {
      id: "position.service",
      nodeTypeRef: positionService.id,
      config: {
        acquisition: "link.position-acquisition",
        presentationPolicy: "link.position-presentation-policy",
        flightPolicy: "link.position-flight-policy",
      },
      bindings: {},
      activation: { kind: "leased", port: "demand", lifecycleSources: [] },
    },
    {
      id: "position.fix-presentation",
      nodeTypeRef: linkPositionFixPresentation.id,
      config: {},
      bindings: { fix: "position.service.flightFix" },
    },
    linkPositionAvailability.adapter.node,
    {
      id: "navigation.service",
      nodeTypeRef: linkNavigationService.id,
      config: {},
      bindings: {},
      activation: { kind: "lifetime", lifecycleSources: [] },
    },
  ],
  configs: [
    {
      id: "link.position-acquisition",
      values: { highIntervalMs: 2_000, balancedIntervalMs: 30_000 },
    },
    {
      id: "link.position-presentation-policy",
      values: {
        maxAccuracyM: 10_000,
        staleFixAgeMs: 5_000,
        coarseAccuracyM: 100,
        displayStaleAgeMs: 60_000,
      },
    },
    { id: "link.position-flight-policy" },
  ],
  finiteValues: [],
  stateAuthorities: [linkPositionAvailability.authority],
  componentTypes: [linkPositionPageType, linkPageHostType],
  components: linkComponents,
  componentFamilies: linkComponentFamilies,
  navigation: linkNavigation,
  palette: { variants: [] },
  assetCatalogRef: {
    id: CIRCLEKIT_ASSET_CATALOG.id,
    version: CIRCLEKIT_ASSET_CATALOG.version,
  },
  iconRefs: [],
} as const;

export function compileLinkProduct() {
  return defineProduct(
    linkProductDeclaration,
    CIRCLEKIT_ASSET_CATALOG,
    [SKYDIVING_CATALOG],
  );
}

export { CIRCLEKIT_ASSET_CATALOG, SKYDIVING_CATALOG };
