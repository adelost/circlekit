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
  defineLegoSpec,
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

const source = defineLegoSpec({
  id: "fixture.source",
  role: "source",
  inputs: [demandPort("demand", demandContract)],
  outputs: [port("status", statusContract)],
  runtime: {
    stateOwner: "none", lifetime: "process", durability: "transient",
    clockDomain: "none", contextInputs: [], effects: [],
  },
} as const);
const noDemandSource = defineLegoSpec({
  ...source,
  id: "fixture.no-demand-source",
  inputs: [],
} as const);
const controller = defineLegoSpec({
  id: "fixture.controller",
  role: "adapter",
  inputs: [
    port("sourceState", statusContract),
    port("trigger", actionContract),
  ],
  outputs: [port("state", statusContract)],
  runtime: {
    stateOwner: "instance", lifetime: "instance", durability: "transient",
    clockDomain: "none", contextInputs: [], effects: ["fixture.effect"],
  },
} as const);
const background = defineLegoSpec({
  id: "fixture.background",
  role: "consumer",
  inputs: [port("status", statusContract)],
  outputs: [],
  runtime: {
    stateOwner: "instance", lifetime: "instance", durability: "transient",
    clockDomain: "none", contextInputs: [], effects: [],
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
    inputs: { state: "ui.controller.state" },
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
  serviceTypes: [source, controller],
  services: [
    { id: "domain.source", serviceTypeRef: source.id, config: {}, bindings: {}, activation: {
      kind: "leased", port: "demand", lifecycleSources: [],
    } },
    { id: "ui.controller", serviceTypeRef: controller.id, config: {}, activation: {
      kind: "lifetime", lifecycleSources: [],
    }, bindings: {
      sourceState: "domain.source.status",
      trigger: "control.main.activate",
    } },
  ],
  configs: [],
  finiteValues: [finiteValues("fixture.phase", ["idle", "active"])],
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
  defineProduct({ ...baseDeclaration, services: [
    baseDeclaration.services[0],
    // @ts-expect-error Every required service input has an exact binding.
    { ...baseDeclaration.services[1], bindings: {
      trigger: "control.main.activate",
    } },
  ] }, assetCatalog);
  defineProduct({ ...baseDeclaration, services: [
    baseDeclaration.services[0],
    { ...baseDeclaration.services[1], bindings: {
      ...baseDeclaration.services[1].bindings,
      // @ts-expect-error The source ref is derived from mounted service/component outputs.
      sourceState: "invented.output",
    } },
  ] }, assetCatalog);
  defineProduct({ ...baseDeclaration, components: [{
    ...control,
    bindings: {
      ...control.bindings,
      // @ts-expect-error Component binding names are derived from the selected ComponentType.
      inputs: { invented: "ui.controller.state" },
    },
  }] }, assetCatalog);
  defineProduct({ ...baseDeclaration, serviceTypes: [noDemandSource, controller], services: [
    { id: "domain.source", serviceTypeRef: noDemandSource.id, config: {}, bindings: {}, activation: {
      // @ts-expect-error A service without a demand input is structurally lifetime, never leased.
      kind: "leased", port: "demand", lifecycleSources: ["app-active"],
    } },
    baseDeclaration.services[1],
  ] }, assetCatalog);
}

test("one mandatory graph compiles deterministic outputs and a complete port registry", async () => {
  const product = fixture();
  assert.equal(product.schemaVersion, 6);
  assert.equal(product.services.length, 2);
  assert.deepEqual(product.portRegistry.contracts, [demandContract, statusContract, actionContract]);
  assert.deepEqual(product.portRegistry.bindings, [
    { kind: "service-input", from: "domain.source.status", to: "ui.controller.sourceState", purpose: "data" },
    { kind: "component-event", from: "control.main.activate", to: "ui.controller.trigger", purpose: "data" },
    { kind: "component-input", from: "ui.controller.state", to: "control.main.state", purpose: "data" },
  ]);
  assert.equal(product.portRegistry.demandEdges.length, 3);
  assert.deepEqual(new Set(product.portRegistry.demandEdges.map(({ serviceInstanceRef }) => serviceInstanceRef)),
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
  const demandRoot = defineLegoSpec({
    id: "fixture.demand-root",
    role: "policy",
    inputs: [],
    outputs: [demandPort("activate", demandContract)],
    runtime: {
      stateOwner: "none", lifetime: "process", durability: "transient",
      clockDomain: "none", contextInputs: [], effects: [],
    },
  } as const);
  const demandedSource = defineLegoSpec({
    id: "fixture.demanded-source",
    role: "source",
    inputs: [demandPort("demand", demandContract)],
    outputs: [port("status", statusContract)],
    runtime: {
      stateOwner: "instance", lifetime: "process", durability: "transient",
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
    serviceTypes: [demandRoot, demandedSource],
    services: [
      { id: "demand.root", serviceTypeRef: demandRoot.id, config: {}, bindings: {}, activation: {
        kind: "lifetime", lifecycleSources: ["app-active"],
      } },
      { id: "demanded.source", serviceTypeRef: demandedSource.id, config: {}, bindings: {
        demand: "demand.root.activate",
      }, activation: { kind: "leased", port: "demand", lifecycleSources: [] } },
    ],
    configs: [],
    componentTypes: [displayType],
    components: [{
      id: "display.main",
      componentTypeRef: displayType.id,
      bindings: { inputs: { state: "demanded.source.status" }, events: {} },
    }],
    mountedScopes: [{
      artifactRef: "phone", screenRef: "MAIN", surface: "compact",
      mountRef: "display.main", componentInstanceRef: "display.main",
    }],
  });
  assert.deepEqual(graph.portRegistry.bindings[0], {
    kind: "service-input",
    from: "demand.root.activate",
    to: "demanded.source.demand",
    purpose: "demand",
  });
  assert.deepEqual(graph.portRegistry.demandEdges.filter(({ kind }) => kind === "component-mount")
    .map(({ serviceInstanceRef, targetPortRef }) => [serviceInstanceRef, targetPortRef]),
  [["demanded.source", "demanded.source.demand"]]);
  assert.deepEqual(new Set(graph.portRegistry.demandEdges.filter(({ kind }) => kind === "lifecycle")
    .map(({ serviceInstanceRef }) => serviceInstanceRef)), new Set(["demanded.source"]));
  const dataTarget = defineLegoSpec({
    ...demandedSource,
    id: "fixture.data-target",
    inputs: [demandPort("lifecycle", demandContract), port("demand", demandContract)],
  } as const);
  assert.throws(() => compileProductGraph({
    serviceTypes: [demandRoot, dataTarget],
    services: [
      { id: "demand.root", serviceTypeRef: demandRoot.id, config: {}, bindings: {}, activation: {
        kind: "lifetime", lifecycleSources: ["app-active"],
      } },
      { id: "data.target", serviceTypeRef: dataTarget.id, config: {}, bindings: {
        demand: "demand.root.activate",
      }, activation: { kind: "leased", port: "lifecycle", lifecycleSources: [] } },
    ],
    configs: [], componentTypes: [displayType],
    components: [{
      id: "display.main", componentTypeRef: displayType.id,
      bindings: { inputs: { state: "data.target.status" }, events: {} },
    }],
    mountedScopes: [{
      artifactRef: "phone", screenRef: "MAIN", surface: "compact",
      mountRef: "display.main", componentInstanceRef: "display.main",
    }],
  }), /incompatible ports/);
  assert.throws(() => demandPort("invalid", statusContract), /service-internal event contract/);
});

test("context ports are optional typed data and never contribute activation", () => {
  const contextSource = defineLegoSpec({
    id: "fixture.context-source",
    role: "policy",
    inputs: [],
    outputs: [contextPort("policy", contextContract)],
    runtime: {
      stateOwner: "instance", lifetime: "process", durability: "transient",
      clockDomain: "none", contextInputs: [], effects: [],
    },
  } as const);
  const contextualSource = defineLegoSpec({
    id: "fixture.contextual-source",
    role: "source",
    inputs: [demandPort("demand", demandContract), contextPort("context", contextContract)],
    outputs: [port("status", statusContract)],
    runtime: {
      stateOwner: "instance", lifetime: "process", durability: "transient",
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
    serviceTypes: [contextSource, contextualSource],
    services: [
      { id: "context.source", serviceTypeRef: contextSource.id, config: {}, bindings: {}, activation: {
        kind: "lifetime", lifecycleSources: [],
      } },
      { id: "contextual.source", serviceTypeRef: contextualSource.id, config: {}, bindings: {
        context: "context.source.policy",
      }, activation: { kind: "leased", port: "demand", lifecycleSources: [] } },
    ],
    configs: [], componentTypes: [displayType],
    components: [{
      id: "context.display", componentTypeRef: displayType.id,
      bindings: { inputs: { state: "contextual.source.status" }, events: {} },
    }],
    mountedScopes: [{
      artifactRef: "phone", screenRef: "MAIN", surface: "compact",
      mountRef: "context.display", componentInstanceRef: "context.display",
    }],
  });
  assert.deepEqual(graph.portRegistry.bindings[0], {
    kind: "service-input", from: "context.source.policy", to: "contextual.source.context", purpose: "context",
  });
  assert.deepEqual(graph.portRegistry.demandEdges.filter(({ kind }) => kind === "component-mount")
    .map(({ serviceInstanceRef }) => serviceInstanceRef), ["contextual.source"]);
  assert.equal(graph.portRegistry.servicePorts.find(({ ref }) => ref === "contextual.source.context")?.required, false);

  const withoutContextBinding = compileProductGraph({
    serviceTypes: [contextualSource],
    services: [{
      id: "contextual.source", serviceTypeRef: contextualSource.id,
      config: {}, bindings: {}, activation: { kind: "leased", port: "demand", lifecycleSources: [] },
    }],
    configs: [], componentTypes: [displayType],
    components: [{
      id: "context.display", componentTypeRef: displayType.id,
      bindings: { inputs: { state: "contextual.source.status" }, events: {} },
    }],
    mountedScopes: [{
      artifactRef: "phone", screenRef: "MAIN", surface: "compact",
      mountRef: "context.display", componentInstanceRef: "context.display",
    }],
  });
  assert.equal(withoutContextBinding.portRegistry.bindings.length, 1);
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
    services: [
      { id: "domain.source", serviceTypeRef: source.id, config: {}, bindings: {}, activation: {
        kind: "leased", port: "demand", lifecycleSources: [],
      } },
      { id: "ui.controller", serviceTypeRef: controller.id, config: {}, activation: {
        kind: "lifetime", lifecycleSources: [],
      }, bindings: {
        sourceState: "domain.source.status",
        trigger: "control.main.activate",
        invented: "domain.source.status",
      } },
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
    serviceTypes: [source, background],
    services: [
      { id: "domain.source", serviceTypeRef: source.id, config: {}, bindings: {}, activation: {
        kind: "leased", port: "demand", lifecycleSources: [],
      } },
      {
        id: "session.background",
        serviceTypeRef: background.id,
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
      kind: "lifecycle", source: "app-active", rootServiceInstanceRef: "session.background",
      serviceInstanceRef: "domain.source",
      targetPortRef: "domain.source.demand",
    },
    {
      kind: "lifecycle", source: "session-active", rootServiceInstanceRef: "session.background",
      serviceInstanceRef: "domain.source",
      targetPortRef: "domain.source.demand",
    },
  ]);
  const decorativeLifetime = defineLegoSpec({
    id: "fixture.decorative-lifetime",
    role: "adapter",
    inputs: [],
    outputs: [],
    runtime: {
      stateOwner: "none", lifetime: "process", durability: "transient",
      clockDomain: "none", contextInputs: [], effects: [],
    },
  } as const);
  assert.throws(() => compileProductGraph({
    serviceTypes: [decorativeLifetime],
    services: [{
      id: "decorative.lifetime", serviceTypeRef: decorativeLifetime.id, config: {}, bindings: {},
      activation: { kind: "lifetime", lifecycleSources: ["app-active"] },
    }],
    configs: [], componentTypes: [], components: [], mountedScopes: [],
  }), /lifecycle source 'app-active' reaches no leased service/);
  assert.throws(() => compileProductGraph({
    serviceTypes: [noDemandSource],
    services: [{
      id: "domain.source", serviceTypeRef: noDemandSource.id, config: {}, bindings: {},
      activation: { kind: "leased", port: "demand", lifecycleSources: [] },
    }],
    configs: [], componentTypes: [], components: [], mountedScopes: [],
  }), /has no demand input and must use lifetime activation/);
  const ambiguous = defineLegoSpec({
    ...source,
    id: "fixture.ambiguous-demand",
    inputs: [demandPort("first", demandContract), demandPort("second", demandContract)],
  } as const);
  assert.throws(() => compileProductGraph({
    serviceTypes: [ambiguous],
    services: [{
      id: "domain.source", serviceTypeRef: ambiguous.id, config: {}, bindings: {},
      activation: { kind: "leased", port: "first", lifecycleSources: ["app-active"] },
    }],
    configs: [], componentTypes: [], components: [], mountedScopes: [],
  }), /declares ambiguous demand inputs/);
});

const conformingManifest: NativeBindingManifest = {
  stage: "native-export",
  schemaVersion: 2,
  sourceFile: "fixture/NativeBindings.kt",
  profiles: ["phone", "wear"],
  components: [
    { componentId: "fixture.control", rendererId: "renderer.phone", profiles: ["phone"] },
    { componentId: "fixture.control", rendererId: "renderer.wear", profiles: ["wear"] },
  ],
  icons: [{ iconId: "check", nativeSymbol: "Check" }],
  services: [
    { serviceId: "domain.source", nativePortId: "SourcePorts", profiles: ["phone", "wear"], inputPorts: ["demand"], outputPorts: ["status"] },
    { serviceId: "ui.controller", nativePortId: "ControllerPorts", profiles: ["phone", "wear"], inputPorts: ["sourceState", "trigger"], outputPorts: ["state"] },
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
  { axis: "service-port", direction: "orphan", subject: "ui.controller.invented", change: (d) => ({
    ...d,
    services: d.services!.map((service) => service.serviceId === "ui.controller"
      ? { ...service, inputPorts: [...service.inputPorts, "invented"] }
      : service),
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
  delete partial.services;
  const decoded = decodeNativeBindingManifest(partial);
  assert.equal(decoded.services, undefined);
  assert.deepEqual(productArtifactConformance(fixture(), decoded)
    .filter(({ axis }) => axis === "service-port").map(({ direction }) => direction), ["unasserted"]);
});

test("visual contracts still fail on unknown palette and asset refs", () => {
  assert.throws(() => fixture({
    iconRefs: [{ ...baseDeclaration.iconRefs[0], assetRef: "missing" }],
  }), /uses missing asset/);
  assert.throws(() => fixture({
    iconRefs: [{ ...baseDeclaration.iconRefs[0], accent: "status.unknown" }],
  }), /uses missing palette token/);
});
