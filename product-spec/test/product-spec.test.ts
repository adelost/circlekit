import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import {
  buildOutputManifest,
  checkOutputManifest,
  defineScreenComponentFamilyRegistry,
  defineLegoSpec,
  defineProduct,
  field,
  logOutputManifest,
  mount,
  PORTABLE_SURFACE_CLASSES,
  port,
  productJsonEmitter,
  writeOutputManifest,
} from "../src/index.js";

const statusContract = {
  id: "fixture.status",
  kind: "state",
  fields: [field("active", "boolean")],
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

function fixture(overrides: Record<string, unknown> = {}) {
  return defineProduct({
    id: "fixture",
    rendererBindings: [
      { id: "renderer.phone", capabilities: ["ui.menu"] },
      { id: "renderer.wear", capabilities: ["ui.menu"] },
    ],
    artifacts: [
      { id: "phone", rendererRefs: ["renderer.phone"], requiredCapabilities: ["ui.menu"] },
      { id: "wear", rendererRefs: ["renderer.wear"], requiredCapabilities: ["ui.menu"] },
    ],
    legos: {
      id: "fixture.graph",
      configs: [],
      mounts,
      wiring: [{ from: "domain.source.status", to: "ui.controller.sourceState" }],
    },
    componentCatalog,
    componentFamilies,
    ui: [{
      id: "menu.control",
      kind: "menu-entry",
      artifacts: ["phone", "wear"],
      requiredCapabilities: ["ui.menu"],
      ports: { state: "ui.controller.state", action: "ui.controller.trigger" },
    }],
    ...overrides,
  });
}

test("one ProductSpec compiles two artifact profiles and deterministic outputs", async () => {
  const product = fixture();
  assert.equal(product.legos.mounts.length, 2);
  assert.deepEqual(product.legos.contracts, [statusContract, actionContract]);
  assert.deepEqual(product.artifacts.map(({ id }) => id), ["phone", "wear"]);

  const first = buildOutputManifest(product, [productJsonEmitter("fixture/product.json")], ["fixture"]);
  const second = buildOutputManifest(product, [productJsonEmitter("fixture/product.json")], ["fixture"]);
  assert.deepEqual(first, second);
  assert.equal(logOutputManifest(first), "product-json\tfixture/product.json");
  assert.match(first.artifacts[0]!.content, /"kind": "product-spec-ir"/);

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
  assert.throws(() => fixture({
    artifacts: [{ id: "phone", rendererRefs: ["renderer.phone"], requiredCapabilities: ["ui.missing"] }],
  }), /lacks capability 'ui.missing'/);

  assert.throws(() => fixture({ ui: [] }), /orphan input port 'ui.controller.trigger'/);

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
    artifacts: [{ id: "test", rendererRefs: ["renderer.test"], requiredCapabilities: [] }],
    legos: {
      id: "loop.graph",
      configs: [],
      mounts: loopMounts,
      wiring: [
        { from: "loop.first.output", to: "loop.second.input" },
        { from: "loop.second.output", to: "loop.first.input" },
      ],
    },
    componentCatalog: [],
    componentFamilies: [],
    ui: [],
  }), /wiring cycle/);

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
    artifacts: [{ id: "test", rendererRefs: ["renderer.test"], requiredCapabilities: [] }],
    legos: {
      id: "contract-conflict.graph",
      configs: [],
      mounts: [mount("source.first", source), mount("source.second", conflictingSource)],
      wiring: [],
    },
    componentCatalog: [],
    componentFamilies: [],
    ui: [
      { id: "first", kind: "component-entry", artifacts: ["test"], requiredCapabilities: [], ports: { state: "source.first.status" } },
      { id: "second", kind: "component-entry", artifacts: ["test"], requiredCapabilities: [], ports: { state: "source.second.status" } },
    ],
  }), /contract 'fixture.status' has conflicting schemas/);

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
});
