import assert from "node:assert/strict";
import test from "node:test";
import {
  buildOutputManifest,
  defineLegoSpec,
  defineProduct,
  field,
  logOutputManifest,
  mount,
  port,
  productJsonEmitter,
} from "../src/index.js";

const statusContract = {
  id: "fixture.status",
  kind: "state",
  fields: [field("active", "boolean")],
} as const;
const actionContract = {
  id: "fixture.action",
  kind: "event",
  fields: [field("requested", "boolean")],
} as const;
const source = defineLegoSpec({
  id: "fixture.source",
  role: "source",
  inputs: [],
  outputs: [port("status", statusContract.id)],
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
  inputs: [port("sourceState", statusContract.id), port("trigger", actionContract.id)],
  outputs: [port("state", statusContract.id)],
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
      contracts: [statusContract, actionContract],
      configs: [],
      mounts,
      wiring: [{ from: "domain.source.status", to: "ui.controller.sourceState" }],
    },
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

test("one ProductSpec compiles two artifact profiles and deterministic outputs", () => {
  const product = fixture();
  assert.equal(product.legos.mounts.length, 2);
  assert.deepEqual(product.artifacts.map(({ id }) => id), ["phone", "wear"]);

  const first = buildOutputManifest(product, [productJsonEmitter("fixture/product.json")]);
  const second = buildOutputManifest(product, [productJsonEmitter("fixture/product.json")]);
  assert.deepEqual(first, second);
  assert.equal(logOutputManifest(first), "product-json\tfixture/product.json");
  assert.match(first.artifacts[0]!.content, /"kind": "product-spec-ir"/);
});

test("graph, capability and port failures stop before emission", () => {
  assert.throws(() => fixture({
    artifacts: [{ id: "phone", rendererRefs: ["renderer.phone"], requiredCapabilities: ["ui.missing"] }],
  }), /lacks capability 'ui.missing'/);

  assert.throws(() => fixture({ ui: [] }), /orphan input port 'ui.controller.trigger'/);

  const loop = defineLegoSpec({
    id: "fixture.loop",
    role: "adapter",
    inputs: [port("input", statusContract.id)],
    outputs: [port("output", statusContract.id)],
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
      contracts: [statusContract],
      configs: [],
      mounts: loopMounts,
      wiring: [
        { from: "loop.first.output", to: "loop.second.input" },
        { from: "loop.second.output", to: "loop.first.input" },
      ],
    },
    ui: [],
  }), /wiring cycle/);
});
