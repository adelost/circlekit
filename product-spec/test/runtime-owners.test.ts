import assert from "node:assert/strict";
import test from "node:test";
import {
  defineComponentType, definePalette, defineProduct, defineProductNavigation, defineScreenComponentFamilyRegistry,
  demandPort, fetchService, field, navigationActivePageContract, PORTABLE_SURFACE_CLASSES, port, present, service,
  storeService, type FetchServiceSpec,
} from "../src/index.js";

// One leased fetch owner demanded on MAIN, one store owner, and the navigation a product needs.
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
const logWriter = <const Id extends string>(id: Id) => service({ id, inputs: [port("forecast", forecast)], outputs: [],
  runtime: { stateOwner: "instance", lifetime: "process", durability: "durable", clockDomain: "none",
    contextInputs: [], effects: ["storage.log-write"] } } as const);
const navigationService = service({ id: "fixture.navigation-service", inputs: [],
  outputs: [port("activePage", activePage)], runtime: { stateOwner: "instance", lifetime: "process",
    durability: "transient", clockDomain: "none", contextInputs: [], effects: ["ui.navigation"] } } as const);
const lifetime = { kind: "lifetime", lifecycleSources: [] } as const;
const weatherCardType = defineComponentType({ id: "fixture.weather-card", inputs: { model: forecastModel }, outputs: [] });
const pageHostType = defineComponentType({ id: "fixture.page-host", inputs: { activePage }, outputs: [] });
const weatherCard = { id: "weather.card", componentTypeRef: weatherCardType.id,
  bindings: { inputs: { model: "weather.view.model" }, events: {} } } as const;
const pageHost = { id: "page.host", componentTypeRef: pageHostType.id,
  bindings: { inputs: { activePage: "navigation.service.activePage" }, events: {} } } as const;
const componentFamilies = defineScreenComponentFamilyRegistry([weatherCard, pageHost], [{ screen: "MAIN",
  family: { id: "fixture.main", trees: PORTABLE_SURFACE_CLASSES.map((surface) => ({ surface,
    mounts: [{ instance: pageHost.id, region: "page-host" }, { instance: weatherCard.id, region: "primary" }] })) } }]);
const assetCatalog = { id: "fixture-assets", version: "1", icons: [] };
const product = {
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
const logStore = storeService({ id: "log.store", backend: "file", codec: { id: "log-entry", version: 1 },
  identity: "logId", durability: "fsync-atomic-replace", failure: "reject", migration: "versioned",
  effectIds: ["storage.log-write"] });
const weather: FetchServiceSpec = { id: "WEATHER", flow: { mode: "clock", everyMs: 60_000, minSpacingMs: 10_000 },
  freshness: { kind: "age", staleAfterMs: 60_000 },
  failure: { transport: "local", retry: { attemptDelaysMs: [], afterFailureMs: [30_000] }, cache: { kind: "none" } },
  onCrash: "as-failure", effectIds: ["network.weather-read"], ownerNodeRef: "weather.fetch", screenRefs: ["MAIN"] };
const compile = (overrides: object) => defineProduct({ ...product, ...overrides } as typeof product, assetCatalog);

test("owned stores and demanded fetches compile, and the IR stays the product without them", () => {
  const declared = compile({ stores: [logStore], fetches: [fetchService(weather)] });
  assert.deepEqual(declared, defineProduct(product, assetCatalog));
  assert.equal("stores" in declared || "fetches" in declared, false);
});

test("a store effect needs exactly one compiled owner", () => {
  assert.throws(() => compile({ stores: [storeService({ ...logStore, effectIds: ["storage.unowned-write"] })] }),
    /store 'log\.store' effect 'storage\.unowned-write' needs exactly one compiled owner, has 0$/u);
  assert.throws(() => compile({ stores: [logStore],
    nodeTypes: [...product.nodeTypes, logWriter("fixture.log-mirror")],
    nodes: [...product.nodes, { id: "log.mirror", nodeTypeRef: "fixture.log-mirror", config: {},
      bindings: { forecast: "weather.fetch.forecast" }, activation: lifetime }] }),
  /store 'log\.store' effect 'storage\.log-write' needs exactly one compiled owner, has 2 \(fixture\.log-store, fixture\.log-mirror\)$/u);
});

test("a fetch effect needs a compiled owner", () => {
  assert.throws(() => compile({ fetches: [fetchService({ ...weather, effectIds: ["network.unowned-read"] })] }),
    /fetch 'WEATHER' effect 'network\.unowned-read' has no compiled owner/u);
});

test("a fetch owner is a compiled node", () => {
  assert.throws(() => compile({ fetches: [fetchService({ ...weather, ownerNodeRef: "weather.missing" })] }),
    /fetch 'WEATHER' ownerNodeRef 'weather\.missing' is not a compiled node/u);
});

test("a fetch screen is a component-family screen that demands its owner", () => {
  assert.throws(() => compile({ fetches: [fetchService({ ...weather, screenRefs: ["RECORDS"] })] }),
    /fetch 'WEATHER' screen 'RECORDS' is not a component-family screen/u);
  assert.throws(() => compile({ fetches: [fetchService({ ...weather, ownerNodeRef: "log.store" })] }),
    /fetch 'WEATHER' owner 'log\.store' is not demanded on screen 'MAIN'/u);
});
