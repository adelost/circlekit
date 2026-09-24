import assert from "node:assert/strict";
import test from "node:test";
import type { CompiledProductActionDeclaration, ProductIr } from "@v1d/product-spec";
import { actionKotlinEmitter, emitActionsKotlin } from "../src/core/index.js";

const options = {
  packageName: "com.acme.generated",
  symbolPrefix: "Acme",
  sourceFile: "appspec/products/acme/actions.ts",
  sourceSha: "action-fixture-sha",
  outputDirectory: "appspec/generated/acme",
  nativePortPackageName: "com.acme.appspec",
  nativeCatalogPackageName: "com.acme.generated",
};
const actions: readonly CompiledProductActionDeclaration[] = [
  {
    id: "flight-detail.delete",
    from: "jump-details.content.delete",
    to: "ui.surface-interaction.flightDetailDelete",
    contractRef: "ui.flight-detail-delete-action",
  },
];

test("actions emit their existing typed endpoint IDs and direct navigation registration", () => {
  const kotlin = emitActionsKotlin(actions, options);
  assert.match(kotlin, /object FlightDetailDeleteEvent : ProductComponentEvent<Unit, Unit>/u);
  assert.match(kotlin, /GeneratedAcmeNativeLegoCatalog\.PortIds\.JUMP_DETAILS_CONTENT_DELETE/u);
  assert.match(kotlin, /object FlightDetailDeleteInputPort : ProductInputPort<Unit, Unit>/u);
  assert.match(kotlin, /GeneratedAcmeNativeLegoCatalog\.PortIds\.UI_SURFACE_INTERACTION_FLIGHTDETAILDELETE/u);
  assert.match(kotlin, /GeneratedAcmeNavigationAction\([\s\S]*?id = "flight-detail\.delete",[\s\S]*?kind = GeneratedAcmeNavigationActionKind\.EVENT,[\s\S]*?sourcePortRef = "jump-details\.content\.delete",[\s\S]*?targetPortRef = "ui\.surface-interaction\.flightDetailDelete",[\s\S]*?contractRef = "ui\.flight-detail-delete-action"/u);
});

test("the action plugin emits one Generated<Product>Actions.kt only when ProductIr has actions", () => {
  const emitter = actionKotlinEmitter(options);
  const [artifact] = emitter.emit({
    id: "acme", actions,
    navigation: {},
  } as unknown as ProductIr);
  assert.equal(artifact?.path, "appspec/generated/acme/GeneratedAcmeActions.kt");
  assert.equal(artifact?.mediaType, "text/x-kotlin");
  assert.match(artifact?.content ?? "", /GeneratedAcmeActions/u);
  assert.deepEqual(emitter.emit({ id: "acme" } as ProductIr), []);
});
