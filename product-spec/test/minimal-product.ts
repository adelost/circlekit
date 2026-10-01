import {
  defineComponentType, definePalette, defineProductNavigation, defineScreenComponentFamilyRegistry, demandPort, field,
  navigationActivePageContract, PORTABLE_SURFACE_CLASSES, port, present, service,
} from "../src/index.js";

// The smallest real product: one leased fetch owner demanded on MAIN, one store owner, and the navigation a
// product needs. Tests spread it and override one field.
const forecast = { id: "fixture.forecast", kind: "snapshot", boundary: "service-internal",
  fields: [field("windMs", "number")] } as const;
const forecastModel = { id: "fixture.forecast-model", kind: "state", boundary: "presentation",
  fields: [field("windMs", "number")] } as const;
const demand = { id: "fixture.demand", kind: "event", boundary: "service-internal", fields: [] } as const;
const activePage = navigationActivePageContract("fixture.navigation");
const weatherFetch = service({ id: "fixture.weather-fetch", inputs: [demandPort("demand", demand)],
  outputs: [port("forecast", forecast)], runtime: { stateOwner: "none", lifetime: "process",
    durability: "transient", clockDomain: "none", contextInputs: [], effects: ["network.weather-read"] } } as const);
const weatherView = present({ id: "fixture.weather-view", inputs: [port("forecast", forecast)],
  outputs: [port("model", forecastModel)], runtime: { stateOwner: "none", lifetime: "call",
    durability: "transient", clockDomain: "none", contextInputs: [], effects: [] } } as const);
export const logWriter = <const Id extends string>(id: Id) => service({ id, inputs: [port("forecast", forecast)],
  outputs: [], runtime: { stateOwner: "instance", lifetime: "process", durability: "durable", clockDomain: "none",
    contextInputs: [], effects: ["storage.log-write"] } } as const);
const navigationService = service({ id: "fixture.navigation-service", inputs: [],
  outputs: [port("activePage", activePage)], runtime: { stateOwner: "instance", lifetime: "process",
    durability: "transient", clockDomain: "none", contextInputs: [], effects: ["ui.navigation"] } } as const);
export const lifetime = { kind: "lifetime", lifecycleSources: [] } as const;
const weatherCardType = defineComponentType({ id: "fixture.weather-card", inputs: { model: forecastModel }, outputs: [] });
const pageHostType = defineComponentType({ id: "fixture.page-host", inputs: { activePage }, outputs: [] });
const weatherCard = { id: "weather.card", componentTypeRef: weatherCardType.id,
  bindings: { inputs: { model: "weather.view.model" }, events: {} } } as const;
const pageHost = { id: "page.host", componentTypeRef: pageHostType.id,
  bindings: { inputs: { activePage: "navigation.service.activePage" }, events: {} } } as const;
const componentFamilies = defineScreenComponentFamilyRegistry([weatherCard, pageHost], [{ screen: "MAIN",
  family: { id: "fixture.main", trees: PORTABLE_SURFACE_CLASSES.map((surface) => ({ surface,
    mounts: [{ instance: pageHost.id, region: "page-host" }, { instance: weatherCard.id, region: "primary" }] })) } }]);
export const assetCatalog = { id: "fixture-assets", version: "1", icons: [] };
export const product = {
  id: "fixture",
  rendererBindings: [{ id: "renderer.phone", capabilities: ["ui.component-tree"] }],
  artifacts: [{ id: "phone", rendererRefs: ["renderer.phone"], requiredCapabilities: ["ui.component-tree"],
    entryScreen: "MAIN", screenRefs: ["MAIN"], serves: ["compact"] }],
  nodeTypes: [weatherFetch, weatherView, logWriter("fixture.log-store"), navigationService],
  nodes: [
    { id: "weather.fetch", nodeTypeRef: weatherFetch.id, config: {}, bindings: {},
      activation: { kind: "leased", port: "demand", lifecycleSources: [] } },
    { id: "weather.view", nodeTypeRef: weatherView.id, config: {}, bindings: { forecast: "weather.fetch.forecast" } },
    { id: "log.store", nodeTypeRef: "fixture.log-store", config: {}, bindings: { forecast: "weather.fetch.forecast" },
      activation: lifetime },
    { id: "navigation.service", nodeTypeRef: navigationService.id, config: {}, bindings: {}, activation: lifetime },
  ],
  configs: [], finiteValues: [], stateAuthorities: [],
  componentTypes: [weatherCardType, pageHostType],
  components: [weatherCard, pageHost],
  componentFamilies,
  palette: definePalette([]),
  assetCatalogRef: { id: assetCatalog.id, version: assetCatalog.version },
  iconRefs: [],
  navigation: defineProductNavigation(componentFamilies,
    { id: "fixture.navigation", pageSemantics: { MAIN: { guard: null, back: "system" } } }),
} as const;
