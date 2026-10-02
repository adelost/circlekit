import assert from "node:assert/strict";
import test from "node:test";
import {
  declaredSite, storedChoice, storedFlag, storedInt, storedLong, storedNumber, storedPropertyOf, storedText,
  storedTypeOf, storedValueCatalog, type StoredValueDeclaration,
} from "../src/index.js";

/** A shape TypeScript already refuses, built anyway, as JavaScript or a cast can: the law must still hold. */
const unchecked = (spec: object): never => spec as never;

const height = { id: "alarm.test", wireName: "alarmTestM", store: "power-settings", unit: "m", min: 50, max: 6_000 } as const;
const step = { id: "display.step", wireName: "stepM", store: "power-settings", unit: "m" } as const;
const day = { id: "dev.day", wireName: "pickedEpochDay", store: "dev-settings" } as const;
const icons = { id: "display.icons", wireName: "iconStyle", store: "power-settings" } as const;
const flag = storedFlag({ id: "alarm.test.enabled", wireName: "vibrationEnabled", store: "power-settings", defaultValue: true });
const sound = storedFlag({ id: "audio.sound", wireName: "soundOn", store: "power-settings", property: "sound", defaultValue: true });
const pull = storedInt({ ...height, step: 100, defaultValue: 600 });

/** One case per law: what is declared, and the exact refusal. */
const refusals: readonly (readonly [string, () => unknown, string])[] = [
  ["int: a fraction", () => storedInt({ ...height, step: 100, defaultValue: 600.5 }),
    "stored value 'alarm.test': defaultValue must be whole numbers"],
  ["int: fractions, each named", () => storedInt({ ...height, min: 0.5, step: 1.5, defaultValue: 600 }),
    "stored value 'alarm.test': min, step must be whole numbers"],
  ["int: wider than an Int", () => storedInt({ ...height, max: 3_000_000_000, step: 100, defaultValue: 600 }),
    "stored value 'alarm.test': max must fit an Int, -2147483648..2147483647: a wider value is a storedLong"],
  ["int: step zero", () => storedInt({ ...height, step: 0, defaultValue: 600 }),
    "stored value 'alarm.test': step 0 must be above zero"],
  ["int: min above max", () => storedInt({ ...height, min: 7_000, step: 100, defaultValue: 6_500 }),
    "stored value 'alarm.test': min 7000 is above max 6000"],
  ["int: default outside", () => storedInt({ ...height, step: 100, defaultValue: 7_000 }),
    "stored value 'alarm.test': default 7000 is outside 50..6000"],
  ["long: a fraction", () => storedLong({ ...day, min: 0.5, defaultValue: 3 }),
    "stored value 'dev.day': min must be whole numbers"],
  ["long: min above max", () => storedLong({ ...day, min: 10, max: 5, defaultValue: 7 }),
    "stored value 'dev.day': min 10 is above max 5"],
  ["long: default below an open range", () => storedLong({ ...day, min: 0, defaultValue: -1 }),
    "stored value 'dev.day': default -1 is outside 0.."],
  ["long: neither default nor optional", () => storedLong(unchecked({ ...day })),
    "stored value 'dev.day' needs a default or optional: true"],
  ["long: optional with a default", () => storedLong(unchecked({ ...day, optional: true, defaultValue: 0 })),
    "stored value 'dev.day' is optional and states a default: an optional value reads as absent until something saves it"],
  ["number: not a number", () => storedNumber({ ...step, min: Number.NaN, defaultValue: 0.5 }),
    "stored value 'display.step': min must be finite numbers"],
  ["number: infinite as a float", () => storedNumber({ ...step, max: 1e39, defaultValue: Number.POSITIVE_INFINITY }),
    "stored value 'display.step': max, defaultValue must be finite numbers"],
  ["number: negative step", () => storedNumber({ ...step, step: -0.1, defaultValue: 0.5 }),
    "stored value 'display.step': step -0.1 must be above zero"],
  ["number: min above max", () => storedNumber({ ...step, min: 1, max: 0.1, defaultValue: 0.5 }),
    "stored value 'display.step': min 1 is above max 0.1"],
  ["number: default above an open range", () => storedNumber({ ...step, max: 1, defaultValue: 2 }),
    "stored value 'display.step': default 2 is outside ..1"],
  ["number: neither default nor optional", () => storedNumber(unchecked({ ...step, min: 0 })),
    "stored value 'display.step' needs a default or optional: true"],
  ["number: optional with a default", () => storedNumber(unchecked({ ...step, optional: true, defaultValue: 0.5 })),
    "stored value 'display.step' is optional and states a default: an optional value reads as absent until something saves it"],
  ["choice: default not a choice", () => storedChoice({ ...icons, values: ["FILLED", "OUTLINE"], defaultValue: "SHARP" }),
    "stored value 'display.icons': default 'SHARP' is not one of its choices FILLED, OUTLINE"],
  ["choice: listed twice", () => storedChoice({ ...icons, values: ["FILLED", "OUTLINE", "FILLED"], defaultValue: "FILLED" }),
    "stored value 'display.icons': choice 'FILLED' is listed twice"],
  ["flag: default not a boolean", () => storedFlag(unchecked({ ...icons, defaultValue: "yes" })),
    "stored value 'display.icons': default must be true or false"],
  ["text: default not text", () => storedText(unchecked({ ...icons, defaultValue: 5 })),
    "stored value 'display.icons': default must be text"],
  ["property: stated, not an identifier", () => storedFlag({ ...icons, property: "open-in-3d", defaultValue: true }),
    "stored value 'display.icons': property 'open-in-3d' is not an identifier"],
  ["property: the wire name, not an identifier", () => storedFlag({ ...icons, wireName: "map.cache", defaultValue: true }),
    "stored value 'display.icons': property 'map.cache' is not an identifier"],
  ["catalog: a setting's wire name", () => storedValueCatalog([flag], [{ id: "system.ui-haptics", wireName: "vibrationEnabled" }]),
    "stored value 'alarm.test.enabled' reuses wire name 'vibrationEnabled', already saved by 'system.ui-haptics'"],
  ["catalog: another stored value's wire name", () => storedValueCatalog([flag, storedFlag({ ...flag, id: "alarm.twin" })]),
    "stored value 'alarm.twin' reuses wire name 'vibrationEnabled', already saved by 'alarm.test.enabled'"],
  ["catalog: one id twice", () => storedValueCatalog([flag, flag]),
    "stored value 'alarm.test.enabled' is declared twice"],
  ["catalog: one property twice in a store",
    () => storedValueCatalog([sound, storedFlag({ ...sound, id: "audio.sound-v2", wireName: "soundOnV2" })]),
    "stored value 'audio.sound-v2' reuses property 'sound' in store 'power-settings', already used by 'audio.sound'"],
  ["catalog: a copy edited after its laws ran", () => storedValueCatalog([{ ...pull, defaultValue: 7_000 }]),
    "stored value 'alarm.test': default 7000 is outside 50..6000"],
  ["catalog: an unknown kind",
    () => storedValueCatalog([unchecked({ kind: "stored-blob", id: "x.blob", wireName: "blob", store: "s" })]),
    "stored value 'x.blob' has unknown kind 'stored-blob'"],
];

for (const [law, declare, message] of refusals) {
  test(`refused: ${law}`, () => assert.throws(declare, { message }));
}

test("each kind accepts a lawful value and names the type a device holds", () => {
  const accepted: readonly (readonly [StoredValueDeclaration, string])[] = [
    [storedFlag({ ...icons, defaultValue: true }), "boolean"],
    [storedInt({ ...height, step: 100, defaultValue: 600 }), "int"],
    [storedLong({ ...day, min: 0, defaultValue: 250 }), "long"],
    [storedLong({ ...day, optional: true }), "long"],
    [storedNumber({ ...step, min: 0.1, max: 1.0, step: 0.1, defaultValue: 0.5 }), "float"],
    [storedNumber({ ...step, min: 0, optional: true }), "float"],
    [storedChoice({ ...icons, values: ["FILLED", "OUTLINE"], defaultValue: "FILLED" }), "string"],
    [storedText({ ...icons, defaultValue: "tiles-main" }), "string"],
  ];
  for (const [value, type] of accepted) assert.equal(storedTypeOf(value), type, value.kind);
  assert.equal(storedPropertyOf(storedFlag({ ...icons, defaultValue: true })), "iconStyle");
  assert.equal(storedPropertyOf(sound), "sound");
});

test("a declaration serializes exactly as written, kind first, and nothing changes it after its laws ran", () => {
  const alarm = storedInt({ id: "alarm.pull", wireName: "alarmPullM", store: "power-settings", unit: "m", min: 50, max: 6_000,
    step: 100, defaultValue: 1_200 });
  const alarmOn = storedFlag({ id: "alarm.pull.enabled", wireName: "alarmPullEnabled", store: "power-settings", defaultValue: true });
  assert.equal(JSON.stringify(alarm), '{"kind":"stored-int","id":"alarm.pull","wireName":"alarmPullM","store":"power-settings",'
    + '"unit":"m","min":50,"max":6000,"step":100,"defaultValue":1200}');
  assert.equal(JSON.stringify(alarmOn),
    '{"kind":"stored-flag","id":"alarm.pull.enabled","wireName":"alarmPullEnabled","store":"power-settings","defaultValue":true}');
  assert.throws(() => { (alarm as { defaultValue: number }).defaultValue = 9_000; }, TypeError);
  assert.match(declaredSite(alarm) ?? "", /stored-values\.test\.(ts|js):\d+$/u);
});

test("the catalog keeps each declaration and freezes the list; another store may reuse a property", () => {
  const elsewhere = storedFlag({ ...sound, id: "audio.sound-v2", wireName: "soundOnV2", store: "dev-settings" });
  const catalog = storedValueCatalog([sound, elsewhere, pull], [{ id: "system.ui-haptics", wireName: "vibrationEnabled" }]);
  assert.deepEqual(catalog.map(({ id }) => id), ["audio.sound", "audio.sound-v2", "alarm.test"]);
  assert.equal(catalog[2], pull);
  assert.equal(Object.isFrozen(catalog), true);
});
