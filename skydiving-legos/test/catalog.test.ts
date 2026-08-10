/**
 * What this package promises: the skydiving domain is declared once, and a
 * product that re-declares any of it fails to compile.
 *
 * The reservation is the whole point, so it is proven by a RED case rather than
 * asserted: a product that copies a catalog contract, node type or finite space
 * -- with the identical schema, which is the case a "did you change it?" check
 * would wave through -- must be rejected.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  componentPort, defineProduct, defineProductNavigation, port, service,
} from "@v1d/product-spec";

import {
  SKYDIVING_LEGO_MODULE_COUNT, skydivingContracts, skydivingLegoCatalog,
  skydivingNodeTypes, unreservedContractIds, unreservedNodeTypeIds,
} from "../src/catalog.js";
import { skydivingFiniteValues } from "../src/finite-values.js";

const assets = { id: "assets", version: "0.0.0", icons: [] };

const nav = defineProductNavigation(
  [{ screen: "MAIN", family: { id: "fam", trees: [] } }] as never,
  { id: "nav", pageSemantics: { MAIN: { guard: null, back: "system" } } } as never,
) as never as { activePageContract: never; pageValues: { id: string } };

const componentType = {
  id: "fixture.card",
  requiredCapabilities: [],
  inputs: [componentPort("activePage", nav.activePageContract)],
  outputs: [],
};
const component = {
  id: "fixture.card.main",
  componentTypeRef: "fixture.card",
  bindings: { inputs: { activePage: "fixture.nav-instance.activePage" }, events: {} },
};
const navService = service({
  id: "fixture.nav-service",
  inputs: [],
  outputs: [port("activePage", nav.activePageContract)],
  runtime: {
    stateOwner: "instance", lifetime: "instance", durability: "transient",
    clockDomain: "none", contextInputs: [], effects: ["fixture.navigate"],
  },
} as never);

/** The smallest product ProductSpec accepts, so the only variable is the copy. */
const base = {
  id: "fixture",
  rendererBindings: [{ id: "r", capabilities: [] }],
  artifacts: [{
    id: "a", rendererRefs: ["r"], requiredCapabilities: [],
    entryScreen: "MAIN", screenRefs: ["MAIN"], serves: ["round"],
  }],
  nodeTypes: [navService],
  nodes: [{
    id: "fixture.nav-instance", nodeTypeRef: "fixture.nav-service", config: {},
    bindings: {}, activation: { kind: "lifetime", lifecycleSources: [] },
  }],
  configs: [],
  finiteValues: [],
  stateAuthorities: [],
  componentTypes: [componentType],
  components: [component],
  componentFamilies: [{
    screen: "MAIN",
    family: {
      id: "fam",
      trees: [{
        surface: "round",
        mounts: [{
          id: "m", instance: "fixture.card.main", region: "body",
          order: 0, priority: 0, capacity: null, requirement: "required",
        }],
      }],
    },
  }],
  palette: { variants: [] },
  assetCatalogRef: { id: "assets", version: "0.0.0" },
  iconRefs: [],
  navigation: nav,
};

const buildProduct = (overrides: object = {}) =>
  defineProduct({ ...base, ...overrides } as never, assets as never, [skydivingLegoCatalog]);

test("the catalog declares the skydiving domain and validates on its own", () => {
  assert.equal(skydivingLegoCatalog.id, "skydiving");
  assert.equal(SKYDIVING_LEGO_MODULE_COUNT, 14);
  assert.ok(skydivingContracts.length > 70, `only ${skydivingContracts.length} contracts`);
  assert.ok(skydivingNodeTypes.length > 30, `only ${skydivingNodeTypes.length} node types`);
  assert.equal(skydivingFiniteValues.length, 18);
});

test("a product may be built against the catalog", () => {
  assert.equal(buildProduct().id, "fixture");
});

test("a product cannot copy a catalog contract even with the identical schema", () => {
  const original = skydivingContracts.find(({ id }) => id === "attitude.compass-state");
  assert.ok(original, "fixture contract missing from the catalog");
  const copy = { ...original, fields: [...original.fields] };
  const copyService = service({
    id: "fixture.copy-service", inputs: [], outputs: [port("copied", copy as never)],
    runtime: {
      stateOwner: "instance", lifetime: "instance", durability: "transient",
      clockDomain: "none", contextInputs: [], effects: ["fixture.copy"],
    },
  } as never);
  assert.throws(
    () => buildProduct({ nodeTypes: [navService, copyService] }),
    /product contract 'attitude\.compass-state' collides with library 'skydiving'/,
  );
});

test("a product cannot copy a catalog finite value even with the identical values", () => {
  const original = skydivingFiniteValues.find(({ id }) => id === "flight.phase");
  assert.ok(original, "flight.phase missing from the catalog");
  const copy = { ...original, values: [...original.values] };
  assert.throws(
    () => buildProduct({ finiteValues: [copy] }),
    /product finite value 'flight\.phase' collides with library 'skydiving'/,
  );
});

test("a product cannot copy a catalog node type even with the identical shape", () => {
  const original = skydivingNodeTypes.find(({ id }) => id === "weather.service");
  assert.ok(original, "weather.service missing from the catalog");
  const copy = { ...original, inputs: [...original.inputs], outputs: [...original.outputs] };
  assert.throws(
    () => buildProduct({ nodeTypes: [navService, copy] }),
    /product node type 'weather\.service' collides with library 'skydiving'/,
  );
});

test("every unreserved contract is unreserved for a live reason", () => {
  // Widened on purpose: the literal union proves the point at COMPILE time
  // (an excluded id is not assignable to the declared set), which is a nice
  // property and a useless failure message. Widening keeps the assertion able
  // to say which id changed.
  const declared = new Set<string>(skydivingFiniteValues.map(({ id }) => id));
  for (const [contractId, missingFinite] of Object.entries(unreservedContractIds)) {
    assert.ok(
      !declared.has(missingFinite),
      `'${missingFinite}' is declared now, so '${contractId}' belongs in the catalog`,
    );
    assert.ok(
      !skydivingContracts.some(({ id }) => id === contractId),
      `'${contractId}' is both excluded and reserved`,
    );
  }
  // The node types follow their contracts out, and only those.
  assert.deepEqual([...unreservedNodeTypeIds].sort(), ["runtime.battery-source", "runtime.supervisor"]);
});
