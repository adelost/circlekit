import assert from "node:assert/strict";
import test from "node:test";
import {
  compileInteractions,
  defineActionFamily,
  emitInteractionKotlin,
  interactionControlId,
  interactionMountId,
  type DiscreteInteractionDeclaration,
  type InteractionNativeSymbols,
} from "../src/skydiving/index.js";

const sourceFile = "appspec/products/skyvw/menus/interactions.ts";
const symbols: InteractionNativeSymbols = {
  continuousInteractionContract: "io.acme.AppSpecContinuousInteractionContract",
  discreteInteractionContract: "io.acme.AppSpecDiscreteInteractionContract",
  host: "io.acme.AppSpecHost",
  interactionCatalog: "io.acme.AppSpecInteractionCatalog",
  interactionControlId: "io.acme.AppSpecInteractionControlId",
  interactionMount: "io.acme.AppSpecInteractionMount",
  interactionMountId: "io.acme.AppSpecInteractionMountId",
  interactionPolicyHandle: "io.acme.AppSpecInteractionPolicyHandle",
  interactionSource: "io.acme.AppSpecInteractionSource",
  settingId: "io.acme.AppSpecSettingId",
};

const explicit: readonly DiscreteInteractionDeclaration[] = [
  {
    kind: "discrete-action",
    controlId: interactionControlId("action.replay-review"),
    timing: "deliberate",
    mounts: [
      { id: interactionMountId("mount.replay-review.phone-menu-row"), kind: "atom", requiredHosts: ["phone"] },
      { id: interactionMountId("mount.replay-review.wear-face-tool"), kind: "atom", requiredHosts: ["wear"] },
    ],
    requiredHosts: ["phone", "wear"],
    source: { file: sourceFile, declarationId: "action.replay-review" },
  },
  {
    kind: "discrete-action",
    controlId: interactionControlId("action.replay-clouds"),
    timing: "deliberate",
    mounts: [
      { id: interactionMountId("mount.replay-clouds.phone-menu-row"), kind: "atom", requiredHosts: ["phone"] },
      { id: interactionMountId("mount.replay-clouds.wear-face-tool"), kind: "atom", requiredHosts: ["wear"] },
    ],
    requiredHosts: ["phone", "wear"],
    source: { file: sourceFile, declarationId: "action.replay-clouds" },
  },
];

const action = defineActionFamily({ sourceFile, requiredHosts: ["phone", "wear"] });
const compact = [
  action({
    id: "action.replay-review",
    timing: "deliberate",
    mounts: [
      { id: "mount.replay-review.phone-menu-row", hosts: ["phone"] },
      { id: "mount.replay-review.wear-face-tool", hosts: ["wear"] },
    ],
  }),
  action({
    id: "action.replay-clouds",
    timing: "deliberate",
    mounts: [
      { id: "mount.replay-clouds.phone-menu-row", hosts: ["phone"] },
      { id: "mount.replay-clouds.wear-face-tool", hosts: ["wear"] },
    ],
  }),
] as const;

test("a scoped action family preserves declarations, normalized IR and emitter bytes", () => {
  assert.deepEqual(compact, explicit);
  const oldIr = compileInteractions({ declarations: explicit }).ir;
  const newIr = compileInteractions({ declarations: compact }).ir;
  assert.deepEqual(newIr, oldIr);
  assert.notEqual(newIr, null);
  if (oldIr === null || newIr === null) return;
  const emit = (ir: typeof oldIr) => emitInteractionKotlin(ir, {
    packageName: "io.acme.generated",
    objectName: "GeneratedInteractions",
    sourceSha: "same-source",
    nativeSymbols: symbols,
  });
  assert.equal(emit(newIr), emit(oldIr));
});

test("required Wear coverage remains independent from supplied placements", () => {
  const withoutWear = action({
    id: "action.replay-review",
    timing: "deliberate",
    mounts: [{ id: "mount.replay-review.phone-menu-row", hosts: ["phone"] }],
  });
  const result = compileInteractions({ declarations: [withoutWear] });
  assert.equal(result.ir, null);
  assert.equal(result.diagnostics.some(({ rule, declarationId }) =>
    rule === "interaction.mount.host-coverage" && declarationId === "action.replay-review"), true);
});

test("irregular stable ids and placement order remain exactly as authored", () => {
  const irregular = action({
    id: "action.live-iso-reset-view",
    timing: "deliberate",
    mounts: [
      { id: "mount.live-iso-reset.wear-menu-row", hosts: ["wear"] },
      { id: "mount.live-iso-reset.phone-menu-row", hosts: ["phone"] },
    ],
  });
  assert.equal(irregular.controlId, "action.live-iso-reset-view");
  assert.deepEqual(irregular.mounts.map(({ id }) => id), [
    "mount.live-iso-reset.wear-menu-row",
    "mount.live-iso-reset.phone-menu-row",
  ]);
});

test("redundant family and mount fields are refused at runtime", () => {
  assert.throws(() => action({
    id: "action.replay-review", timing: "deliberate", mounts: [
      { id: "mount.replay-review.phone-menu-row", hosts: ["phone"] },
      { id: "mount.replay-review.wear-face-tool", hosts: ["wear"] },
    ], kind: "discrete-action",
  } as never), /action family member.*unexpected.*kind/);
  assert.throws(() => action({
    id: "action.replay-review", timing: "deliberate", mounts: [
      { id: "mount.replay-review.phone-menu-row", hosts: ["phone"], kind: "atom" },
      { id: "mount.replay-review.wear-face-tool", hosts: ["wear"] },
    ],
  } as never), /action family mount.*unexpected.*kind/);
});

if (false) {
  // @ts-expect-error The family owns the discrete kind.
  action({ id: "action.bad", timing: "deliberate", mounts: [], kind: "discrete-action" });
  action({
    id: "action.bad-mount", timing: "deliberate",
    // @ts-expect-error The family owns the atom mount kind.
    mounts: [{ id: "mount.bad", hosts: ["phone"], kind: "atom" }],
  });
}
