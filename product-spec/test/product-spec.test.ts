import assert from "node:assert/strict";
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
  defineScreenComponentFamilyRegistry,
  field,
  finiteValueRef,
  finiteValues,
  logOutputManifest,
  PORTABLE_SURFACE_CLASSES,
  port,
  productArtifactConformance,
  productArtifactHostCoverage,
  productJsonEmitter,
  present,
  service,
  validateProductNodeType,
  validateProductIconRendererBindings,
  writeOutputManifest,
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
const controlType = defineComponentType({
  id: "fixture.control",
  requiredCapabilities: ["ui.menu"],
  inputs: [componentPort("state", statusContract)],
  outputs: [componentPort("activate", actionContract)],
} as const);
const control = {
  id: "control.main",
  componentTypeRef: controlType.id,
  bindings: {
    inputs: { state: "ui.projection.model" },
    events: { activate: "ui.controller.trigger" },
  },
} as const;
const componentFamilies = defineScreenComponentFamilyRegistry([control], [{
  screen: "MAIN",
  family: {
    id: "fixture.main",
    trees: PORTABLE_SURFACE_CLASSES.map((surface) => ({
      surface,
      mounts: [{ instance: control.id, region: "primary" }],
    })),
  },
}] as const);

const phasePresentation = defineStatePresentation(fixturePhases, {
  id: "fixture.phase-signal",
  cases: {
    idle: { label: "IDLE", tone: "muted" },
    active: { label: "ACTIVE", tone: "ok" },
  },
});
const phaseAuthority = defineStateAuthority({
  id: "fixture.phase-authority",
  source: {
    portRef: "ui.controller.state",
    contract: statusContract,
    stateField: "phase",
    states: fixturePhases,
  },
  presentation: phasePresentation,
});

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
  nodeTypes: [source, controller, projection],
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
    { id: "ui.projection", nodeTypeRef: projection.id, config: {}, bindings: {
      state: "ui.controller.state",
    } },
  ],
  configs: [],
  finiteValues: [fixturePhases],
  stateAuthorities: [phaseAuthority],
  componentTypes: [controlType],
  components: [control],
  componentFamilies,
  palette,
  assetCatalogRef: { id: assetCatalog.id, version: assetCatalog.version },
  iconRefs: [{ id: "status.check", assetRef: "check", accent: "status.ok", artifacts: ["phone", "wear"] }],
} as const;

function fixture(overrides: Record<string, unknown> = {}) {
  return defineProduct({ ...baseDeclaration, ...overrides }, assetCatalog);
}

if (false) {
  defineProduct({ ...baseDeclaration, nodes: [
    baseDeclaration.nodes[0],
    // @ts-expect-error Every required node input has an exact binding.
    { ...baseDeclaration.nodes[1], bindings: {
      trigger: "control.main.activate",
    } },
    baseDeclaration.nodes[2],
  ] }, assetCatalog);
  defineProduct({ ...baseDeclaration, nodes: [
    baseDeclaration.nodes[0],
    { ...baseDeclaration.nodes[1], bindings: {
      ...baseDeclaration.nodes[1].bindings,
      // @ts-expect-error The source ref is derived from declared node/component outputs.
      sourceState: "invented.output",
    } },
    baseDeclaration.nodes[2],
  ] }, assetCatalog);
  defineProduct({ ...baseDeclaration, components: [{
    ...control,
    bindings: {
      ...control.bindings,
      // @ts-expect-error Component binding names are derived from the selected ComponentType.
      inputs: { invented: "ui.projection.model" },
    },
  }] }, assetCatalog);
  defineProduct({ ...baseDeclaration, nodeTypes: [noDemandSource, controller, projection], nodes: [
    { id: "domain.source", nodeTypeRef: noDemandSource.id, config: {}, bindings: {}, activation: {
      // @ts-expect-error A service without a demand input is structurally lifetime, never leased.
      kind: "leased", port: "demand", lifecycleSources: ["app-active"],
    } },
    baseDeclaration.nodes[1],
    baseDeclaration.nodes[2],
  ] }, assetCatalog);

  // @ts-expect-error A service must prove that it owns at least one runtime effect.
  service({ ...source, runtime: { ...source.runtime, effects: [] } } as const);
  // @ts-expect-error A derive node cannot own an external effect.
  derive({ ...projection, runtime: { ...projection.runtime, effects: ["fixture.effect"] } } as const);

  defineStatePresentation(fixturePhases, {
    id: "fixture.missing-phase",
    // @ts-expect-error Every canonical state must have presentation data.
    cases: { idle: { label: "IDLE" } },
  });
  defineStatePresentation(fixturePhases, {
    id: "fixture.extra-phase",
    cases: {
      idle: { label: "IDLE" },
      active: { label: "ACTIVE" },
      // @ts-expect-error A presentation cannot invent a state outside the canonical space.
      invented: { label: "INVENTED" },
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
      { id: "ui.first", nodeTypeRef: projection.id, config: {}, bindings: { state: "ui.controller.state" } },
      { id: "ui.projection", nodeTypeRef: projection.id, config: {}, bindings: { state: "ui.first.model" } },
    ],
  }), /make 'ui.first' derive - only the final node before a component may be present/);
});

test("closed state authority rejects incomplete, invented and overlapping presentation truths", () => {
  assert.throws(() => fixture({
    stateAuthorities: [{
      ...phaseAuthority,
      presentation: {
        ...phasePresentation,
        cases: { idle: { label: "IDLE", tone: "muted" } },
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
          invented: { label: "INVENTED", tone: "warn" },
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
  }), /duplicate state authority source/);

  assert.throws(() => fixture({ stateAuthorities: [] }),
    /service 'ui.controller' UI-reaching closed state 'ui.controller.state' has no state authority/);

  const relay = derive({
    id: "fixture.phase-relay",
    inputs: [port("state", statusContract)],
    outputs: [port("state", statusContract)],
    runtime: {
      stateOwner: "none", lifetime: "call", durability: "transient",
      clockDomain: "none", contextInputs: [], effects: [],
    },
  } as const);
  assert.throws(() => fixture({
    nodeTypes: [source, controller, relay, projection],
    nodes: [
      baseDeclaration.nodes[0],
      baseDeclaration.nodes[1],
      { id: "ui.relay", nodeTypeRef: relay.id, config: {}, bindings: { state: "ui.controller.state" } },
      { id: "ui.projection", nodeTypeRef: projection.id, config: {}, bindings: { state: "ui.relay.state" } },
    ],
  }), /present 'ui.projection'.*exactly one direct input from canonical source 'ui.controller.state' \(found 0\)/);

  const duplicateProjection = present({
    id: "fixture.duplicate-projection",
    inputs: [port("primary", statusContract), port("duplicate", statusContract)],
    outputs: [port("model", statusContract)],
    runtime: {
      stateOwner: "none", lifetime: "call", durability: "transient",
      clockDomain: "none", contextInputs: [], effects: [],
    },
  } as const);
  assert.throws(() => fixture({
    nodeTypes: [source, controller, duplicateProjection],
    nodes: [
      baseDeclaration.nodes[0],
      baseDeclaration.nodes[1],
      {
        id: "ui.projection", nodeTypeRef: duplicateProjection.id, config: {},
        bindings: { primary: "ui.controller.state", duplicate: "ui.controller.state" },
      },
    ],
  }), /present 'ui.projection'.*exactly one direct input from canonical source 'ui.controller.state' \(found 2\)/);

  const splitController = service({
    ...controller,
    id: "fixture.split-controller",
    outputs: [port("state", statusContract), port("otherState", statusContract)],
  } as const);
  const splitProjection = present({
    ...duplicateProjection,
    id: "fixture.split-projection",
    inputs: [port("state", statusContract), port("otherState", statusContract)],
  } as const);
  assert.throws(() => fixture({
    nodeTypes: [source, splitController, splitProjection],
    nodes: [
      baseDeclaration.nodes[0],
      {
        id: "ui.controller", nodeTypeRef: splitController.id, config: {},
        activation: { kind: "lifetime", lifecycleSources: [] },
        bindings: { sourceState: "domain.source.status", trigger: "control.main.activate" },
      },
      {
        id: "ui.projection", nodeTypeRef: splitProjection.id, config: {},
        bindings: { state: "ui.controller.state", otherState: "ui.controller.otherState" },
      },
    ],
  }), /service 'ui.controller' exposes multiple UI-reaching closed state outputs/);
});

test("one mandatory graph compiles deterministic outputs and a complete port registry", async () => {
  const product = fixture();
  assert.equal(product.schemaVersion, 8);
  assert.deepEqual(product.stateAuthorities, [{
    ...phaseAuthority,
    presentation: { ...phasePresentation, consumers: ["ui.projection.state"] },
  }]);
  assert.equal(product.nodes.length, 3);
  assert.deepEqual(product.portRegistry.contracts, [demandContract, internalContract, actionContract, statusContract]);
  assert.deepEqual(product.portRegistry.bindings, [
    { kind: "node-input", from: "domain.source.status", to: "ui.controller.sourceState", purpose: "data" },
    { kind: "component-event", from: "control.main.activate", to: "ui.controller.trigger", purpose: "data" },
    { kind: "node-input", from: "ui.controller.state", to: "ui.projection.state", purpose: "data" },
    { kind: "component-input", from: "ui.projection.model", to: "control.main.state", purpose: "data" },
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
  const optionalFamilies = defineScreenComponentFamilyRegistry([control, optional, details], [
    {
      screen: "MAIN",
      family: {
        id: "fixture.main",
        trees: PORTABLE_SURFACE_CLASSES.map((surface) => ({
          surface,
          mounts: [
            { instance: control.id, region: "primary" },
            { instance: optional.id, region: "supporting", requirement: { kind: "optional", fallback: "omit" } },
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
          mounts: [{ instance: details.id, region: "primary" }],
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
    componentTypes: [controlType, optionalType, detailsType],
    components: [control, optional, details],
    componentFamilies: optionalFamilies,
  });
  assert.deepEqual(scoped.artifactScopes
    .filter(({ artifactRef }) => artifactRef === "phone")
    .flatMap(({ omittedMounts }) => omittedMounts.map(({ mountRef }) => mountRef)),
  ["control.optional", "control.optional"]);
  assert.deepEqual(scoped.artifactScopes
    .filter(({ artifactRef }) => artifactRef === "wear")
    .flatMap(({ includedMounts }) => includedMounts.map(({ mountRef }) => mountRef)),
  ["control.main", "control.optional", "details.main"]);
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
  schemaVersion: 3,
  sourceFile: "fixture/NativeBindings.kt",
  profiles: ["phone", "wear"],
  components: [
    { componentId: "fixture.control", rendererId: "renderer.phone", profiles: ["phone"] },
    { componentId: "fixture.control", rendererId: "renderer.wear", profiles: ["wear"] },
  ],
  icons: [{ iconId: "check", nativeSymbol: "Check" }],
  nodes: [
    { nodeId: "domain.source", nativePortId: "SourcePorts", profiles: ["phone", "wear"], inputPorts: ["demand"], outputPorts: ["status"] },
    { nodeId: "ui.controller", nativePortId: "ControllerPorts", profiles: ["phone", "wear"], inputPorts: ["sourceState", "trigger"], outputPorts: ["state"] },
    { nodeId: "ui.projection", nativePortId: "ProjectionPorts", profiles: ["phone", "wear"], inputPorts: ["state"], outputPorts: ["model"] },
  ],
  finiteValues: [{ id: "fixture.phase", values: ["idle", "active"] }],
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
  { axis: "node-port", direction: "orphan", subject: "ui.controller.invented", change: (d) => ({
    ...d,
    nodes: d.nodes!.map((node) => node.nodeId === "ui.controller"
      ? { ...node, inputPorts: [...node.inputPorts, "invented"] }
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
      .find((item) => item.axis === axis && item.direction === direction);
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

test("native manifest decoding fails loud and preserves unasserted sections", () => {
  assert.throws(() => decodeNativeBindingManifest({ ...conformingManifest, stage: "draft" }), /not a compiled native export/);
  assert.throws(() => decodeNativeBindingManifest({ ...conformingManifest, schemaVersion: 1 }), /schema 1 is unsupported/);
  const partial = { ...conformingManifest } as Record<string, unknown>;
  delete partial.nodes;
  const decoded = decodeNativeBindingManifest(partial);
  assert.equal(decoded.nodes, undefined);
  assert.deepEqual(productArtifactConformance(fixture(), decoded)
    .filter(({ axis }) => axis === "node-port").map(({ direction }) => direction), ["unasserted"]);
});

test("visual contracts still fail on unknown palette and asset refs", () => {
  assert.throws(() => fixture({
    iconRefs: [{ ...baseDeclaration.iconRefs[0], assetRef: "missing" }],
  }), /uses missing asset/);
  assert.throws(() => fixture({
    iconRefs: [{ ...baseDeclaration.iconRefs[0], accent: "status.unknown" }],
  }), /uses missing palette token/);
});
