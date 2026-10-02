import assert from "node:assert/strict";
import test from "node:test";
import {
  declaredSite, storedChoice, storedFlag, storedInt, storedLong, storedNumber, storedPropertyOf, storedText,
  storedTypeOf, storedValueCatalog, type StoredValueDeclaration,
} from "../src/index.js";

/** A shape TypeScript already refuses, built anyway, as JavaScript or a cast can: the law must still hold. */
const unchecked = (spec: object): never => spec as never;

const height = { id: "acme.height", wireName: "heightM", store: "acme-settings", unit: "m", min: 50, max: 6_000 } as const;
const step = { id: "acme.step", wireName: "stepM", store: "acme-settings", unit: "m" } as const;
const day = { id: "acme.day", wireName: "pickedEpochDay", store: "acme-dev" } as const;
const marker = { id: "acme.marker", wireName: "markerStyle", store: "acme-settings" } as const;
const chime = storedFlag({ id: "acme.chime", wireName: "chimeOn", store: "acme-settings", defaultValue: true });
const beep = storedFlag({ id: "acme.beep", wireName: "beepOn", store: "acme-settings", property: "beep", defaultValue: true });
const ring = storedFlag({ id: "acme.ring", wireName: "ringOn", store: "acme-settings", defaultValue: true });
const climb = storedInt({ ...height, step: 100, defaultValue: 600 });
const intFields = "id, wireName, store, property, unit, min, max, step, defaultValue";
const numberFields = "id, wireName, store, property, unit, min, max, step, optional, defaultValue";

/** One case per law: what is declared, and the exact refusal. */
const refusals: readonly (readonly [string, () => unknown, string])[] = [
  ["int: a fraction", () => storedInt({ ...height, step: 100, defaultValue: 600.5 }),
    "stored value 'acme.height': defaultValue must be whole numbers"],
  ["int: fractions, each named", () => storedInt({ ...height, min: 0.5, step: 1.5, defaultValue: 600 }),
    "stored value 'acme.height': min, step must be whole numbers"],
  ["int: wider than an Int", () => storedInt({ ...height, max: 3_000_000_000, step: 100, defaultValue: 600 }),
    "stored value 'acme.height': max must fit an Int, -2147483648..2147483647: a wider value is a storedLong"],
  ["int: step zero", () => storedInt({ ...height, step: 0, defaultValue: 600 }),
    "stored value 'acme.height': step 0 must be above zero"],
  ["int: min above max", () => storedInt({ ...height, min: 7_000, step: 100, defaultValue: 6_500 }),
    "stored value 'acme.height': min 7000 is above max 6000"],
  ["int: default outside", () => storedInt({ ...height, step: 100, defaultValue: 7_000 }),
    "stored value 'acme.height': default 7000 is outside 50..6000"],
  ["int: a field a stored int does not have", () => storedInt({ ...height, step: 100, defaultValue: 600, optional: true }),
    `stored value 'acme.height': unknown field 'optional'; a stored-int has ${intFields}`],
  ["long: spread from an int, keeping the int's kind", () => storedLong({ ...climb, id: "acme.day", wireName: "pickedEpochDay" }),
    "stored value 'acme.day': storedLong declares a stored-long, not a stored-int"],
  ["long: a fraction", () => storedLong({ ...day, min: 0.5, defaultValue: 3 }),
    "stored value 'acme.day': min must be whole numbers"],
  ["long: min above max", () => storedLong({ ...day, min: 10, max: 5, defaultValue: 7 }),
    "stored value 'acme.day': min 10 is above max 5"],
  ["long: default below an open range", () => storedLong({ ...day, min: 0, defaultValue: -1 }),
    "stored value 'acme.day': default -1 is outside 0.."],
  ["long: neither default nor optional", () => storedLong(unchecked({ ...day })),
    "stored value 'acme.day' needs a default or optional: true"],
  ["long: optional with a default", () => storedLong(unchecked({ ...day, optional: true, defaultValue: 0 })),
    "stored value 'acme.day' is optional and states a default: an optional value reads as absent until something saves it"],
  ["number: not a number", () => storedNumber({ ...step, min: Number.NaN, defaultValue: 0.5 }),
    "stored value 'acme.step': min must be finite numbers"],
  ["number: infinite as a float", () => storedNumber({ ...step, max: 1e39, defaultValue: Number.POSITIVE_INFINITY }),
    "stored value 'acme.step': max, defaultValue must be finite numbers"],
  ["number: negative step", () => storedNumber({ ...step, step: -0.1, defaultValue: 0.5 }),
    "stored value 'acme.step': step -0.1 must be above zero"],
  ["number: min above max", () => storedNumber({ ...step, min: 1, max: 0.1, defaultValue: 0.5 }),
    "stored value 'acme.step': min 1 is above max 0.1"],
  ["number: default above an open range", () => storedNumber({ ...step, max: 1, defaultValue: 2 }),
    "stored value 'acme.step': default 2 is outside ..1"],
  ["number: neither default nor optional", () => storedNumber(unchecked({ ...step, min: 0 })),
    "stored value 'acme.step' needs a default or optional: true"],
  ["number: optional with a default", () => storedNumber(unchecked({ ...step, optional: true, defaultValue: 0.5 })),
    "stored value 'acme.step' is optional and states a default: an optional value reads as absent until something saves it"],
  ["number: a misspelt min", () => storedNumber({ ...step, mni: 0.1, max: 1.0, defaultValue: 0.5 }),
    `stored value 'acme.step': unknown field 'mni'; a stored-number has ${numberFields}`],
  ["choice: default not a choice", () => storedChoice({ ...marker, values: ["ROUND", "SQUARE"], defaultValue: "STAR" }),
    "stored value 'acme.marker': default 'STAR' is not one of its choices ROUND, SQUARE"],
  ["choice: listed twice", () => storedChoice({ ...marker, values: ["ROUND", "SQUARE", "ROUND"], defaultValue: "ROUND" }),
    "stored value 'acme.marker': choice 'ROUND' is listed twice"],
  ["choice: not an identifier", () => storedChoice({ ...marker, values: ["round marker", ""], defaultValue: "round marker" }),
    "stored value 'acme.marker': choice 'round marker' is not an identifier"],
  ["choice: not text", () => storedChoice(unchecked({ ...marker, values: [1, 2], defaultValue: 1 })),
    "stored value 'acme.marker': choice '1' is not an identifier"],
  ["flag: default not a boolean", () => storedFlag(unchecked({ ...marker, defaultValue: "yes" })),
    "stored value 'acme.marker': default must be true or false"],
  ["text: default not text", () => storedText(unchecked({ ...marker, defaultValue: 5 })),
    "stored value 'acme.marker': default must be text"],
  ["property: stated, not an identifier", () => storedFlag({ ...marker, property: "open-in-3d", defaultValue: true }),
    "stored value 'acme.marker': property 'open-in-3d' is not an identifier"],
  ["property: the wire name, not an identifier", () => storedFlag({ ...marker, wireName: "map.cache", defaultValue: true }),
    "stored value 'acme.marker': property 'map.cache' is not an identifier: state a property"],
  ["catalog: a setting's wire name", () => storedValueCatalog([chime], [{ id: "acme.sound", wireName: "chimeOn" }]),
    "stored value 'acme.chime' reuses wire name 'chimeOn', already saved by 'acme.sound'"],
  ["catalog: another stored value's wire name", () => storedValueCatalog([chime, storedFlag({ ...chime, id: "acme.twin" })]),
    "stored value 'acme.twin' reuses wire name 'chimeOn', already saved by 'acme.chime'"],
  ["catalog: one id twice", () => storedValueCatalog([chime, chime]),
    "stored value 'acme.chime' is declared twice"],
  ["catalog: one property twice in a store",
    () => storedValueCatalog([beep, storedFlag({ ...beep, id: "acme.beep-v2", wireName: "beepOnV2" })]),
    "stored value 'acme.beep-v2' reuses property 'beep' in store 'acme-settings', already used by 'acme.beep'"],
  ["catalog: a stated property that is another value's wire name",
    () => storedValueCatalog([ring, storedFlag({ ...ring, id: "acme.ring-v2", wireName: "ringOnV2", property: "ringOn" })]),
    "stored value 'acme.ring-v2' reuses property 'ringOn' in store 'acme-settings', already used by 'acme.ring'"],
  ["catalog: a copy edited after its laws ran", () => storedValueCatalog([{ ...climb, defaultValue: 7_000 }]),
    "stored value 'acme.height': default 7000 is outside 50..6000"],
  ["catalog: a field added after its laws ran", () => storedValueCatalog([unchecked({ ...climb, mni: 3 })]),
    `stored value 'acme.height': unknown field 'mni'; a stored-int has ${intFields}`],
  ["catalog: an unknown kind",
    () => storedValueCatalog([unchecked({ kind: "stored-blob", id: "x.blob", wireName: "blob", store: "s" })]),
    "stored value 'x.blob' has unknown kind 'stored-blob'"],
];

for (const [law, declare, message] of refusals) {
  test(`refused: ${law}`, () => assert.throws(declare, { message }));
}

test("each kind accepts a lawful value and names the type a device holds", () => {
  const accepted: readonly (readonly [StoredValueDeclaration, string])[] = [
    [storedFlag({ ...marker, defaultValue: true }), "boolean"],
    [storedInt({ ...height, step: 100, defaultValue: 600 }), "int"],
    [storedLong({ ...day, min: 0, defaultValue: 250 }), "long"],
    [storedLong({ ...day, optional: true }), "long"],
    [storedNumber({ ...step, min: 0.1, max: 1.0, step: 0.1, defaultValue: 0.5 }), "float"],
    [storedNumber({ ...step, min: 0, optional: true }), "float"],
    [storedChoice({ ...marker, values: ["ROUND", "SQUARE"], defaultValue: "ROUND" }), "string"],
    [storedText({ ...marker, defaultValue: "tiles-main" }), "string"],
  ];
  for (const [value, type] of accepted) assert.equal(storedTypeOf(value), type, value.kind);
  assert.equal(storedPropertyOf(storedFlag({ ...marker, defaultValue: true })), "markerStyle");
  assert.equal(storedPropertyOf(beep), "beep");
});

test("a range holds a default on either bound", () => {
  assert.equal(storedInt({ ...height, step: 100, defaultValue: 50 }).defaultValue, 50);
  assert.equal(storedInt({ ...height, step: 100, defaultValue: 6_000 }).defaultValue, 6_000);
});

test("a declaration serializes exactly as written, kind first, and nothing changes it after its laws ran", () => {
  const lift = storedInt({ id: "acme.lift", wireName: "liftM", store: "acme-settings", unit: "m", min: 50, max: 6_000,
    step: 100, defaultValue: 1_200 });
  const liftOn = storedFlag({ id: "acme.lift.enabled", wireName: "liftEnabled", store: "acme-settings", defaultValue: true });
  const copy = storedInt({ ...lift, id: "acme.lift-copy", wireName: "liftCopyM" });
  assert.equal(JSON.stringify(lift), '{"kind":"stored-int","id":"acme.lift","wireName":"liftM","store":"acme-settings",'
    + '"unit":"m","min":50,"max":6000,"step":100,"defaultValue":1200}');
  assert.equal(JSON.stringify(liftOn),
    '{"kind":"stored-flag","id":"acme.lift.enabled","wireName":"liftEnabled","store":"acme-settings","defaultValue":true}');
  assert.equal(JSON.stringify(copy), JSON.stringify(lift).replace('"acme.lift"', '"acme.lift-copy"').replace('"liftM"', '"liftCopyM"'));
  assert.throws(() => { (lift as { defaultValue: number }).defaultValue = 9_000; }, TypeError);
  assert.match(declaredSite(lift) ?? "", /stored-values\.test\.(ts|js):\d+$/u);
});

test("the catalog keeps each declaration and freezes the list; a property is the wire name unless stated", () => {
  const plain = storedFlag({ id: "acme.plain", wireName: "plainOn", store: "acme-settings", defaultValue: false });
  const elsewhere = storedFlag({ ...beep, id: "acme.beep-v2", wireName: "beepOnV2", store: "acme-dev" });
  const catalog = storedValueCatalog([beep, elsewhere, climb, ring, plain], [{ id: "acme.sound", wireName: "chimeOn" }]);
  assert.deepEqual(catalog.map(({ id }) => id), ["acme.beep", "acme.beep-v2", "acme.height", "acme.ring", "acme.plain"]);
  assert.equal(catalog[2], climb);
  assert.equal(Object.isFrozen(catalog), true);
});
