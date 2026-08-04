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
  configField,
  configInput,
  defineScreenComponentFamilyRegistry,
  productArtifactConformance,
  productArtifactHostCoverage,
  defineLegoSpec,
  definePalette,
  definePortableAssetCatalog,
  defineProduct,
  defineProductLegoConfig,
  field,
  finiteValueRef,
  finiteValues,
  logOutputManifest,
  mount,
  PORTABLE_SURFACE_CLASSES,
  port,
  productJsonEmitter,
  validateProductIconRendererBindings,
  writeOutputManifest,
} from "../src/index.js";

const statusContract = {
  id: "fixture.status",
  kind: "state",
  fields: [field("active", "boolean"), field("phase", finiteValueRef("fixture.phase"))],
} as const;
const actionContract = {
  id: "fixture.action",
  kind: "event",
  fields: [],
} as const;
const source = defineLegoSpec({
  id: "fixture.source",
  role: "source",
  inputs: [],
  outputs: [port("status", statusContract)],
  runtime: {
    stateOwner: "none",
    lifetime: "process",
    durability: "transient",
    clockDomain: "none",
    contextInputs: [],
    effects: [],
  },
} as const);
const controller = defineLegoSpec({
  id: "fixture.controller",
  role: "adapter",
  inputs: [port("sourceState", statusContract), port("trigger", actionContract)],
  outputs: [port("state", statusContract)],
  runtime: {
    stateOwner: "instance",
    lifetime: "instance",
    durability: "transient",
    clockDomain: "none",
    contextInputs: [],
    effects: ["fixture.effect"],
  },
} as const);
const mounts = [mount("domain.source", source), mount("ui.controller", controller)] as const;
const componentCatalog = [{ id: "fixture.control" }] as const;
const componentFamilies = defineScreenComponentFamilyRegistry(componentCatalog, [{
  screen: "MAIN",
  family: {
    id: "fixture.main",
    trees: PORTABLE_SURFACE_CLASSES.map((surface) => ({
      surface,
      mounts: [{ component: "fixture.control", region: "primary" }],
    })),
  },
}] as const);
const paletteVariant = {
  id: "default",
  identity: { primary: "#ffffff" },
  categories: [{ id: "sky", hex: "#55aadd", meaning: "sky context" }],
  status: { ok: "#55aa55", caution: "#ddaa33", danger: "#dd5555" },
  ramps: [{
    id: "wind",
    kind: "safety-envelope",
    unit: "m/s",
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
    id: "check",
    viewport: { width: 24, height: 24 },
    paths: [{ kind: "stroke", pathData: "M20 6L9 17l-5 -5", strokeWidth: 3.2 }],
  }],
} as const);
const visualDeclaration = {
  palette,
  assetCatalogRef: { id: assetCatalog.id, version: assetCatalog.version },
  iconRefs: [{ id: "status.check", assetRef: "check", accent: "status.ok", artifacts: ["phone", "wear"] }],
} as const;
const visualDeclarationWithoutIcons = { ...visualDeclaration, iconRefs: [] } as const;

function fixture(overrides: Record<string, unknown> = {}) {
  return defineProduct({
    id: "fixture",
    rendererBindings: [
      { id: "renderer.phone", capabilities: ["ui.menu"] },
      { id: "renderer.wear", capabilities: ["ui.menu"] },
    ],
    artifacts: [
      { id: "phone", rendererRefs: ["renderer.phone"], requiredCapabilities: ["ui.menu"], entryScreen: "MAIN", serves: ["compact", "wide"] },
      { id: "wear", rendererRefs: ["renderer.wear"], requiredCapabilities: ["ui.menu"], entryScreen: "MAIN", serves: ["round"] },
    ],
    legos: {
      id: "fixture.graph",
      configs: [],
      mounts,
      wiring: [{ from: "domain.source.status", to: "ui.controller.sourceState" }],
    },
    finiteValues: [finiteValues("fixture.phase", ["idle", "active"])],
    componentCatalog,
    componentFamilies,
    ...visualDeclaration,
    ui: [{
      id: "menu.control",
      kind: "menu-entry",
      artifacts: ["phone", "wear"],
      requiredCapabilities: ["ui.menu"],
      ports: { state: "ui.controller.state", action: "ui.controller.trigger" },
    }],
    ...overrides,
  }, assetCatalog);
}

test("one ProductSpec compiles two artifact profiles and deterministic outputs", async () => {
  const product = fixture();
  assert.equal(product.schemaVersion, 5);
  assert.equal(product.legos.mounts.length, 2);
  assert.deepEqual(product.legos.contracts, [statusContract, actionContract]);
  assert.deepEqual(product.artifacts.map(({ id }) => id), ["phone", "wear"]);
  validateProductIconRendererBindings(product, [
    { iconRef: "status.check", assetRef: "check", rendererRef: "renderer.phone" },
    { iconRef: "status.check", assetRef: "check", rendererRef: "renderer.wear" },
  ]);

  const first = buildOutputManifest(product, [productJsonEmitter("fixture/product.json")], ["fixture"]);
  const second = buildOutputManifest(product, [productJsonEmitter("fixture/product.json")], ["fixture"]);
  assert.deepEqual(first, second);
  assert.equal(logOutputManifest(first), "product-json\tfixture/product.json");
  assert.match(first.artifacts[0]!.content, /"kind": "product-spec-ir"/);
  const recoloured = fixture({
    iconRefs: [{ ...visualDeclaration.iconRefs[0], accent: "status.caution" }],
  });
  const recolouredOutput = buildOutputManifest(recoloured, [productJsonEmitter("fixture/product.json")], ["fixture"]);
  assert.notEqual(recolouredOutput.artifacts[0]!.content, first.artifacts[0]!.content);
  assert.match(recolouredOutput.artifacts[0]!.content, /"accent": "status.caution"/);

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

test("graph, capability and port failures stop before emission", () => {
  assert.doesNotThrow(() => fixture({ palette: { variants: [] }, iconRefs: [] }));
  assert.throws(() => fixture({
    palette: { variants: [] },
    iconRefs: [{ ...visualDeclaration.iconRefs[0], accent: "status.caution" }],
  }), /uses missing palette token/);

  assert.throws(() => fixture({
    artifacts: [
      { id: "phone", rendererRefs: ["renderer.phone"], requiredCapabilities: ["ui.missing"], entryScreen: "MAIN", serves: ["compact", "wide"] },
      { id: "wear", rendererRefs: ["renderer.wear"], requiredCapabilities: ["ui.menu"], entryScreen: "MAIN", serves: ["round"] },
    ],
  }), /lacks capability 'ui.missing'/);

  assert.throws(() => fixture({ ui: [] }), /orphan input port 'ui.controller.trigger'/);
  assert.throws(() => fixture({ finiteValues: [] }), /uses unknown finite value 'fixture.phase'/);
  assert.throws(() => fixture({
    finiteValues: [
      finiteValues("fixture.phase", ["idle", "active"]),
      finiteValues("fixture.orphan", ["unknown"]),
    ],
  }), /orphan finite value declaration 'fixture.orphan'/);

  const configured = defineLegoSpec({
    id: "fixture.configured",
    role: "consumer",
    inputs: [],
    outputs: [],
    configInputs: [configInput("policy", [
      configField("windowMs", "integer", { unit: "si.millisecond", positive: true }),
      configField("unverifiedWindowMs", "integer", {
        unit: "si.millisecond", gteField: "windowMs",
      }),
      configField("spreadM", "number", { unit: "si.meter", min: 0 }),
    ])],
    runtime: {
      stateOwner: "none", lifetime: "call", durability: "transient",
      clockDomain: "none", contextInputs: [], effects: [],
    },
  } as const);
  assert.doesNotThrow(() => defineProductLegoConfig({
    id: "configured",
    configs: [{
      id: "fixture.policy",
      values: { windowMs: 10_000, unverifiedWindowMs: 20_000, spreadM: 2 },
    }],
    mounts: [mount("configured.consumer", configured, { policy: "fixture.policy" })],
    wiring: [],
  }));
  assert.throws(() => defineProductLegoConfig({
    id: "configured",
    configs: [{
      id: "fixture.policy",
      values: { windowMs: "ten", unverifiedWindowMs: 20_000, spreadM: 2 },
    }],
    mounts: [mount("configured.consumer", configured, { policy: "fixture.policy" })],
    wiring: [],
  }), /field 'windowMs' must be integer/);
  assert.throws(() => defineProductLegoConfig({
    id: "configured",
    configs: [{
      id: "fixture.policy",
      values: { windowMs: -1, unverifiedWindowMs: 20_000, spreadM: 2 },
    }],
    mounts: [mount("configured.consumer", configured, { policy: "fixture.policy" })],
    wiring: [],
  }), /field 'windowMs' must be positive/);
  assert.throws(() => defineProductLegoConfig({
    id: "configured",
    configs: [{
      id: "fixture.policy",
      values: { windowMs: 10_000, unverifiedWindowMs: 9_999, spreadM: 2 },
    }],
    mounts: [mount("configured.consumer", configured, { policy: "fixture.policy" })],
    wiring: [],
  }), /field 'unverifiedWindowMs' must be at least field 'windowMs'/);

  assert.throws(() => fixture({
    artifacts: [{
      id: "phone", rendererRefs: ["renderer.phone"], requiredCapabilities: ["ui.menu"],
      entryScreen: "MISSING", serves: ["compact"],
    }],
    iconRefs: [],
  }), /uses missing entry screen 'MISSING'/);
  assert.throws(() => fixture({
    artifacts: [{
      id: "phone", rendererRefs: ["renderer.phone"], requiredCapabilities: ["ui.menu"],
      entryScreen: "MAIN", serves: ["other"],
    }],
    iconRefs: [],
  }), /has no 'other' tree/);

  assert.throws(() => fixture({
    componentCatalog: [...componentCatalog, { id: "fixture.orphan" }],
  }), /orphan component 'fixture.orphan'/);

  const loop = defineLegoSpec({
    id: "fixture.loop",
    role: "adapter",
    inputs: [port("input", statusContract)],
    outputs: [port("output", statusContract)],
    runtime: {
      stateOwner: "none", lifetime: "call", durability: "transient",
      clockDomain: "none", contextInputs: [], effects: [],
    },
  } as const);
  const loopMounts = [mount("loop.first", loop), mount("loop.second", loop)] as const;
  assert.throws(() => defineProduct({
    id: "loop",
    rendererBindings: [{ id: "renderer.test", capabilities: [] }],
    artifacts: [{ id: "test", rendererRefs: ["renderer.test"], requiredCapabilities: [], entryScreen: "MAIN", serves: ["round"] }],
    legos: {
      id: "loop.graph",
      configs: [],
      mounts: loopMounts,
      wiring: [
        { from: "loop.first.output", to: "loop.second.input" },
        { from: "loop.second.output", to: "loop.first.input" },
      ],
    },
    finiteValues: [finiteValues("fixture.phase", ["idle", "active"])],
    componentCatalog,
    componentFamilies,
    ...visualDeclarationWithoutIcons,
    ui: [],
  }, assetCatalog), /wiring cycle/);

  const conflictingStatusContract = {
    id: statusContract.id,
    kind: "state",
    fields: [field("label", "string")],
  } as const;
  const conflictingSource = defineLegoSpec({
    ...source,
    id: "fixture.conflicting-source",
    outputs: [port("status", conflictingStatusContract)],
  } as const);
  assert.throws(() => defineProduct({
    id: "contract-conflict",
    rendererBindings: [{ id: "renderer.test", capabilities: [] }],
    artifacts: [{ id: "test", rendererRefs: ["renderer.test"], requiredCapabilities: [], entryScreen: "MAIN", serves: ["round"] }],
    legos: {
      id: "contract-conflict.graph",
      configs: [],
      mounts: [mount("source.first", source), mount("source.second", conflictingSource)],
      wiring: [],
    },
    finiteValues: [finiteValues("fixture.phase", ["idle", "active"])],
    componentCatalog,
    componentFamilies,
    ...visualDeclarationWithoutIcons,
    ui: [
      { id: "first", kind: "component-entry", artifacts: ["test"], requiredCapabilities: [], ports: { state: "source.first.status" } },
      { id: "second", kind: "component-entry", artifacts: ["test"], requiredCapabilities: [], ports: { state: "source.second.status" } },
    ],
  }, assetCatalog), /contract 'fixture.status' has conflicting schemas/);

  assert.throws(() => defineScreenComponentFamilyRegistry([], [{
    screen: "MAIN",
    family: {
      id: "missing.component",
      trees: PORTABLE_SURFACE_CLASSES.map((surface) => ({
        surface,
        mounts: [{ component: "not.in.catalog", region: "primary" }],
      })),
    },
  }]), /uses unknown component 'not.in.catalog'/);

  assert.throws(() => fixture({
    iconRefs: [{ ...visualDeclaration.iconRefs[0], assetRef: "missing" }],
  }), /uses missing asset 'missing'/);
  assert.throws(() => fixture({
    iconRefs: [{ ...visualDeclaration.iconRefs[0], accent: "status.unknown" }],
  }), /uses missing palette token 'status.unknown'/);
  assert.throws(() => validateProductIconRendererBindings(fixture(), [
    { iconRef: "status.check", assetRef: "check", rendererRef: "renderer.phone" },
  ]), /missing renderer binding/);
  assert.throws(() => validateProductIconRendererBindings(fixture(), [
    { iconRef: "status.check", assetRef: "check", rendererRef: "renderer.phone" },
    { iconRef: "status.check", assetRef: "check", rendererRef: "renderer.wear" },
    { iconRef: "status.orphan", assetRef: "check", rendererRef: "renderer.phone" },
  ]), /orphan renderer binding/);

  assert.throws(() => definePortableAssetCatalog({
    ...assetCatalog,
    icons: [{ ...assetCatalog.icons[0], paths: [{ kind: "fill", pathData: "", fillRule: "nonzero" }] }],
  }), /blank path data/);

  assert.throws(() => definePalette([{
    ...paletteVariant, status: { ...paletteVariant.status, danger: "red" },
  }]), /invalid colour/);
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
  services: [{
    serviceId: "ui.controller",
    nativePortId: "ControllerPorts",
    profiles: ["phone", "wear"],
    inputPorts: ["sourceState", "trigger"],
    outputPorts: ["state"],
  }],
  finiteValues: [{ id: "fixture.phase", values: ["idle", "active"] }],
};

const mutate = (
  change: (draft: NativeBindingManifest) => NativeBindingManifest,
): NativeBindingManifest => change(structuredClone(conformingManifest) as NativeBindingManifest);

test("a conforming native manifest reports nothing", () => {
  const findings = productArtifactConformance(fixture(), conformingManifest);
  assert.deepEqual(findings.map(({ axis, direction }) => `${axis}/${direction}`), []);
});

// One mutation per axis. Each asserts the axis AND direction it is supposed to
// break, so a mutation cannot pass by failing for some unrelated reason -- the
// mistake that lets a mutation test certify a check it never exercised.
const AXIS_MUTATIONS: readonly {
  axis: ConformanceAxis;
  direction: ConformanceDirection;
  subject: string;
  change: (draft: NativeBindingManifest) => NativeBindingManifest;
}[] = [
  {
    // Orphan, not missing. A manifest describes ONE host, so a profile it omits is
    // another host's job; a profile it invents is a coverage claim with nothing behind
    // it. See productArtifactHostCoverage for the question this direction cannot ask.
    axis: "artifact", direction: "orphan", subject: "toaster",
    change: (d) => ({ ...d, profiles: [...d.profiles!, "toaster"] }),
  },
  {
    axis: "service-port", direction: "orphan", subject: "ui.controller.invented",
    change: (d) => ({ ...d, services: [{ ...d.services![0]!, serviceId: "ui.controller",
      inputPorts: [...d.services![0]!.inputPorts, "invented"] }] }),
  },
  {
    axis: "component", direction: "mismatch", subject: "fixture.control@phone",
    change: (d) => ({
      ...d,
      components: [...d.components, { componentId: "fixture.control", rendererId: "renderer.phone", profiles: ["phone"] }],
    }),
  },
  {
    axis: "component", direction: "orphan", subject: "fixture.ghost",
    change: (d) => ({
      ...d,
      components: [...d.components, { componentId: "fixture.ghost", rendererId: "renderer.phone", profiles: ["phone"] }],
    }),
  },
  {
    axis: "icon", direction: "missing", subject: "check",
    change: (d) => ({ ...d, icons: [] }),
  },
  {
    axis: "finite-value", direction: "mismatch", subject: "fixture.phase",
    change: (d) => ({ ...d, finiteValues: [{ id: "fixture.phase", values: ["idle"] }] }),
  },
];

for (const { axis, direction, subject, change } of AXIS_MUTATIONS) {
  test(`conformance catches a ${direction} ${axis}`, () => {
    const findings = productArtifactConformance(fixture(), mutate(change));
    const match = findings.find((item) => item.axis === axis && item.direction === direction);
    assert.ok(
      match !== undefined,
      `expected a ${axis}/${direction} finding, got ${JSON.stringify(findings)}`,
    );
    assert.equal(match.subject, subject);
  });
}

test("the hard gate names every axis at once", () => {
  assert.throws(
    () => assertProductArtifactConformance(
      fixture(),
      mutate((d) => ({ ...d, profiles: [...d.profiles!, "toaster"], icons: [] })),
    ),
    /artifact\/orphan[\s\S]*icon\/missing/,
  );
});

// The direction the per-host axis gave up. CircleKit Showcase declares five artifacts
// across four hosts, so no single manifest can answer "does every artifact have a
// renderer" -- but dropping the question would let a product declare an artifact nobody
// ships and have every per-host run still come back clean.
test("an artifact no host binds is reported once, over the set of manifests", () => {
  const android = { ...conformingManifest, profiles: ["phone"] };
  assert.deepEqual(
    productArtifactHostCoverage(fixture(), [android]).map(({ axis, direction, subject }) =>
      ({ axis, direction, subject })),
    [{ axis: "artifact", direction: "missing", subject: "wear" }],
  );
  const wear = { ...conformingManifest, profiles: ["wear"] };
  assert.deepEqual(productArtifactHostCoverage(fixture(), [android, wear]), []);
});

test("host coverage refuses to measure through a manifest that declares no profiles", () => {
  const silent = { ...conformingManifest } as Record<string, unknown>;
  delete silent.profiles;
  const findings = productArtifactHostCoverage(
    fixture(),
    [silent as unknown as NativeBindingManifest],
  );
  assert.deepEqual(findings.map(({ direction }) => direction), ["unasserted"]);
});

// CircleKit Showcase ships a manifest with only components and icons. The first
// version of this helper crashed on it ("manifest.services is not iterable") and
// would have called all five artifacts missing. An omitted section is unasserted,
// and it must say so rather than pass quietly or flood.
test("an omitted manifest section is reported, not skipped and not flooded", () => {
  const partial = { ...conformingManifest } as Record<string, unknown>;
  delete partial.profiles;
  delete partial.services;
  delete partial.finiteValues;
  const findings = productArtifactConformance(fixture(), partial as unknown as NativeBindingManifest);

  assert.deepEqual(
    findings.filter((item) => item.direction === "unasserted").map(({ subject }) => subject).sort(),
    ["finiteValues", "profiles", "services"],
  );
  assert.equal(findings.filter((item) => item.direction === "missing").length, 0);
});
