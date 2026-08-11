import assert from "node:assert/strict";
import test from "node:test";
import { defineProduct } from "@v1d/product-spec";
import { pressureAccuracies, positionService } from "@v1d/skydiving-legos";
import {
  CIRCLEKIT_ASSET_CATALOG,
  SKYDIVING_CATALOG,
  compileLinkProduct,
  linkProductDeclaration,
} from "../src/product.js";

test("one shared position Lego drives the one mounted Link page", () => {
  const product = compileLinkProduct();
  const positionType = product.nodeTypes.find(({ id }) => id === positionService.id);
  assert.equal(positionType, positionService);
  assert.deepEqual(product.navigation.pages.map(({ id }) => id), ["POSITION"]);

  const edges = product.portRegistry.demandEdges.filter(({ nodeInstanceRef }) =>
    nodeInstanceRef === "position.service");
  assert.equal(edges.length, 3);
  assert.deepEqual(edges.map(({ targetPortRef }) => targetPortRef), [
    "position.service.demand",
    "position.service.demand",
    "position.service.demand",
  ]);
  assert.deepEqual(edges.map((edge) => edge.kind === "component-mount" ? edge.surface : null), [
    "round", "compact", "wide",
  ]);
  assert.ok(edges.every((edge) => edge.kind === "component-mount"
    && edge.componentInstanceRef === "position.page"));
});

test("a Link-local copy of a library id is rejected even when identical", () => {
  const copiedPressureAccuracy = {
    ...pressureAccuracies,
    values: [...pressureAccuracies.values],
  } as const;

  assert.throws(
    () => defineProduct({
      ...linkProductDeclaration,
      finiteValues: [copiedPressureAccuracy],
    } as never, CIRCLEKIT_ASSET_CATALOG, [SKYDIVING_CATALOG]),
    /product finite value 'pressure\.accuracy' collides with library 'skydiving'/,
  );
});

test("compilation and emission inputs are deterministic", () => {
  assert.deepEqual(compileLinkProduct(), compileLinkProduct());
});
