import assert from "node:assert/strict";
// The suite reads the adapter through the SAME accessor the emitters use,
// so an assertion cannot drift from what production actually consumes.
import { adapterFields } from "../src/state-authority-internals.js";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import type { ConformanceAxis, ConformanceDirection, NativeBindingManifest } from "../src/conformance-model.js";
import {
  assertProductArtifactConformance,
  buildOutputManifest,
  checkOutputManifest,
  compileProductGraph,
  componentPort,
  contextPort,
  demandPort,
  decodeNativeBindingManifest,
  defineComponentType,
  defineStateAuthority,
  defineStatePresentation,
  derive,
  definePalette,
  definePortableAssetCatalog,
  defineProduct,
  defineProductNavigation,
  defineScreenComponentFamilyRegistry,
  field,
  finiteProduct,
  finiteValueRef,
  finiteValues,
  logOutputManifest,
  mapFiniteCases,
  navigationActivePageContract,
  navigationGuardContract,
  navigationConformance,
  navigationRouteContract,
  PORTABLE_SURFACE_CLASSES,
  port,
  productArtifactConformance,
  productArtifactHostCoverage,
  productJsonEmitter,
  present,
  service,
  statePresentationField,
  validateProductNodeType,
  validateProductIconRendererBindings,
  writeOutputManifest,
  type NativeNavigationBindingManifest,
} from "../src/index.js";

const statusContract = {
  id: "fixture.status",
  kind: "state",
  boundary: "presentation",
  fields: [field("active", "boolean"), field("phase", finiteValueRef("fixture.phase"))],
} as const;
const actionContract = {
  id: "fixture.action",
  kind: "event",
  boundary: "ui-event",
  fields: [],
} as const;
const internalContract = {
  id: "fixture.internal",
  kind: "snapshot",
  boundary: "service-internal",
  fields: [field("sequence", "integer")],
} as const;
const demandContract = {
  id: "fixture.demand",
  kind: "event",
  boundary: "service-internal",
  fields: [],
} as const;
const contextContract = {
  id: "fixture.context",
  kind: "state",
  boundary: "service-internal",
  fields: [field("mode", "string")],
} as const;
const fixturePhases = finiteValues("fixture.phase", ["idle", "active"]);
const fixtureTones = finiteValues("fixture.tone", ["muted", "ok", "warn"]);
const baseNavigationId = "fixture.navigation";
const baseActivePageContract = navigationActivePageContract(baseNavigationId);

const source = service({
  id: "fixture.source",
  inputs: [demandPort("demand", demandContract)],
  outputs: [port("status", internalContract)],
  runtime: {
    stateOwner: "none", lifetime: "process", durability: "transient",
    clockDomain: "none", contextInputs: [], effects: ["fixture.source-read"],
  },
} as const);
const noDemandSource = service({
  ...source,
  id: "fixture.no-demand-source",
  inputs: [],
} as const);
const controller = service({
  id: "fixture.controller",
  inputs: [
    port("sourceState", internalContract),
    port("trigger", actionContract),
  ],
  outputs: [port("state", statusContract)],
  runtime: {
    stateOwner: "instance", lifetime: "instance", durability: "transient",
    clockDomain: "none", contextInputs: [], effects: ["fixture.effect"],
  },
} as const);
const phasePresentation = defineStatePresentation(fixturePhases, {
  id: "fixture.phase-signal",
  fields: [
    statePresentationField("label", "string"),
    statePresentationField("tone", "string"),
    statePresentationField("hint", "string"),
  ],
  cases: {
    idle: { label: "IDLE", tone: "muted", hint: "Waiting" },
    active: { label: "ACTIVE", tone: "ok", hint: "Running" },
  },
});
const phaseDefinition = defineStateAuthority({
  id: "fixture.phase-authority",
  source: {
    portRef: "ui.controller.state",
    contract: statusContract,
    stateField: "phase",
    states: fixturePhases,
  },
  presentation: phasePresentation,
});
const phaseAuthority = phaseDefinition.authority;
const projection = present({
  id: "fixture.projection",
  inputs: [port("state", statusContract)],
  outputs: [port("model", statusContract)],
  runtime: {
    stateOwner: "instance", lifetime: "instance", durability: "transient",
    clockDomain: "none", contextInputs: [], effects: [],
  },
} as const);
const background = service({
  id: "fixture.background",
  inputs: [port("status", internalContract)],
  outputs: [],
  runtime: {
    stateOwner: "instance", lifetime: "instance", durability: "transient",
    clockDomain: "none", contextInputs: [], effects: ["fixture.background-write"],
  },
} as const);
const baseNavigationService = service({
  id: "fixture.base-navigation-service",
  inputs: [],
  outputs: [port("activePage", baseActivePageContract)],
  runtime: {
    stateOwner: "instance", lifetime: "instance", durability: "transient",
    clockDomain: "none", contextInputs: [], effects: ["fixture.navigation"],
  },
} as const);
const controlType = defineComponentType({
  id: "fixture.control",
  requiredCapabilities: ["ui.menu"],
  inputs: [
    componentPort("state", statusContract),
    componentPort("phasePresentation", phasePresentation.contract),
  ],
  outputs: [componentPort("activate", actionContract)],
} as const);
const control = {
  id: "control.main",
  componentTypeRef: controlType.id,
  bindings: {
    inputs: {
      state: "ui.projection.model",
      phasePresentation: phaseDefinition.presentationPortRef,
    },
    events: { activate: "ui.controller.trigger" },
  },
} as const;
const basePageHostType = defineComponentType({
  id: "fixture.page-host",
  requiredCapabilities: ["ui.menu"],
  inputs: [componentPort("activePage", baseActivePageContract)],
  outputs: [],
} as const);
const basePageHost = {
  id: "page.host",
  componentTypeRef: basePageHostType.id,
  bindings: { inputs: { activePage: "navigation.service.activePage" }, events: {} },
} as const;
const componentFamilies = defineScreenComponentFamilyRegistry([control, basePageHost], [{
  screen: "MAIN",
  family: {
    id: "fixture.main",
    trees: PORTABLE_SURFACE_CLASSES.map((surface) => ({
      surface,
      mounts: [
        { instance: control.id, region: "primary" },
        { instance: basePageHost.id, region: "page-host" },
      ],
    })),
  },
}] as const);

const paletteVariant = {
  id: "default",
  identity: { primary: "#ffffff" },
  categories: [{ id: "sky", hex: "#55aadd", meaning: "sky context" }],
  status: { ok: "#55aa55", caution: "#ddaa33", danger: "#dd5555" },
  ramps: [{
    id: "wind", kind: "safety-envelope", unit: "m/s",
    bands: [{
      id: "normal", upTo: 8, ruleEdge: true, hueDeg: 157,
      lightness: 0.86, lightnessTravel: 0.2, chromaMax: 0.185, label: "NORMAL",
    }],
  }],
} as const;
const palette = definePalette([paletteVariant] as const);
const assetCatalog = definePortableAssetCatalog({
  id: "circlekit",
  version: "0.3.25",
  icons: [{
    id: "check", viewport: { width: 24, height: 24 },
    paths: [{ kind: "stroke", pathData: "M20 6L9 17l-5 -5", strokeWidth: 3.2 }],
  }],
} as const);

const baseDeclaration = {
  id: "fixture",
  rendererBindings: [
    { id: "renderer.phone", capabilities: ["ui.menu"] },
    { id: "renderer.wear", capabilities: ["ui.menu"] },
  ],
  artifacts: [
    { id: "phone", rendererRefs: ["renderer.phone"], requiredCapabilities: ["ui.menu"], entryScreen: "MAIN", screenRefs: ["MAIN"], serves: ["compact", "wide"] },
    { id: "wear", rendererRefs: ["renderer.wear"], requiredCapabilities: ["ui.menu"], entryScreen: "MAIN", screenRefs: ["MAIN"], serves: ["round"] },
  ],
  nodeTypes: [source, controller, phaseDefinition.adapter.type, projection, baseNavigationService],
  nodes: [
    { id: "domain.source", nodeTypeRef: source.id, config: {}, bindings: {}, activation: {
      kind: "leased", port: "demand", lifecycleSources: [],
    } },
    { id: "ui.controller", nodeTypeRef: controller.id, config: {}, activation: {
      kind: "lifetime", lifecycleSources: [],
    }, bindings: {
      sourceState: "domain.source.status",
      trigger: "control.main.activate",
    } },
    phaseDefinition.adapter.node,
    { id: "ui.projection", nodeTypeRef: projection.id, config: {}, bindings: {
      state: "ui.controller.state",
    } },
    { id: "navigation.service", nodeTypeRef: baseNavigationService.id, config: {}, bindings: {}, activation: {
      kind: "lifetime", lifecycleSources: [],
    } },
  ],
  configs: [],
  finiteValues: [fixturePhases],
  stateAuthorities: [phaseAuthority],
  componentTypes: [controlType, basePageHostType],
  components: [control, basePageHost],
  componentFamilies,
  palette,
  assetCatalogRef: { id: assetCatalog.id, version: assetCatalog.version },
  iconRefs: [{ id: "status.check", assetRef: "check", accent: "status.ok", artifacts: ["phone", "wear"] }],
  navigation: defineProductNavigation(componentFamilies, {
    id: baseNavigationId,
    pageSemantics: {
      MAIN: { guard: null, back: "system" },
    },
  } as const),
} as const;

function fixture(overrides: Record<string, unknown> = {}) {
  const declaration = { ...baseDeclaration, ...overrides } as Record<string, unknown>;
  if (Array.isArray(overrides.nodeTypes)) {
    declaration.nodeTypes = overrides.nodeTypes.some((item) => (item as { id?: string }).id === baseNavigationService.id)
      ? overrides.nodeTypes : [...overrides.nodeTypes, baseNavigationService];
  }
  if (Array.isArray(overrides.nodes)) {
    declaration.nodes = overrides.nodes.some((item) => (item as { id?: string }).id === "navigation.service")
      ? overrides.nodes : [...overrides.nodes, baseDeclaration.nodes[4]];
  }
  if (Array.isArray(overrides.componentTypes)) {
    declaration.componentTypes = overrides.componentTypes.some((item) => (item as { id?: string }).id === basePageHostType.id)
      ? overrides.componentTypes : [...overrides.componentTypes, basePageHostType];
  }
  if (Array.isArray(overrides.components)) {
    declaration.components = overrides.components.some((item) => (item as { id?: string }).id === basePageHost.id)
      ? overrides.components : [...overrides.components, basePageHost];
  }
  return defineProduct(declaration as never, assetCatalog);
}

const navigationId = "fixture.closed-navigation";
const activePageContract = navigationActivePageContract(navigationId);
const routeIntentContract = navigationRouteContract(navigationId);
const sessionGuardContract = navigationGuardContract("fixture.session-ready");
const menuActivateContract = {
  id: "fixture.menu-activate", kind: "event", boundary: "ui-event", fields: [],
} as const;
const guardService = service({
  id: "fixture.guard-service",
  inputs: [],
  outputs: [port("allowed", sessionGuardContract)],
  runtime: {
    stateOwner: "external", lifetime: "process", durability: "transient",
    clockDomain: "none", contextInputs: [], effects: ["fixture.guard-read"],
  },
} as const);
const navigationService = service({
  id: "fixture.navigation-service",
  inputs: [
    port("route", routeIntentContract),
    port("sessionReady", sessionGuardContract),
  ],
  outputs: [port("activePage", activePageContract)],
  runtime: {
    stateOwner: "instance", lifetime: "instance", durability: "transient",
    clockDomain: "none", contextInputs: [], effects: ["ui.navigation"],
  },
} as const);
const menuEventSink = service({
  id: "fixture.menu-event-sink",
  inputs: [port("activate", menuActivateContract)],
  outputs: [],
  runtime: {
    stateOwner: "none", lifetime: "process", durability: "transient",
    clockDomain: "none", contextInputs: [], effects: ["fixture.menu-event"],
  },
} as const);
const navigationMenuType = defineComponentType({
  id: "fixture.weather-card",
  requiredCapabilities: ["ui.menu"],
  inputs: [],
  outputs: [
    componentPort("route", routeIntentContract),
    componentPort("activate", menuActivateContract),
  ],
} as const);
const pageHostType = defineComponentType({
  id: "fixture.closed-page-host",
  requiredCapabilities: ["ui.menu"],
  inputs: [componentPort("activePage", activePageContract)],
  outputs: [],
} as const);
const navigationMenu = {
  id: "weather.card", componentTypeRef: navigationMenuType.id,
  bindings: {
    inputs: {},
    events: {
      route: "navigation.service.route",
      activate: "weather.event-sink.activate",
    },
  },
} as const;
const pageHost = {
  id: "page.closed-host", componentTypeRef: pageHostType.id,
  bindings: { inputs: { activePage: "navigation.service.activePage" }, events: {} },
} as const;
const navigationFamilies = defineScreenComponentFamilyRegistry(
  [control, navigationMenu, pageHost],
  [
    { screen: "MAIN", family: {
      id: "fixture.navigation-main",
      trees: PORTABLE_SURFACE_CLASSES.map((surface) => ({
        surface,
        mounts: [
          { instance: control.id, region: "primary" },
          { instance: navigationMenu.id, region: "menu" },
          { instance: pageHost.id, region: "page-host" },
        ],
      })),
    } },
    { screen: "DETAILS", family: {
      id: "fixture.navigation-details",
      trees: PORTABLE_SURFACE_CLASSES.map((surface) => ({
        surface,
        mounts: [
          { instance: control.id, region: "primary" },
          { instance: pageHost.id, region: "page-host" },
        ],
      })),
    } },
  ] as const,
);
const navigationNodeTypes = [
  source, controller, phaseDefinition.adapter.type, projection,
  guardService, navigationService, menuEventSink,
] as const;
const navigationDeclaration = defineProductNavigation(navigationFamilies, {
  id: navigationId,
  pageSemantics: {
    MAIN: { guard: null, back: "system" },
    DETAILS: {
      guard: sessionGuardContract, back: "previous",
    },
  },
} as const);
const navigationProductDeclaration = {
  ...baseDeclaration,
  artifacts: baseDeclaration.artifacts.map((artifact) => ({
    ...artifact, screenRefs: ["MAIN", "DETAILS"] as const,
  })),
  nodeTypes: navigationNodeTypes,
  nodes: [
    baseDeclaration.nodes[0], baseDeclaration.nodes[1], baseDeclaration.nodes[2], baseDeclaration.nodes[3],
    {
      id: "guard.service", nodeTypeRef: guardService.id, config: {}, bindings: {},
      activation: { kind: "lifetime", lifecycleSources: [] },
    },
    {
      id: "navigation.service", nodeTypeRef: navigationService.id, config: {},
      bindings: {
        route: "weather.card.route",
        sessionReady: "guard.service.allowed",
      },
      activation: { kind: "lifetime", lifecycleSources: [] },
    },
    {
      id: "weather.event-sink", nodeTypeRef: menuEventSink.id, config: {},
      bindings: { activate: "weather.card.activate" },
      activation: { kind: "lifetime", lifecycleSources: [] },
    },
  ],
  componentTypes: [
    controlType, navigationMenuType, pageHostType,
  ],
  components: [
    control, navigationMenu, pageHost,
  ],
  componentFamilies: navigationFamilies,
  navigation: navigationDeclaration,
} as const;

function navigationFixture(overrides: Record<string, unknown> = {}) {
  return defineProduct({ ...navigationProductDeclaration, ...overrides }, assetCatalog);
}

const nativeClosedNavigation: NativeNavigationBindingManifest = {
  artifacts: [
    {
      artifactRef: "phone", entryPageRef: "MAIN", pages: [
        { pageRef: "MAIN", restore: "root", back: "system", guardContractRef: null },
        { pageRef: "DETAILS", restore: "process", back: "previous", guardContractRef: "fixture.session-ready" },
      ],
    },
    {
      artifactRef: "wear", entryPageRef: "MAIN", pages: [
        { pageRef: "MAIN", restore: "root", back: "system", guardContractRef: null },
        { pageRef: "DETAILS", restore: "process", back: "previous", guardContractRef: "fixture.session-ready" },
      ],
    },
  ],
  activePageBindings: [{
    publisherPortRef: "navigation.service.activePage",
    pageHostPortRef: "page.closed-host.activePage",
  }],
  actionGroups: ["phone", "wear"].flatMap((artifactRef) => [
    {
      artifactRef,
      componentInstanceRef: "control.main",
      actions: [{
        sourcePortRef: "control.main.activate",
        targetPortRef: "ui.controller.trigger",
        effect: "dispatch" as const,
      }],
    },
    {
      artifactRef,
      componentInstanceRef: "weather.card",
      actions: [
        {
          sourcePortRef: "weather.card.route",
          targetPortRef: "navigation.service.route",
          effect: "push" as const,
        },
        {
          sourcePortRef: "weather.card.activate",
          targetPortRef: "weather.event-sink.activate",
          effect: "dispatch" as const,
        },
      ],
    },
  ]),
};

if (false) {
  // @ts-expect-error RouteIntent has one closed payload; there is no metadata target argument.
  navigationRouteContract(navigationId, "DETAILS");
  defineProduct({ ...baseDeclaration, nodes: [
    baseDeclaration.nodes[0],
    // @ts-expect-error Every required node input has an exact binding.
    { ...baseDeclaration.nodes[1], bindings: {
      trigger: "control.main.activate",
    } },
    baseDeclaration.nodes[2],
    baseDeclaration.nodes[3],
  ] }, assetCatalog);
  defineProduct({ ...baseDeclaration, nodes: [
    baseDeclaration.nodes[0],
    { ...baseDeclaration.nodes[1], bindings: {
      ...baseDeclaration.nodes[1].bindings,
      // @ts-expect-error The source ref is derived from declared node/component outputs.
      sourceState: "invented.output",
    } },
    baseDeclaration.nodes[2],
    baseDeclaration.nodes[3],
  ] }, assetCatalog);
  defineProduct({ ...baseDeclaration, components: [{
    ...control,
    bindings: {
      ...control.bindings,
      // @ts-expect-error Component binding names are derived from the selected ComponentType.
      inputs: { invented: "ui.projection.model" },
    },
  }] }, assetCatalog);
  defineProduct({ ...baseDeclaration, nodeTypes: [noDemandSource, controller, phaseDefinition.adapter.type, projection], nodes: [
    { id: "domain.source", nodeTypeRef: noDemandSource.id, config: {}, bindings: {}, activation: {
      // @ts-expect-error A service without a demand input is structurally lifetime, never leased.
      kind: "leased", port: "demand", lifecycleSources: ["app-active"],
    } },
    baseDeclaration.nodes[1],
    baseDeclaration.nodes[2],
    baseDeclaration.nodes[3],
  ] }, assetCatalog);

  // @ts-expect-error A service must prove that it owns at least one runtime effect.
  service({ ...source, runtime: { ...source.runtime, effects: [] } } as const);
  // @ts-expect-error A derive node cannot own an external effect.
  derive({ ...projection, runtime: { ...projection.runtime, effects: ["fixture.effect"] } } as const);

  defineStatePresentation(fixturePhases, {
    id: "fixture.missing-phase",
    fields: phasePresentation.fields,
    // @ts-expect-error Every canonical state must have presentation data.
    cases: { idle: { label: "IDLE", tone: "muted", hint: "Waiting" } },
  });
  defineStatePresentation(fixturePhases, {
    id: "fixture.extra-phase",
    fields: phasePresentation.fields,
    cases: {
      idle: { label: "IDLE", tone: "muted", hint: "Waiting" },
      active: { label: "ACTIVE", tone: "ok", hint: "Running" },
      // @ts-expect-error A presentation cannot invent a state outside the canonical space.
      invented: { label: "INVENTED", tone: "warn", hint: "No" },
    },
  });
  defineStatePresentation(fixturePhases, {
    id: "fixture.missing-payload",
    fields: phasePresentation.fields,
    cases: {
      // @ts-expect-error Every case must carry the complete payload schema.
      idle: { label: "IDLE", tone: "muted" },
      active: { label: "ACTIVE", tone: "ok", hint: "Running" },
    },
  });
  defineStatePresentation(fixturePhases, {
    id: "fixture.extra-payload",
    fields: phasePresentation.fields,
    cases: {
      // @ts-expect-error A case cannot invent payload fields outside the shared schema.
      idle: { label: "IDLE", tone: "muted", hint: "Waiting", invented: "NO" },
      active: { label: "ACTIVE", tone: "ok", hint: "Running" },
    },
  });
  defineStatePresentation(fixturePhases, {
    id: "fixture.invalid-tone",
    fields: [statePresentationField("tone", fixtureTones)],
    cases: {
      idle: { tone: "muted" },
      // @ts-expect-error Finite payload fields accept only their declared closed values.
      active: { tone: "invented" },
    },
  });
}

test("service, derive and present are structurally distinct authoring kinds", () => {
  assert.throws(() => validateProductNodeType({
    ...source, kind: "service", runtime: { ...source.runtime, effects: [] },
  }), /must declare at least one runtime effect/);
  assert.throws(() => validateProductNodeType({
    ...projection, kind: "derive", runtime: { ...projection.runtime, effects: ["fixture.effect"] },
  }), /cannot declare runtime effects/);
  assert.throws(() => present({
    id: "fixture.invalid-presentation",
    inputs: [], outputs: [port("internal", internalContract)],
    runtime: {
      stateOwner: "instance", lifetime: "instance", durability: "transient",
      clockDomain: "none", contextInputs: [], effects: [],
    },
  } as const), /must use a presentation contract/);
  assert.throws(() => derive({
    id: "fixture.context-derived-truth",
    inputs: [contextPort("policy", contextContract)],
    outputs: [port("value", internalContract)],
    runtime: {
      stateOwner: "none", lifetime: "call", durability: "transient",
      clockDomain: "none", contextInputs: [], effects: [],
    },
  } as const), /context may tune a service but cannot become derived or presented truth/);
  assert.throws(() => present({
    id: "fixture.context-presented-truth",
    inputs: [contextPort("policy", contextContract)],
    outputs: [port("model", statusContract)],
    runtime: {
      stateOwner: "none", lifetime: "call", durability: "transient",
      clockDomain: "none", contextInputs: [], effects: [],
    },
  } as const), /context may tune a service but cannot become derived or presented truth/);

  assert.throws(() => fixture({
    components: [{ ...control, bindings: {
      ...control.bindings,
      inputs: { state: "ui.controller.state" },
    } }],
  }), /service 'ui.controller' cannot feed component 'control.main' directly; add a final present node/);

  assert.throws(() => fixture({
    nodes: [
      baseDeclaration.nodes[0],
      baseDeclaration.nodes[1],
      baseDeclaration.nodes[2],
      { id: "ui.first", nodeTypeRef: projection.id, config: {}, bindings: {
        state: "ui.controller.state",
      } },
      { id: "ui.projection", nodeTypeRef: projection.id, config: {}, bindings: {
        state: "ui.first.model",
      } },
    ],
  }), /make 'ui.first' derive - only the final node before a component may be present/);
});

test("closed state authority rejects incomplete, invented and overlapping presentation truths", () => {
  const operations = finiteValues("fixture.operation", ["idle", "fetching"]);
  const dataStates = finiteValues("fixture.data", ["missing", "available"]);
  const combinedStates = finiteProduct("fixture.operation-data", [operations, dataStates]);
  assert.deepEqual(combinedStates.values, [
    "idle.missing", "idle.available", "fetching.missing", "fetching.available",
  ]);
  const generatedCases = mapFiniteCases(combinedStates, (state) => ({
    label: state.toUpperCase(), tone: "muted", hint: state,
  }));
  assert.deepEqual(Object.keys(defineStatePresentation(combinedStates, {
    id: "fixture.generated-operation-data",
    fields: phasePresentation.fields,
    cases: generatedCases,
  }).cases), combinedStates.values);

  assert.throws(() => fixture({
    stateAuthorities: [{
      ...phaseAuthority,
      presentation: {
        ...phasePresentation,
        cases: { idle: { label: "IDLE", tone: "muted", hint: "Waiting" } },
      },
    }],
  }), /state presentation 'fixture.phase-signal' is missing case 'active'/);

  assert.throws(() => fixture({
    stateAuthorities: [{
      ...phaseAuthority,
      presentation: {
        ...phasePresentation,
        cases: {
          ...phasePresentation.cases,
          invented: { label: "INVENTED", tone: "warn", hint: "No" },
        },
      },
    }],
  }), /state presentation 'fixture.phase-signal' has extra case 'invented'/);

  assert.throws(() => fixture({
    stateAuthorities: [phaseAuthority, {
      ...phaseAuthority,
      id: "fixture.second-phase-authority",
      presentation: {
        ...phasePresentation,
        id: "fixture.second-phase-signal",
      },
    }],
  }), /duplicate state authority axis/);

  assert.throws(() => fixture({ stateAuthorities: [] }),
    /UI-reaching closed state 'ui.controller.state#phase' has no state authority/);

  assert.throws(() => defineStatePresentation(fixturePhases, {
    id: "fixture.empty-payload",
    fields: phasePresentation.fields,
    cases: { idle: {}, active: {} },
  } as never), /case 'idle' is missing field 'label', 'tone', 'hint'/);

  assert.throws(() => defineStatePresentation(fixturePhases, {
    id: "fixture.extra-payload",
    fields: phasePresentation.fields,
    cases: {
      idle: { label: "IDLE", tone: "muted", hint: "Waiting", invented: "NO" },
      active: { label: "ACTIVE", tone: "ok", hint: "Running" },
    },
  } as never), /case 'idle' has extra field 'invented'/);

  assert.throws(() => defineStatePresentation(fixturePhases, {
    id: "fixture.invalid-tone-runtime",
    fields: [statePresentationField("tone", fixtureTones)],
    cases: { idle: { tone: "muted" }, active: { tone: "invented" } },
  } as never), /case 'active' field 'tone' does not match its payload schema/);

  const alternatePhases = finiteValues("fixture.alternate-phase", ["quiet", "loud"]);
  const alternateContract = {
    id: "fixture.alternate-status",
    kind: "snapshot",
    boundary: "presentation",
    fields: [field("phase", finiteValueRef(alternatePhases.id))],
  } as const;
  const inventedState = derive({
    id: "fixture.invented-state",
    inputs: [port("raw", internalContract)],
    outputs: [port("state", alternateContract)],
    runtime: {
      stateOwner: "none", lifetime: "call", durability: "transient",
      clockDomain: "none", contextInputs: [], effects: [],
    },
  } as const);
  const ungovernedProjection = present({
    id: "fixture.ungoverned-projection",
    inputs: [
      port("state", statusContract),
      port("invented", alternateContract),
    ],
    outputs: [port("model", statusContract)],
    runtime: {
      stateOwner: "none", lifetime: "call", durability: "transient",
      clockDomain: "none", contextInputs: [], effects: [],
    },
  } as const);
  assert.throws(() => fixture({
    nodeTypes: [source, controller, phaseDefinition.adapter.type, inventedState, ungovernedProjection],
    nodes: [
      baseDeclaration.nodes[0],
      baseDeclaration.nodes[1],
      baseDeclaration.nodes[2],
      { id: "ui.invented", nodeTypeRef: inventedState.id, config: {}, bindings: { raw: "domain.source.status" } },
      { id: "ui.projection", nodeTypeRef: ungovernedProjection.id, config: {}, bindings: {
        state: "ui.controller.state",
        invented: "ui.invented.state",
      } },
    ],
    finiteValues: [fixturePhases, alternatePhases],
  }), /UI-reaching closed state 'ui.invented.state#phase' has no state authority/);

  const handwrittenCopyContract = {
    id: "fixture.handwritten-copy",
    kind: "snapshot",
    boundary: "presentation",
    fields: [field("label", "string")],
  } as const;
  const handwrittenCopy = present({
    id: "fixture.handwritten-copy",
    inputs: [
      port("state", statusContract),
      port("generated", phasePresentation.contract),
    ],
    outputs: [port("model", handwrittenCopyContract)],
    runtime: {
      stateOwner: "none", lifetime: "call", durability: "transient",
      clockDomain: "none", contextInputs: [], effects: [],
    },
  } as const);
  assert.throws(() => fixture({
    nodeTypes: [source, controller, phaseDefinition.adapter.type, handwrittenCopy],
    nodes: [
      baseDeclaration.nodes[0], baseDeclaration.nodes[1], baseDeclaration.nodes[2],
      { id: "ui.projection", nodeTypeRef: handwrittenCopy.id, config: {}, bindings: {
        state: "ui.controller.state",
        generated: phaseDefinition.presentationPortRef,
      } },
    ],
  }), /presentation-adapter' is present and feeds 'ui.projection'/);

  const duplicateProjection = present({
    id: "fixture.duplicate-projection",
    inputs: [
      port("primary", statusContract),
      port("duplicate", statusContract),
    ],
    outputs: [port("model", statusContract)],
    runtime: {
      stateOwner: "none", lifetime: "call", durability: "transient",
      clockDomain: "none", contextInputs: [], effects: [],
    },
  } as const);
  assert.throws(() => fixture({
    nodeTypes: [source, controller, phaseDefinition.adapter.type, duplicateProjection],
    nodes: [
      baseDeclaration.nodes[0],
      baseDeclaration.nodes[1],
      baseDeclaration.nodes[2],
      {
        id: "ui.projection", nodeTypeRef: duplicateProjection.id, config: {},
        bindings: {
          primary: "ui.controller.state", duplicate: "ui.controller.state",
        },
      },
    ],
  }), /at most one direct canonical input.*\(found 2\)/);

  const availabilityStates = finiteValues("fixture.position-availability", ["missing", "available"]);
  const availabilityContract = {
    id: "fixture.position-presentation",
    kind: "snapshot",
    boundary: "presentation",
    fields: [field("availability", finiteValueRef(availabilityStates.id))],
  } as const;
  const availabilityPresentation = defineStatePresentation(availabilityStates, {
    id: "fixture.position-availability-signal",
    fields: phasePresentation.fields,
    cases: {
      missing: { label: "MISSING", tone: "warn", hint: "No position" },
      available: { label: "AVAILABLE", tone: "ok", hint: "Position ready" },
    },
  });
  const availabilityDefinition = defineStateAuthority({
    id: "fixture.position-availability-authority",
    source: {
      portRef: "position.presentation.state", contract: availabilityContract,
      stateField: "availability", states: availabilityStates,
    },
    presentation: availabilityPresentation,
  });
  const descendantPhasePresentation = defineStatePresentation(fixturePhases, {
    id: "fixture.descendant-phase-signal",
    fields: phasePresentation.fields,
    cases: {
      idle: { label: "IDLE", tone: "muted", hint: "Waiting" },
      active: { label: "ACTIVE", tone: "ok", hint: "Running" },
    },
  });
  const descendantPhaseDefinition = defineStateAuthority({
    id: "fixture.descendant-phase-authority",
    source: {
      portRef: "flight.runtime.state", contract: statusContract,
      stateField: "phase", states: fixturePhases,
    },
    presentation: descendantPhasePresentation,
  });
  const positionPresentation = derive({
    id: "fixture.position-presentation-node",
    inputs: [port("raw", internalContract)],
    outputs: [port("state", availabilityContract)],
    runtime: {
      stateOwner: "none", lifetime: "call", durability: "transient",
      clockDomain: "none", contextInputs: [], effects: [],
    },
  } as const);
  const flightPhase = derive({
    id: "fixture.flight-phase-node",
    inputs: [port("position", availabilityContract)],
    outputs: [port("state", statusContract)],
    runtime: {
      stateOwner: "none", lifetime: "call", durability: "transient",
      clockDomain: "none", contextInputs: [], effects: [],
    },
  } as const);
  const independentProjection = present({
    id: "fixture.independent-projection",
    inputs: [
      port("position", availabilityContract),
      port("flight", statusContract),
    ],
    outputs: [port("model", statusContract)],
    runtime: {
      stateOwner: "none", lifetime: "call", durability: "transient",
      clockDomain: "none", contextInputs: [], effects: [],
    },
  } as const);
  const independentControlType = defineComponentType({
    id: "fixture.independent-control",
    requiredCapabilities: ["ui.menu"],
    inputs: [
      componentPort("model", statusContract),
      componentPort("availabilityPresentation", availabilityPresentation.contract),
      componentPort("phasePresentation", descendantPhasePresentation.contract),
    ],
    outputs: [],
  } as const);
  const independentControl = {
    id: "control.independent",
    componentTypeRef: independentControlType.id,
    bindings: {
      inputs: {
        model: "ui.independent.model",
        availabilityPresentation: availabilityDefinition.presentationPortRef,
        phasePresentation: descendantPhaseDefinition.presentationPortRef,
      },
      events: {},
    },
  } as const;
  const independentFamilies = defineScreenComponentFamilyRegistry([independentControl, basePageHost], [{
    screen: "MAIN",
    family: {
      id: "fixture.independent-main",
      trees: PORTABLE_SURFACE_CLASSES.map((surface) => ({
        surface,
        mounts: [
          { instance: independentControl.id, region: "primary" },
          { instance: basePageHost.id, region: "page-host" },
        ],
      })),
    },
  }] as const);
  const independentAxes = defineProduct({
    ...baseDeclaration,
    nodeTypes: [
      source, positionPresentation, flightPhase,
      availabilityDefinition.adapter.type, descendantPhaseDefinition.adapter.type,
      independentProjection, baseNavigationService,
    ],
    nodes: [
      baseDeclaration.nodes[0],
      { id: "position.presentation", nodeTypeRef: positionPresentation.id, config: {}, bindings: {
        raw: "domain.source.status",
      } },
      { id: "flight.runtime", nodeTypeRef: flightPhase.id, config: {}, bindings: {
        position: "position.presentation.state",
      } },
      availabilityDefinition.adapter.node,
      descendantPhaseDefinition.adapter.node,
      { id: "ui.independent", nodeTypeRef: independentProjection.id, config: {}, bindings: {
        position: "position.presentation.state",
        flight: "flight.runtime.state",
      } },
      baseDeclaration.nodes[4],
    ],
    finiteValues: [availabilityStates, fixturePhases],
    stateAuthorities: [availabilityDefinition.authority, descendantPhaseDefinition.authority],
    componentTypes: [independentControlType, basePageHostType],
    components: [independentControl, basePageHost],
    componentFamilies: independentFamilies,
  }, assetCatalog);
  for (const authority of independentAxes.stateAuthorities) {
    assert.equal(independentAxes.portRegistry.bindings.filter(({ to }) =>
      to === adapterFields(authority.adapter).inputPortRef).length, 1);
    assert.deepEqual(authority.presentation.consumers, [
      `control.independent.${authority.id === availabilityDefinition.authority.id
        ? "availabilityPresentation" : "phasePresentation"}`,
    ]);
  }

  const cacheStatsContract = {
    id: "fixture.map-cache-stats",
    kind: "snapshot",
    boundary: "presentation",
    fields: [field("entries", "integer")],
  } as const;
  const mapService = service({
    id: "fixture.map-service",
    inputs: [
      demandPort("demand", demandContract),
      port("guidance", availabilityContract),
    ],
    outputs: [port("cacheStats", cacheStatsContract)],
    runtime: {
      stateOwner: "instance", lifetime: "process", durability: "transient",
      clockDomain: "none", contextInputs: [], effects: ["fixture.map-cache-read"],
    },
  } as const);
  const positionProjection = present({
    id: "fixture.position-projection",
    inputs: [port("position", availabilityContract)],
    outputs: [port("model", availabilityContract)],
    runtime: {
      stateOwner: "none", lifetime: "call", durability: "transient",
      clockDomain: "none", contextInputs: [], effects: [],
    },
  } as const);
  const settingsProjection = present({
    id: "fixture.settings-projection",
    inputs: [port("cacheStats", cacheStatsContract)],
    outputs: [port("model", cacheStatsContract)],
    runtime: {
      stateOwner: "none", lifetime: "call", durability: "transient",
      clockDomain: "none", contextInputs: [], effects: [],
    },
  } as const);
  const positionControlType = defineComponentType({
    id: "fixture.position-control",
    requiredCapabilities: ["ui.menu"],
    inputs: [
      componentPort("model", availabilityContract),
      componentPort("availabilityPresentation", availabilityPresentation.contract),
    ],
    outputs: [],
  } as const);
  const settingsControlType = defineComponentType({
    id: "fixture.settings-control",
    requiredCapabilities: ["ui.menu"],
    inputs: [componentPort("model", cacheStatsContract)],
    outputs: [],
  } as const);
  const positionControl = {
    id: "control.position",
    componentTypeRef: positionControlType.id,
    bindings: { inputs: {
      model: "ui.position.model",
      availabilityPresentation: availabilityDefinition.presentationPortRef,
    }, events: {} },
  } as const;
  const settingsControl = {
    id: "control.settings",
    componentTypeRef: settingsControlType.id,
    bindings: { inputs: { model: "ui.settings.model" }, events: {} },
  } as const;
  const serviceBoundaryFamilies = defineScreenComponentFamilyRegistry(
    [positionControl, settingsControl, basePageHost],
    [{ screen: "MAIN", family: {
      id: "fixture.service-boundary-main",
      trees: PORTABLE_SURFACE_CLASSES.map((surface) => ({
        surface,
        mounts: [
          { instance: positionControl.id, region: "primary" },
          { instance: settingsControl.id, region: "secondary" },
          { instance: basePageHost.id, region: "page-host" },
        ],
      })),
    } }] as const,
  );
  const serviceBoundary = defineProduct({
    ...baseDeclaration,
    nodeTypes: [
      source, positionPresentation, availabilityDefinition.adapter.type,
      mapService, positionProjection, settingsProjection,
      baseNavigationService,
    ],
    nodes: [
      baseDeclaration.nodes[0],
      { id: "position.presentation", nodeTypeRef: positionPresentation.id, config: {}, bindings: {
        raw: "domain.source.status",
      } },
      availabilityDefinition.adapter.node,
      { id: "map.service", nodeTypeRef: mapService.id, config: {}, bindings: {
        guidance: "position.presentation.state",
      }, activation: { kind: "leased", port: "demand", lifecycleSources: [] } },
      { id: "ui.position", nodeTypeRef: positionProjection.id, config: {}, bindings: {
        position: "position.presentation.state",
      } },
      { id: "ui.settings", nodeTypeRef: settingsProjection.id, config: {}, bindings: {
        cacheStats: "map.service.cacheStats",
      } },
      baseDeclaration.nodes[4],
    ],
    finiteValues: [availabilityStates],
    stateAuthorities: [availabilityDefinition.authority],
    componentTypes: [positionControlType, settingsControlType, basePageHostType],
    components: [positionControl, settingsControl, basePageHost],
    componentFamilies: serviceBoundaryFamilies,
  }, assetCatalog);
  assert.deepEqual(serviceBoundary.stateAuthorities[0]?.presentation.consumers,
    ["control.position.availabilityPresentation"]);
  assert.equal(serviceBoundary.stateAuthorities[0]?.presentation.consumers.includes(
    "control.settings.availabilityPresentation"), false);

  const alternatePresentation = defineStatePresentation(alternatePhases, {
    id: "fixture.alternate-signal",
    fields: phasePresentation.fields,
    cases: {
      quiet: { label: "QUIET", tone: "muted", hint: "Waiting" },
      loud: { label: "LOUD", tone: "warn", hint: "Running" },
    },
  });
  const alternateState = derive({
    id: "fixture.alternate-state",
    inputs: [port("canonical", statusContract)],
    outputs: [port("state", alternateContract)],
    runtime: {
      stateOwner: "none", lifetime: "call", durability: "transient",
      clockDomain: "none", contextInputs: [], effects: [],
    },
  } as const);
  const alternateDefinition = defineStateAuthority({
    id: "fixture.alternate-authority",
    source: {
      portRef: "ui.invented.state", contract: alternateContract,
      stateField: "phase", states: alternatePhases,
    },
    presentation: alternatePresentation,
  });
  const competingProjection = present({
    id: "fixture.competing-projection",
    inputs: [
      port("state", statusContract),
      port("alternate", alternateContract),
    ],
    outputs: [port("model", statusContract)],
    runtime: {
      stateOwner: "none", lifetime: "call", durability: "transient",
      clockDomain: "none", contextInputs: [], effects: [],
    },
  } as const);
  const competingControlType = defineComponentType({
    ...controlType,
    inputs: [
      componentPort("state", statusContract),
      componentPort("phasePresentation", phasePresentation.contract),
      componentPort("alternatePresentation", alternatePresentation.contract),
    ],
  } as const);
  assert.throws(() => fixture({
    nodeTypes: [
      source, controller, phaseDefinition.adapter.type, alternateState,
      alternateDefinition.adapter.type, competingProjection,
    ],
    nodes: [
      baseDeclaration.nodes[0],
      baseDeclaration.nodes[1],
      baseDeclaration.nodes[2],
      { id: "ui.invented", nodeTypeRef: alternateState.id, config: {}, bindings: { canonical: "ui.controller.state" } },
      alternateDefinition.adapter.node,
      { id: "ui.projection", nodeTypeRef: competingProjection.id, config: {}, bindings: {
        state: "ui.controller.state",
        alternate: "ui.invented.state",
      } },
    ],
    finiteValues: [fixturePhases, alternatePhases],
    stateAuthorities: [phaseAuthority, alternateDefinition.authority],
    componentTypes: [competingControlType],
    components: [{
      ...control,
      componentTypeRef: competingControlType.id,
      bindings: { ...control.bindings, inputs: {
        state: "ui.projection.model",
        phasePresentation: phaseDefinition.presentationPortRef,
        alternatePresentation: alternateDefinition.presentationPortRef,
      } },
    }],
  }), /competing ancestor\/descendant state lineages consumed by component 'control.main'/);

  const inventedOutputProjection = present({
    id: "fixture.invented-output-projection",
    inputs: [
      port("state", statusContract),
    ],
    outputs: [port("model", alternateContract)],
    runtime: {
      stateOwner: "none", lifetime: "call", durability: "transient",
      clockDomain: "none", contextInputs: [], effects: [],
    },
  } as const);
  const alternateControlType = defineComponentType({
    ...controlType,
    inputs: [
      componentPort("state", alternateContract),
      componentPort("phasePresentation", phasePresentation.contract),
    ],
  } as const);
  assert.throws(() => fixture({
    nodeTypes: [source, controller, phaseDefinition.adapter.type, inventedOutputProjection],
    nodes: [
      baseDeclaration.nodes[0], baseDeclaration.nodes[1], baseDeclaration.nodes[2],
      { id: "ui.projection", nodeTypeRef: inventedOutputProjection.id, config: {}, bindings: {
        state: "ui.controller.state",
      } },
    ],
    finiteValues: [fixturePhases, alternatePhases],
    componentTypes: [alternateControlType],
    components: [{ ...control, componentTypeRef: alternateControlType.id }],
  }), /closed state 'fixture.alternate-phase' without exactly one generated state presentation/);
});

test("one mandatory graph compiles deterministic outputs and a complete port registry", async () => {
  const product = fixture();
  assert.equal(product.schemaVersion, 9);
  assert.deepEqual(product.stateAuthorities, [{
    ...phaseAuthority,
    presentation: { ...phasePresentation, consumers: ["control.main.phasePresentation"] },
  }]);
  assert.equal(product.nodes.length, 5);
  assert.deepEqual(product.portRegistry.contracts, [
    demandContract, internalContract, actionContract, statusContract, phasePresentation.contract,
    baseActivePageContract,
  ]);
  assert.deepEqual(product.portRegistry.bindings, [
    { kind: "node-input", from: "domain.source.status", to: "ui.controller.sourceState", purpose: "data" },
    { kind: "component-event", from: "control.main.activate", to: "ui.controller.trigger", purpose: "data" },
    { kind: "node-input", from: "ui.controller.state", to: `${adapterFields(phaseAuthority.adapter).nodeInstanceRef}.state`, purpose: "data" },
    { kind: "node-input", from: "ui.controller.state", to: "ui.projection.state", purpose: "data" },
    { kind: "component-input", from: "ui.projection.model", to: "control.main.state", purpose: "data" },
    { kind: "component-input", from: adapterFields(phaseAuthority.adapter).outputPortRef, to: "control.main.phasePresentation", purpose: "data" },
    { kind: "component-input", from: "navigation.service.activePage", to: "page.host.activePage", purpose: "data" },
  ]);
  assert.equal(product.portRegistry.demandEdges.length, 3);
  assert.deepEqual(new Set(product.portRegistry.demandEdges.map(({ nodeInstanceRef }) => nodeInstanceRef)),
    new Set(["domain.source"]));
  validateProductIconRendererBindings(product, [
    { iconRef: "status.check", assetRef: "check", rendererRef: "renderer.phone" },
    { iconRef: "status.check", assetRef: "check", rendererRef: "renderer.wear" },
  ]);

  const first = buildOutputManifest(product, [productJsonEmitter("fixture/product.json")], ["fixture"]);
  const second = buildOutputManifest(product, [productJsonEmitter("fixture/product.json")], ["fixture"]);
  assert.deepEqual(first, second);
  assert.equal(logOutputManifest(first), "product-json\tfixture/product.json");
  assert.match(first.artifacts[0]!.content, /"portRegistry"/);
  const root = await mkdtemp(resolve(tmpdir(), "product-spec-output-"));
  try {
    await writeOutputManifest(root, first);
    assert.deepEqual(await checkOutputManifest(root, first), []);
    await writeFile(resolve(root, "fixture/rogue.kt"), "stale", "utf8");
    assert.deepEqual(await checkOutputManifest(root, first), ["fixture/rogue.kt"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("page navigation compiles one RouteIntent and neutral action groups into the port graph", () => {
  const product = navigationFixture();
  assert.equal(product.navigation.pageValuesRef, `${navigationId}.page`);
  assert.deepEqual(product.navigation.pages, [
    { id: "MAIN", guardContractRef: null, back: "system" },
    { id: "DETAILS", guardContractRef: "fixture.session-ready", back: "previous" },
  ]);
  assert.deepEqual(product.navigation.artifacts, [
    {
      artifactRef: "phone", entryPageRef: "MAIN", pages: [
        { pageRef: "MAIN", restore: "root", guardContractRef: null, back: "system" },
        { pageRef: "DETAILS", restore: "process", guardContractRef: "fixture.session-ready", back: "previous" },
      ],
    },
    {
      artifactRef: "wear", entryPageRef: "MAIN", pages: [
        { pageRef: "MAIN", restore: "root", guardContractRef: null, back: "system" },
        { pageRef: "DETAILS", restore: "process", guardContractRef: "fixture.session-ready", back: "previous" },
      ],
    },
  ]);
  assert.deepEqual(product.navigation.routeIntentContract.navigation, { kind: "route", effect: "push" });
  assert.deepEqual(product.navigation.routeIntentContract.fields, [
    field("target", finiteValueRef(`${navigationId}.page`)),
  ]);
  assert.equal("targetPageRef" in product.navigation.routeIntentContract.navigation, false);
  assert.equal(product.navigation.activePagePortRef, "navigation.service.activePage");
  assert.equal(product.navigation.pageHostPortRef, "page.closed-host.activePage");
  assert.deepEqual(product.finiteValues.at(-1), {
    id: `${navigationId}.page`, values: ["MAIN", "DETAILS"],
  });
  assert.equal("menus" in product.navigation, false);
  assert.deepEqual(product.navigation.actionGroups, [
    {
      componentInstanceRef: "control.main",
      pageRefs: ["DETAILS", "MAIN"],
      artifactRefs: ["phone", "wear"],
      actions: [{
        id: "activate", kind: "event", sourcePortRef: "control.main.activate",
        targetPortRef: "ui.controller.trigger", contractRef: actionContract.id, effect: "dispatch",
      }],
    },
    {
      componentInstanceRef: "weather.card",
      pageRefs: ["MAIN"],
      artifactRefs: ["phone", "wear"],
      actions: [
        {
          id: "route", kind: "route", sourcePortRef: "weather.card.route",
          targetPortRef: "navigation.service.route", contractRef: routeIntentContract.id, effect: "push",
        },
        {
          id: "activate", kind: "event", sourcePortRef: "weather.card.activate",
          targetPortRef: "weather.event-sink.activate", contractRef: menuActivateContract.id, effect: "dispatch",
        },
      ],
    },
  ]);
});

test("route target contradiction is unrepresentable and service-origin route is rejected", () => {
  assert.deepEqual(Object.keys(routeIntentContract.navigation).sort(), ["effect", "kind"]);
  assert.throws(() => service({
    id: "fixture.illegal-route-origin",
    inputs: [], outputs: [port("route", routeIntentContract)],
    runtime: {
      stateOwner: "none", lifetime: "process", durability: "transient",
      clockDomain: "none", contextInputs: [], effects: ["fixture.route"],
    },
  } as const), /service 'fixture.illegal-route-origin' cannot originate ui-event output 'route'/);
});

test("navigation rejects an undeclared artifact entry", () => {
  assert.throws(() => navigationFixture({
    artifacts: [
      { ...navigationProductDeclaration.artifacts[0], entryScreen: "UNKNOWN" },
      navigationProductDeclaration.artifacts[1],
    ],
  }), /entry screen 'UNKNOWN' is not selected|missing entry screen 'UNKNOWN'|entry 'UNKNOWN' is an undeclared page/);
});

test("navigation derives restore independently for artifacts with different entries", () => {
  const product = navigationFixture({
    artifacts: [
      { ...navigationProductDeclaration.artifacts[0], screenRefs: ["MAIN"] },
      { ...navigationProductDeclaration.artifacts[1], entryScreen: "DETAILS" },
    ],
  });
  assert.deepEqual(product.navigation.artifacts.map(({ artifactRef, entryPageRef, pages }) => ({
    artifactRef, entryPageRef, restore: pages.map(({ pageRef, restore }) => `${pageRef}:${restore}`),
  })), [
    { artifactRef: "phone", entryPageRef: "MAIN", restore: ["MAIN:root"] },
    { artifactRef: "wear", entryPageRef: "DETAILS", restore: ["MAIN:process", "DETAILS:root"] },
  ]);
});

test("navigation mutation rejects an orphan page", () => {
  const orphanFamilies = [
    ...navigationFamilies,
    {
      screen: "ORPHAN",
      family: { ...navigationFamilies[1]!.family, id: "fixture.navigation-orphan" },
    },
  ] as const;
  const orphanNavigation = defineProductNavigation(orphanFamilies, {
    id: navigationId,
    pageSemantics: {
      MAIN: { guard: null, back: "system" },
      DETAILS: {
        guard: sessionGuardContract, back: "previous",
      },
      ORPHAN: { guard: null, back: "previous" },
    },
  } as const);
  assert.throws(() => navigationFixture({
    componentFamilies: orphanFamilies,
    navigation: orphanNavigation,
  }), /orphan page 'ORPHAN' is selected by no artifact/);
});

test("navigation mutation rejects an artifact page absent from component families", () => {
  assert.throws(() => navigationFixture({
    artifacts: [
      navigationProductDeclaration.artifacts[0],
      { ...navigationProductDeclaration.artifacts[1], screenRefs: ["MAIN", "UNKNOWN"] },
    ],
  }), /missing screen 'UNKNOWN'|undeclared page 'UNKNOWN'/);
});

test("a weather card becomes an actionGroup and a missing binding fails without opt-in", () => {
  assert.equal("actionGroups" in navigationDeclaration, false);
  assert.throws(() => navigationFixture({
    components: navigationProductDeclaration.components.map((component) =>
      component.id === navigationMenu.id ? {
        ...component,
        bindings: { ...component.bindings, events: { activate: "weather.event-sink.activate" } },
      } : component),
  }), /missing event binding 'route'/);
});

test("navigation rejects duplicate page-host presenters", () => {
  const duplicateHost = { ...pageHost, id: "page.duplicate-host" } as const;
  const duplicateFamilies = defineScreenComponentFamilyRegistry(
    [control, navigationMenu, pageHost, duplicateHost],
    navigationFamilies.map(({ screen, family }) => ({
      screen,
      family: {
        ...family,
        trees: family.trees.map((tree) => ({
          ...tree,
          mounts: [...tree.mounts, { instance: duplicateHost.id, region: "duplicate-host" }],
        })),
      },
    })) as never,
  );
  assert.throws(() => navigationFixture({
    components: [...navigationProductDeclaration.components, duplicateHost],
    componentFamilies: duplicateFamilies,
  }), /active page must bind exactly one page-host component input \(found 2\)/);
});

test("navigation mutation rejects a guard absent from the typed navigation-service graph", () => {
  const missingGuard = navigationGuardContract("fixture.missing-guard");
  assert.throws(() => navigationFixture({
    navigation: {
      ...navigationDeclaration,
      pages: navigationDeclaration.pages.map((page) =>
        page.id === "DETAILS" ? { ...page, guard: missingGuard } : page),
    },
  }), /guard 'fixture.missing-guard' must bind exactly one navigation service input/);
});

test("schema5 native navigation registration conforms exactly", () => {
  assert.deepEqual(navigationConformance(
    navigationFixture().navigation,
    new Set(["phone", "wear"]),
    nativeClosedNavigation,
  ), []);
});

test("schema5 navigation conformance rejects entry, back and guard drift", () => {
  const product = navigationFixture();
  const mutatePage = (
    change: (page: NativeNavigationBindingManifest["artifacts"][number]["pages"][number]) =>
      NativeNavigationBindingManifest["artifacts"][number]["pages"][number],
  ): NativeNavigationBindingManifest => ({
    ...nativeClosedNavigation,
    artifacts: nativeClosedNavigation.artifacts.map((artifact, index) => index === 0 ? {
      ...artifact,
      pages: artifact.pages.map((page, pageIndex) => pageIndex === 0 ? change(page) : page),
    } : artifact),
  });
  const changedEntry: NativeNavigationBindingManifest = {
    ...nativeClosedNavigation,
    artifacts: nativeClosedNavigation.artifacts.map((artifact, index) => index === 0
      ? { ...artifact, entryPageRef: "DETAILS" } : artifact),
  };
  for (const manifest of [
    changedEntry,
    mutatePage((page) => ({ ...page, back: "consume" })),
    mutatePage((page) => ({ ...page, guardContractRef: "native.invented-guard" })),
  ]) {
    assert.equal(navigationConformance(product.navigation, new Set(["phone", "wear"]), manifest)
      .some(({ axis, direction }) => axis === "navigation" && direction === "mismatch"), true);
  }
});

test("schema5 navigation conformance is two-way for actions and active-page bindings", () => {
  const product = navigationFixture();
  const expected = product.navigation;
  const host = new Set(["phone", "wear"]);
  const withoutAction: NativeNavigationBindingManifest = {
    ...nativeClosedNavigation,
    actionGroups: nativeClosedNavigation.actionGroups.map((group, index) => index === 0
      ? { ...group, actions: group.actions.slice(1) } : group),
  };
  const withExtraAction: NativeNavigationBindingManifest = {
    ...nativeClosedNavigation,
    actionGroups: nativeClosedNavigation.actionGroups.map((group, index) => index === 0 ? {
      ...group,
      actions: [...group.actions, {
        sourcePortRef: "weather.card.invented",
        targetPortRef: "weather.event-sink.activate",
        effect: "dispatch" as const,
      }],
    } : group),
  };
  const withoutPage: NativeNavigationBindingManifest = {
    ...nativeClosedNavigation,
    artifacts: nativeClosedNavigation.artifacts.map((artifact, index) => index === 0
      ? { ...artifact, pages: artifact.pages.slice(1) } : artifact),
  };
  const withExtraPage: NativeNavigationBindingManifest = {
    ...nativeClosedNavigation,
    artifacts: nativeClosedNavigation.artifacts.map((artifact, index) => index === 0 ? {
      ...artifact,
      pages: [...artifact.pages, {
        pageRef: "NATIVE_ONLY", restore: "process" as const,
        back: "previous" as const, guardContractRef: null,
      }],
    } : artifact),
  };
  const withoutActive = { ...nativeClosedNavigation, activePageBindings: [] };
  const duplicateActive = {
    ...nativeClosedNavigation,
    activePageBindings: [
      ...nativeClosedNavigation.activePageBindings,
      nativeClosedNavigation.activePageBindings[0]!,
    ],
  };
  const wrongPageHost = {
    ...nativeClosedNavigation,
    activePageBindings: [{
      publisherPortRef: "navigation.service.activePage",
      pageHostPortRef: "page.invented-host.activePage",
    }],
  };
  assert.equal(navigationConformance(expected, host, withoutAction).some(({ direction }) => direction === "missing"), true);
  assert.equal(navigationConformance(expected, host, withExtraAction).some(({ direction }) => direction === "orphan"), true);
  assert.equal(navigationConformance(expected, host, withoutPage).some(({ direction }) => direction === "missing"), true);
  assert.equal(navigationConformance(expected, host, withExtraPage).some(({ direction }) => direction === "orphan"), true);
  assert.equal(navigationConformance(expected, host, withoutActive).some(({ direction }) => direction === "missing"), true);
  assert.equal(navigationConformance(expected, host, duplicateActive).some(({ direction }) => direction === "mismatch"), true);
  const wrongHostFindings = navigationConformance(expected, host, wrongPageHost);
  assert.equal(wrongHostFindings.some(({ direction }) => direction === "missing"), true);
  assert.equal(wrongHostFindings.some(({ direction }) => direction === "orphan"), true);
});

test("demand ports propagate activation forward without becoming data dependencies", () => {
  const demandRoot = service({
    id: "fixture.demand-root",
    inputs: [],
    outputs: [demandPort("activate", demandContract)],
    runtime: {
      stateOwner: "none", lifetime: "process", durability: "transient",
      clockDomain: "none", contextInputs: [], effects: ["fixture.activation"],
    },
  } as const);
  const demandedSource = service({
    id: "fixture.demanded-source",
    inputs: [demandPort("demand", demandContract)],
    outputs: [port("status", statusContract)],
    runtime: {
      stateOwner: "instance", lifetime: "process", durability: "transient",
      clockDomain: "none", contextInputs: [], effects: ["fixture.source-read"],
    },
  } as const);
  const demandProjection = present({
    id: "fixture.demand-projection",
    inputs: [port("state", statusContract)],
    outputs: [port("model", statusContract)],
    runtime: {
      stateOwner: "instance", lifetime: "instance", durability: "transient",
      clockDomain: "none", contextInputs: [], effects: [],
    },
  } as const);
  const displayType = defineComponentType({
    id: "fixture.display",
    requiredCapabilities: [],
    inputs: [componentPort("state", statusContract)],
    outputs: [],
  } as const);
  const graph = compileProductGraph({
    nodeTypes: [demandRoot, demandedSource, demandProjection],
    nodes: [
      { id: "demand.root", nodeTypeRef: demandRoot.id, config: {}, bindings: {}, activation: {
        kind: "lifetime", lifecycleSources: ["app-active"],
      } },
      { id: "demanded.source", nodeTypeRef: demandedSource.id, config: {}, bindings: {
        demand: "demand.root.activate",
      }, activation: { kind: "leased", port: "demand", lifecycleSources: [] } },
      { id: "demand.projection", nodeTypeRef: demandProjection.id, config: {}, bindings: {
        state: "demanded.source.status",
      } },
    ],
    configs: [],
    componentTypes: [displayType],
    components: [{
      id: "display.main",
      componentTypeRef: displayType.id,
      bindings: { inputs: { state: "demand.projection.model" }, events: {} },
    }],
    mountedScopes: [{
      artifactRef: "phone", screenRef: "MAIN", surface: "compact",
      mountRef: "display.main", componentInstanceRef: "display.main",
    }],
  });
  assert.deepEqual(graph.portRegistry.bindings[0], {
    kind: "node-input",
    from: "demand.root.activate",
    to: "demanded.source.demand",
    purpose: "demand",
  });
  assert.deepEqual(graph.portRegistry.demandEdges.filter(({ kind }) => kind === "component-mount")
    .map(({ nodeInstanceRef, targetPortRef }) => [nodeInstanceRef, targetPortRef]),
  [["demanded.source", "demanded.source.demand"]]);
  assert.deepEqual(new Set(graph.portRegistry.demandEdges.filter(({ kind }) => kind === "lifecycle")
    .map(({ nodeInstanceRef }) => nodeInstanceRef)), new Set(["demanded.source"]));
  const dataTarget = service({
    ...demandedSource,
    id: "fixture.data-target",
    inputs: [demandPort("lifecycle", demandContract), port("demand", demandContract)],
  } as const);
  assert.throws(() => compileProductGraph({
    nodeTypes: [demandRoot, dataTarget, demandProjection],
    nodes: [
      { id: "demand.root", nodeTypeRef: demandRoot.id, config: {}, bindings: {}, activation: {
        kind: "lifetime", lifecycleSources: ["app-active"],
      } },
      { id: "data.target", nodeTypeRef: dataTarget.id, config: {}, bindings: {
        demand: "demand.root.activate",
      }, activation: { kind: "leased", port: "lifecycle", lifecycleSources: [] } },
      { id: "demand.projection", nodeTypeRef: demandProjection.id, config: {}, bindings: {
        state: "data.target.status",
      } },
    ],
    configs: [], componentTypes: [displayType],
    components: [{
      id: "display.main", componentTypeRef: displayType.id,
      bindings: { inputs: { state: "demand.projection.model" }, events: {} },
    }],
    mountedScopes: [{
      artifactRef: "phone", screenRef: "MAIN", surface: "compact",
      mountRef: "display.main", componentInstanceRef: "display.main",
    }],
  }), /incompatible ports/);
  assert.throws(() => demandPort("invalid", statusContract), /service-internal event contract/);
});

test("context ports are optional typed data and never contribute activation", () => {
  const contextSource = derive({
    id: "fixture.context-source",
    inputs: [],
    outputs: [contextPort("policy", contextContract)],
    runtime: {
      stateOwner: "instance", lifetime: "process", durability: "transient",
      clockDomain: "none", contextInputs: [], effects: [],
    },
  } as const);
  const contextualSource = service({
    id: "fixture.contextual-source",
    inputs: [demandPort("demand", demandContract), contextPort("context", contextContract)],
    outputs: [port("status", statusContract)],
    runtime: {
      stateOwner: "instance", lifetime: "process", durability: "transient",
      clockDomain: "none", contextInputs: [], effects: ["fixture.source-read"],
    },
  } as const);
  const contextProjection = present({
    id: "fixture.context-projection",
    inputs: [port("state", statusContract)],
    outputs: [port("model", statusContract)],
    runtime: {
      stateOwner: "instance", lifetime: "instance", durability: "transient",
      clockDomain: "none", contextInputs: [], effects: [],
    },
  } as const);
  const displayType = defineComponentType({
    id: "fixture.context-display",
    requiredCapabilities: [],
    inputs: [componentPort("state", statusContract)],
    outputs: [],
  } as const);
  const graph = compileProductGraph({
    nodeTypes: [contextSource, contextualSource, contextProjection],
    nodes: [
      { id: "context.source", nodeTypeRef: contextSource.id, config: {}, bindings: {} },
      { id: "contextual.source", nodeTypeRef: contextualSource.id, config: {}, bindings: {
        context: "context.source.policy",
      }, activation: { kind: "leased", port: "demand", lifecycleSources: [] } },
      { id: "context.projection", nodeTypeRef: contextProjection.id, config: {}, bindings: {
        state: "contextual.source.status",
      } },
    ],
    configs: [], componentTypes: [displayType],
    components: [{
      id: "context.display", componentTypeRef: displayType.id,
      bindings: { inputs: { state: "context.projection.model" }, events: {} },
    }],
    mountedScopes: [{
      artifactRef: "phone", screenRef: "MAIN", surface: "compact",
      mountRef: "context.display", componentInstanceRef: "context.display",
    }],
  });
  assert.deepEqual(graph.portRegistry.bindings[0], {
    kind: "node-input", from: "context.source.policy", to: "contextual.source.context", purpose: "context",
  });
  assert.deepEqual(graph.portRegistry.demandEdges.filter(({ kind }) => kind === "component-mount")
    .map(({ nodeInstanceRef }) => nodeInstanceRef), ["contextual.source"]);
  assert.equal(graph.portRegistry.nodePorts.find(({ ref }) => ref === "contextual.source.context")?.required, false);

  const withoutContextBinding = compileProductGraph({
    nodeTypes: [contextualSource, contextProjection],
    nodes: [{
      id: "contextual.source", nodeTypeRef: contextualSource.id,
      config: {}, bindings: {}, activation: { kind: "leased", port: "demand", lifecycleSources: [] },
    }, {
      id: "context.projection", nodeTypeRef: contextProjection.id,
      config: {}, bindings: { state: "contextual.source.status" },
    }],
    configs: [], componentTypes: [displayType],
    components: [{
      id: "context.display", componentTypeRef: displayType.id,
      bindings: { inputs: { state: "context.projection.model" }, events: {} },
    }],
    mountedScopes: [{
      artifactRef: "phone", screenRef: "MAIN", surface: "compact",
      mountRef: "context.display", componentInstanceRef: "context.display",
    }],
  });
  assert.equal(withoutContextBinding.portRegistry.bindings
    .some(({ to }) => to === "contextual.source.context"), false);
  assert.throws(() => contextPort("invalid", actionContract), /non-event service-internal contract/);
});

test("mandatory bindings and the component boundary fail before emission", () => {
  assert.throws(() => fixture({
    components: [{ ...control, bindings: { ...control.bindings, inputs: [] } }],
  }), /missing input binding 'state'/);
  assert.throws(() => fixture({
    components: [{ ...control, bindings: {
      ...control.bindings,
      inputs: { ...control.bindings.inputs, invented: "ui.controller.state" },
    } }],
  }), /binds extra input 'invented'/);
  assert.throws(() => fixture({
    components: [{ ...control, bindings: {
      ...control.bindings,
      events: { ...control.bindings.events, invented: "ui.controller.trigger" },
    } }],
  }), /binds extra event 'invented'/);
  assert.throws(() => fixture({
    components: [{ ...control, bindings: {
      ...control.bindings,
      inputs: { state: "control.main.activate" },
    } }],
  }), /incompatible ports/);
  assert.throws(() => defineComponentType({
    id: "fixture.leak",
    requiredCapabilities: [],
    inputs: [componentPort("internal", internalContract)],
    outputs: [],
  }), /uses service-internal contract/);
  assert.throws(() => fixture({
    nodes: [
      { id: "domain.source", nodeTypeRef: source.id, config: {}, bindings: {}, activation: {
        kind: "leased", port: "demand", lifecycleSources: [],
      } },
      { id: "ui.controller", nodeTypeRef: controller.id, config: {}, activation: {
        kind: "lifetime", lifecycleSources: [],
      }, bindings: {
        sourceState: "domain.source.status",
        trigger: "control.main.activate",
        invented: "domain.source.status",
      } },
      baseDeclaration.nodes[2],
      baseDeclaration.nodes[3],
    ],
  }), /binds extra input/);
  assert.throws(() => fixture({
    rendererBindings: [
      { id: "renderer.phone", capabilities: [] },
      { id: "renderer.wear", capabilities: ["ui.menu"] },
    ],
    artifacts: baseDeclaration.artifacts.map((artifact) => ({
      ...artifact,
      requiredCapabilities: [],
    })),
  }), /lacks required component 'control.main' capability 'ui.menu'/);
  assert.throws(() => defineScreenComponentFamilyRegistry([control], [{
    screen: "MAIN",
    family: {
      id: "fixture.unknown",
      // @ts-expect-error The mount ref is derived from the declared component instances.
      trees: PORTABLE_SURFACE_CLASSES.map((surface) => ({
        surface, mounts: [{ instance: "missing.instance", region: "primary" }],
      })),
    },
  }]), /unknown component instance 'missing.instance'/);

  const optionalType = defineComponentType({
    id: "fixture.optional",
    requiredCapabilities: ["ui.optional"],
    inputs: [],
    outputs: [],
  } as const);
  const optional = {
    id: "control.optional",
    componentTypeRef: optionalType.id,
    bindings: { inputs: {}, events: {} },
  } as const;
  const detailsType = defineComponentType({
    id: "fixture.details",
    requiredCapabilities: ["ui.details"],
    inputs: [],
    outputs: [],
  } as const);
  const details = {
    id: "details.main",
    componentTypeRef: detailsType.id,
    bindings: { inputs: {}, events: {} },
  } as const;
  const optionalFamilies = defineScreenComponentFamilyRegistry([control, optional, details, basePageHost], [
    {
      screen: "MAIN",
      family: {
        id: "fixture.main",
        trees: PORTABLE_SURFACE_CLASSES.map((surface) => ({
          surface,
          mounts: [
            { instance: control.id, region: "primary" },
            { instance: optional.id, region: "supporting", requirement: { kind: "optional", fallback: "omit" } },
            { instance: basePageHost.id, region: "page-host" },
          ],
        })),
      },
    },
    {
      screen: "DETAILS",
      family: {
        id: "fixture.details",
        trees: PORTABLE_SURFACE_CLASSES.map((surface) => ({
          surface,
          mounts: [
            { instance: details.id, region: "primary" },
            { instance: basePageHost.id, region: "page-host" },
          ],
        })),
      },
    },
  ] as const);
  const scoped = fixture({
    rendererBindings: [
      { id: "renderer.phone", capabilities: ["ui.menu"] },
      { id: "renderer.wear", capabilities: ["ui.menu", "ui.optional", "ui.details"] },
    ],
    artifacts: [
      { ...baseDeclaration.artifacts[0], screenRefs: ["MAIN"] },
      { ...baseDeclaration.artifacts[1], screenRefs: ["MAIN", "DETAILS"] },
    ],
    componentTypes: [controlType, optionalType, detailsType, basePageHostType],
    components: [control, optional, details, basePageHost],
    componentFamilies: optionalFamilies,
    navigation: defineProductNavigation(optionalFamilies, {
      id: "fixture.navigation",
      pageSemantics: {
        MAIN: { guard: null, back: "system" },
        DETAILS: { guard: null, back: "previous" },
      },
    } as const),
  });
  assert.deepEqual(scoped.artifactScopes
    .filter(({ artifactRef }) => artifactRef === "phone")
    .flatMap(({ omittedMounts }) => omittedMounts.map(({ mountRef }) => mountRef)),
  ["control.optional", "control.optional"]);
  assert.deepEqual(scoped.artifactScopes
    .filter(({ artifactRef }) => artifactRef === "wear")
    .flatMap(({ includedMounts }) => includedMounts.map(({ mountRef }) => mountRef)),
  ["control.main", "control.optional", "page.host", "details.main", "page.host"]);
  assert.deepEqual(scoped.artifactScopes
    .filter(({ artifactRef }) => artifactRef === "phone")
    .map(({ screenRef }) => screenRef),
  ["MAIN", "MAIN"]);
  const componentFindings = productArtifactConformance(scoped, {
    ...conformingManifest,
    components: [
      { componentId: "fixture.control", rendererId: "control", profiles: ["phone", "wear"] },
      { componentId: "fixture.optional", rendererId: "optional", profiles: ["wear"] },
      { componentId: "fixture.details", rendererId: "details", profiles: ["wear"] },
      { componentId: "fixture.page-host", rendererId: "page-host", profiles: ["phone", "wear"] },
    ],
  }).filter(({ axis }) => axis === "component");
  assert.deepEqual(componentFindings, []);
});

test("lifecycle demand crosses a lifetime origin and leases only its upstream target", () => {
  const graph = compileProductGraph({
    nodeTypes: [source, background],
    nodes: [
      { id: "domain.source", nodeTypeRef: source.id, config: {}, bindings: {}, activation: {
        kind: "leased", port: "demand", lifecycleSources: [],
      } },
      {
        id: "session.background",
        nodeTypeRef: background.id,
        config: {},
        bindings: { status: "domain.source.status" },
        activation: { kind: "lifetime", lifecycleSources: ["app-active", "session-active"] },
      },
    ],
    configs: [],
    componentTypes: [],
    components: [],
    mountedScopes: [],
  });
  assert.deepEqual(graph.portRegistry.demandEdges, [
    {
      kind: "lifecycle", source: "app-active", rootNodeInstanceRef: "session.background",
      nodeInstanceRef: "domain.source",
      targetPortRef: "domain.source.demand",
    },
    {
      kind: "lifecycle", source: "session-active", rootNodeInstanceRef: "session.background",
      nodeInstanceRef: "domain.source",
      targetPortRef: "domain.source.demand",
    },
  ]);
  const decorativeLifetime = service({
    id: "fixture.decorative-lifetime",
    inputs: [],
    outputs: [],
    runtime: {
      stateOwner: "none", lifetime: "process", durability: "transient",
      clockDomain: "none", contextInputs: [], effects: ["fixture.decorative"],
    },
  } as const);
  assert.throws(() => compileProductGraph({
    nodeTypes: [decorativeLifetime],
    nodes: [{
      id: "decorative.lifetime", nodeTypeRef: decorativeLifetime.id, config: {}, bindings: {},
      activation: { kind: "lifetime", lifecycleSources: ["app-active"] },
    }],
    configs: [], componentTypes: [], components: [], mountedScopes: [],
  }), /lifecycle source 'app-active' reaches no leased service/);
  assert.throws(() => compileProductGraph({
    nodeTypes: [noDemandSource],
    nodes: [{
      id: "domain.source", nodeTypeRef: noDemandSource.id, config: {}, bindings: {},
      activation: { kind: "leased", port: "demand", lifecycleSources: [] },
    }],
    configs: [], componentTypes: [], components: [], mountedScopes: [],
  }), /has no demand input and must use lifetime activation/);
  const ambiguous = service({
    ...source,
    id: "fixture.ambiguous-demand",
    inputs: [demandPort("first", demandContract), demandPort("second", demandContract)],
  } as const);
  assert.throws(() => compileProductGraph({
    nodeTypes: [ambiguous],
    nodes: [{
      id: "domain.source", nodeTypeRef: ambiguous.id, config: {}, bindings: {},
      activation: { kind: "leased", port: "first", lifecycleSources: ["app-active"] },
    }],
    configs: [], componentTypes: [], components: [], mountedScopes: [],
  }), /declares ambiguous demand inputs/);
});

const conformingManifest: NativeBindingManifest = {
  stage: "native-export",
  schemaVersion: 5,
  sourceFile: "fixture/NativeBindings.kt",
  profiles: ["phone", "wear"],
  components: [
    { componentId: "fixture.control", rendererId: "renderer.phone", profiles: ["phone"] },
    { componentId: "fixture.control", rendererId: "renderer.wear", profiles: ["wear"] },
    { componentId: "fixture.page-host", rendererId: "page-host", profiles: ["phone", "wear"] },
  ],
  icons: [{ iconId: "check", nativeSymbol: "Check" }],
  nodes: [
    { nodeId: "domain.source", nativePortId: "SourcePorts", profiles: ["phone", "wear"], inputPorts: ["demand"], outputPorts: ["status"] },
    { nodeId: "ui.controller", nativePortId: "ControllerPorts", profiles: ["phone", "wear"], inputPorts: ["sourceState", "trigger"], outputPorts: ["state"] },
    { nodeId: "ui.projection", nativePortId: "ProjectionPorts", profiles: ["phone", "wear"], inputPorts: ["state"], outputPorts: ["model"] },
    {
      nodeId: "fixture.phase-authority.presentation-adapter",
      nativePortId: "FixturePhasePresentationAdapterPorts",
      profiles: ["phone", "wear"],
      inputPorts: ["state"],
      outputPorts: ["presentation"],
    },
    {
      nodeId: "navigation.service", nativePortId: "NavigationPorts", profiles: ["phone", "wear"],
      inputPorts: [], outputPorts: ["activePage"],
    },
  ],
  finiteValues: [
    { id: "fixture.phase", values: ["idle", "active"] },
    { id: "fixture.navigation.page", values: ["MAIN"] },
  ],
  navigation: {
    artifacts: [
      {
        artifactRef: "phone", entryPageRef: "MAIN",
        pages: [{ pageRef: "MAIN", restore: "root", back: "system", guardContractRef: null }],
      },
      {
        artifactRef: "wear", entryPageRef: "MAIN",
        pages: [{ pageRef: "MAIN", restore: "root", back: "system", guardContractRef: null }],
      },
    ],
    activePageBindings: [{
      publisherPortRef: "navigation.service.activePage", pageHostPortRef: "page.host.activePage",
    }],
    actionGroups: ["phone", "wear"].map((artifactRef) => ({
      artifactRef,
      componentInstanceRef: "control.main",
      actions: [{
        sourcePortRef: "control.main.activate",
        targetPortRef: "ui.controller.trigger",
        effect: "dispatch" as const,
      }],
    })),
  },
};

const mutate = (change: (draft: NativeBindingManifest) => NativeBindingManifest): NativeBindingManifest =>
  change(structuredClone(conformingManifest) as NativeBindingManifest);

test("a conforming native manifest reports nothing", () => {
  const product = fixture();
  assert.equal(product.artifactScopes.filter(({ artifactRef }) => artifactRef === "phone").length, 2);
  assert.deepEqual(productArtifactConformance(product, conformingManifest), []);
});

const AXIS_MUTATIONS: readonly {
  axis: ConformanceAxis;
  direction: ConformanceDirection;
  subject: string;
  change: (draft: NativeBindingManifest) => NativeBindingManifest;
}[] = [
  { axis: "artifact", direction: "orphan", subject: "toaster", change: (d) => ({ ...d, profiles: [...d.profiles!, "toaster"] }) },
  { axis: "node-port", direction: "missing", subject: "ui.projection", change: (d) => ({
    ...d,
    nodes: d.nodes.filter((node) => node.nodeId !== "ui.projection"),
  }) },
  { axis: "node-port", direction: "orphan", subject: "native.orphan", change: (d) => ({
    ...d,
    nodes: [...d.nodes, {
      nodeId: "native.orphan", nativePortId: "OrphanPorts", profiles: ["phone"],
      inputPorts: [], outputPorts: [],
    }],
  }) },
  { axis: "node-port", direction: "missing", subject: "ui.controller.sourceState", change: (d) => ({
    ...d,
    nodes: d.nodes.map((node) => node.nodeId === "ui.controller"
      ? { ...node, inputPorts: node.inputPorts.filter((port) => port !== "sourceState") }
      : node),
  }) },
  { axis: "node-port", direction: "orphan", subject: "ui.controller.invented", change: (d) => ({
    ...d,
    nodes: d.nodes.map((node) => node.nodeId === "ui.controller"
      ? { ...node, inputPorts: [...node.inputPorts, "invented"] }
      : node),
  }) },
  { axis: "node-port", direction: "missing", subject: "ui.controller.state", change: (d) => ({
    ...d,
    nodes: d.nodes.map((node) => node.nodeId === "ui.controller"
      ? { ...node, outputPorts: node.outputPorts.filter((port) => port !== "state") }
      : node),
  }) },
  { axis: "node-port", direction: "orphan", subject: "ui.controller.inventedOutput", change: (d) => ({
    ...d,
    nodes: d.nodes.map((node) => node.nodeId === "ui.controller"
      ? { ...node, outputPorts: [...node.outputPorts, "inventedOutput"] }
      : node),
  }) },
  { axis: "node-port", direction: "mismatch", subject: "ui.controller.state", change: (d) => ({
    ...d,
    nodes: d.nodes.map((node) => node.nodeId === "ui.controller"
      ? { ...node, outputPorts: [...node.outputPorts, "state"] }
      : node),
  }) },
  { axis: "component", direction: "mismatch", subject: "fixture.control@phone", change: (d) => ({
    ...d, components: [...d.components, { componentId: "fixture.control", rendererId: "renderer.phone", profiles: ["phone"] }],
  }) },
  { axis: "icon", direction: "missing", subject: "check", change: (d) => ({ ...d, icons: [] }) },
  { axis: "finite-value", direction: "mismatch", subject: "fixture.phase", change: (d) => ({
    ...d, finiteValues: [{ id: "fixture.phase", values: ["idle"] }],
  }) },
];

for (const { axis, direction, subject, change } of AXIS_MUTATIONS) {
  test(`conformance catches a ${direction} ${axis}`, () => {
    const finding = productArtifactConformance(fixture(), mutate(change))
      .find((item) => item.axis === axis && item.direction === direction && item.subject === subject);
    assert.equal(finding?.subject, subject);
  });
}

test("the hard gate and host coverage keep their two directions", () => {
  assert.throws(() => assertProductArtifactConformance(
    fixture(), mutate((d) => ({ ...d, profiles: [...d.profiles!, "toaster"], icons: [] })),
  ), /artifact\/orphan[\s\S]*icon\/missing/);
  const android = { ...conformingManifest, profiles: ["phone"] };
  assert.deepEqual(productArtifactHostCoverage(fixture(), [android]).map(({ subject }) => subject), ["wear"]);
  assert.deepEqual(productArtifactHostCoverage(fixture(), [android, { ...conformingManifest, profiles: ["wear"] }]), []);
});

test("one host checks only its component profiles while host coverage checks the fleet", () => {
  const renderers = [
    ...baseDeclaration.rendererBindings,
    { id: "renderer.iphone", capabilities: ["ui.menu"] },
    { id: "renderer.watchos", capabilities: ["ui.menu"] },
    { id: "renderer.garmin", capabilities: ["ui.menu"] },
  ] as const;
  const extraArtifacts = [
    { id: "iphone", rendererRefs: ["renderer.iphone"], requiredCapabilities: ["ui.menu"], entryScreen: "MAIN", screenRefs: ["MAIN"], serves: ["compact"] },
    { id: "watchos", rendererRefs: ["renderer.watchos"], requiredCapabilities: ["ui.menu"], entryScreen: "MAIN", screenRefs: ["MAIN"], serves: ["round"] },
    { id: "garmin", rendererRefs: ["renderer.garmin"], requiredCapabilities: ["ui.menu"], entryScreen: "MAIN", screenRefs: ["MAIN"], serves: ["round"] },
  ] as const;
  const product = fixture({
    rendererBindings: renderers,
    artifacts: [...baseDeclaration.artifacts, ...extraArtifacts],
    iconRefs: [{ ...baseDeclaration.iconRefs[0], artifacts: ["phone", "wear", "iphone", "watchos", "garmin"] }],
  });
  const android = conformingManifest;
  const host = (sourceFile: string, profiles: readonly string[]): NativeBindingManifest => ({
    ...conformingManifest,
    sourceFile,
    profiles,
    components: [
      { componentId: "fixture.control", rendererId: sourceFile, profiles },
      { componentId: "fixture.page-host", rendererId: "page-host", profiles },
    ],
    nodes: conformingManifest.nodes.map((node) => ({ ...node, profiles })),
    navigation: {
      ...conformingManifest.navigation,
      artifacts: profiles.map((artifactRef) => ({
        artifactRef, entryPageRef: "MAIN",
        pages: [{ pageRef: "MAIN", restore: "root" as const, back: "system" as const, guardContractRef: null }],
      })),
      actionGroups: profiles.map((artifactRef) => ({
        artifactRef,
        componentInstanceRef: "control.main",
        actions: [{
          sourcePortRef: "control.main.activate",
          targetPortRef: "ui.controller.trigger",
          effect: "dispatch" as const,
        }],
      })),
    },
  });
  const apple = host("fixture/AppleBindings.swift", ["iphone", "watchos"]);
  const garmin = host("fixture/GarminBindings.mc", ["garmin"]);

  assert.deepEqual(productArtifactConformance(product, android), []);
  assert.deepEqual(productArtifactConformance(product, apple), []);
  assert.deepEqual(productArtifactConformance(product, garmin), []);
  assert.deepEqual(
    productArtifactHostCoverage(product, [android]).map(({ subject }) => subject),
    ["garmin", "iphone", "watchos"],
  );
  assert.deepEqual(productArtifactHostCoverage(product, [android, apple, garmin]), []);
});

test("native manifest decoding fails loud and requires the node axis", () => {
  assert.throws(() => decodeNativeBindingManifest({ ...conformingManifest, stage: "draft" }), /not a compiled native export/);
  assert.throws(() => decodeNativeBindingManifest({ ...conformingManifest, schemaVersion: 1 }), /schema 1 is unsupported/);
  const partial = { ...conformingManifest } as Record<string, unknown>;
  delete partial.nodes;
  assert.throws(() => decodeNativeBindingManifest(partial), /manifest nodes must be an array/);
  const withoutNavigation = { ...conformingManifest } as Record<string, unknown>;
  delete withoutNavigation.navigation;
  assert.throws(() => decodeNativeBindingManifest(withoutNavigation), /manifest navigation must be an object/);
});

test("visual contracts still fail on unknown palette and asset refs", () => {
  assert.throws(() => fixture({
    iconRefs: [{ ...baseDeclaration.iconRefs[0], assetRef: "missing" }],
  }), /uses missing asset/);
  assert.throws(() => fixture({
    iconRefs: [{ ...baseDeclaration.iconRefs[0], accent: "status.unknown" }],
  }), /uses missing palette token/);
});
