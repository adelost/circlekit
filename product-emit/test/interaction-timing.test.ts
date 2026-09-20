import assert from "node:assert/strict";
import test from "node:test";
import {
  compileInteractions,
  interactionControlId,
  interactionMountId,
  type DiscreteInteractionDeclaration,
  type SettingIr,
} from "../src/skydiving/index.js";

/**
 * The emitter's timing check, driven for the first time.
 *
 * Row 225. Nothing in product-emit's suite reached compile-interactions' timing branch: it repeated
 * the two words by hand and no case would have noticed a third one being let through. It now asks
 * the shared vocabulary in product-spec, and these are the cases that hold it to that.
 */

function discrete(timing: string, settingId?: string): DiscreteInteractionDeclaration {
  return {
    kind: "discrete-action",
    controlId: interactionControlId("settings.wake-phrase"),
    timing: timing as DiscreteInteractionDeclaration["timing"],
    mounts: [{ id: interactionMountId("settings.wake-phrase.row"), kind: "atom", requiredHosts: ["phone"] }],
    requiredHosts: ["phone"],
    source: { file: "menus/interactions.ts", declarationId: "skyvwInteractions" },
    ...(settingId === undefined ? {} : { settingId }),
  } as unknown as DiscreteInteractionDeclaration;
}

const toggleSetting = {
  id: "wake-phrase",
  control: { id: "settings.wake-phrase" },
} as unknown as SettingIr;

test("the two words a product may declare still compile, unchanged by the move", () => {
  for (const timing of ["immediate", "deliberate"]) {
    const { ir, diagnostics } = compileInteractions({ declarations: [discrete(timing)] });
    assert.deepEqual(diagnostics, [], `'${timing}' was refused after the vocabulary moved`);
    assert.equal(ir?.interactions.length, 1);
  }
});

test("a third kind of button is refused by name", () => {
  // Mattias 2026-09-20: "det ska inte finnas något mellanting liksom, bara de här två typerna utav
  // knappar". A duration is not a kind: a longer confirmation is a deliberate control with a longer
  // hold, so 'destructive' has to be refused here exactly like any other invented word.
  for (const invented of ["destructive", "instant", "hold", "Immediate"]) {
    const { ir, diagnostics } = compileInteractions({ declarations: [discrete(invented)] });
    assert.equal(ir?.interactions.length ?? 0, 0, `'${invented}' reached the IR`);
    assert.equal(
      diagnostics.some((d) => d.rule === "interaction.invalid-timing" && d.message.includes(invented)),
      true,
      `'${invented}' was accepted as a kind of button`,
    );
  }
});

test("a canonical setting control refuses deliberate timing by name", () => {
  const { ir, diagnostics } = compileInteractions({
    declarations: [discrete("deliberate", toggleSetting.id)],
    settings: [toggleSetting],
  });
  assert.equal(ir, null);
  assert.deepEqual(
    diagnostics.map(({ rule, declarationId, message }) => ({ rule, declarationId, message })),
    [{
      rule: "interaction.setting.timing",
      declarationId: "settings.wake-phrase",
      message: "setting 'wake-phrase' is a toggle or finite choice and must use immediate timing",
    }],
  );
});
