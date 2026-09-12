import assert from "node:assert/strict";
import test from "node:test";
import { emitWatchChromeSlotsKotlin } from "../src/skydiving/emit-watch-chrome-slots-kotlin.js";
import type { WatchChromeSlotDeclaration } from "../src/skydiving/watch-chrome-slot-model.js";

const paged: WatchChromeSlotDeclaration = {
  back: "HOUR_10", next: "HOUR_3", previous: "HOUR_9",
  items: ["HOUR_9", "HOUR_8"], rail: ["HOUR_11"], status: "HOUR_2",
  reason: "Keep the paged escape clear of the mirrored page arrows.",
};
const options = { packageName: "example", symbolPrefix: "Example", sourceFile: "slots.ts", sourceSha: "test" };

test("a reading escape changes independently of the paged navigation", () => {
  const emitted = emitWatchChromeSlotsKotlin({ ...paged, readingBack: "HOUR_9" }, options);
  assert.match(emitted, /val readingBack: CircleChromeSlot = CircleChromeSlot.HOUR_9/);
  assert.match(emitted, /val back: CircleChromeSlot = CircleChromeSlot.HOUR_10/);
  assert.match(emitted, /val previous: CircleChromeSlot = CircleChromeSlot.HOUR_9/);
});

test("existing products keep their declared escape when no reading slot is supplied", () => {
  const emitted = emitWatchChromeSlotsKotlin(paged, options);
  assert.match(emitted, /val readingBack: CircleChromeSlot = CircleChromeSlot.HOUR_10/);
});

test("a surface's camera and reference pairs are emitted as hour lists, empty when undeclared", () => {
  const emitted = emitWatchChromeSlotsKotlin({ ...paged, zoom: ["HOUR_3", "HOUR_4"], reference: ["HOUR_8", "HOUR_7"] }, options);
  assert.match(emitted, /val zoom: List<CircleChromeSlot> = listOf\(CircleChromeSlot.HOUR_3, CircleChromeSlot.HOUR_4\)/);
  assert.match(emitted, /val reference: List<CircleChromeSlot> = listOf\(CircleChromeSlot.HOUR_8, CircleChromeSlot.HOUR_7\)/);
  const bare = emitWatchChromeSlotsKotlin(paged, options);
  assert.match(bare, /val zoom: List<CircleChromeSlot> = listOf\(\)/);
  assert.match(bare, /val reference: List<CircleChromeSlot> = listOf\(\)/);
});
