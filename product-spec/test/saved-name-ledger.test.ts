import assert from "node:assert/strict";
import test from "node:test";
import {
  appendSavedNames, assertHeldOnlyShrinks, assertSavedStoresKept, assertStoredTypesKept, pinSavedStores, pinStoredTypes,
  type SavedNameSection, type StoredType,
} from "../src/index.js";

/** A product's ledger as its generate writes it: two-space JSON and a final newline. */
const ledgerText = `{
  "schemaVersion": 1,
  "savedNames": {
    "storedValues": {
      "active": [
        "gridStepM",
        "zoomLevel"
      ],
      "retired": [
        "legacyGridOn"
      ]
    }
  },
  "savedTypes": {
    "gridStepM": "int",
    "zoomLevel": "int",
    "showLegend": "boolean"
  },
  "heldNatively": [
    "gridStepM",
    "zoomLevel"
  ]
}
`;

interface Ledger {
  readonly savedNames: { readonly storedValues: SavedNameSection };
  readonly savedTypes: Readonly<Record<string, StoredType>>;
}

const written = (ledger: object): string => `${JSON.stringify(ledger, null, 2)}\n`;
const ledger = (): Ledger => JSON.parse(ledgerText) as Ledger;
const section = (): SavedNameSection => ledger().savedNames.storedValues;
const refused = (message: string) => ({ message });

test("appending names the ledger already lists keeps every byte, whatever order they are declared in", () => {
  const before = ledger();
  const storedValues = appendSavedNames(before.savedNames.storedValues, ["zoomLevel", "gridStepM"], "stored value");
  const savedTypes = pinStoredTypes(before.savedTypes, [{ name: "zoomLevel", type: "int" }, { name: "gridStepM", type: "int" }]);
  assert.equal(written({ ...before, savedNames: { storedValues }, savedTypes }), ledgerText);
});

test("a new name is appended in declaration order; listed and retired names keep their places", () => {
  const before = section();
  const after = appendSavedNames(before, ["zoomLevel", "panSpeed", "gridStepM", "tileRadiusM"], "stored value");
  assert.deepEqual(after, { active: ["gridStepM", "zoomLevel", "panSpeed", "tileRadiusM"], retired: ["legacyGridOn"] });
  assert.deepEqual(before, section(), "the section it was given is unchanged");
});

test("a new saved type is pinned after the pinned ones, and a pinned type stays when its name is no longer declared", () => {
  const pinned = ledger().savedTypes;
  const next = pinStoredTypes(pinned, [{ name: "tileRadiusM", type: "int" }, { name: "constructor", type: "string" },
    { name: "zoomLevel", type: "int" }]);
  assert.deepEqual(Object.entries(next), [["gridStepM", "int"], ["zoomLevel", "int"], ["showLegend", "boolean"],
    ["tileRadiusM", "int"], ["constructor", "string"]]);
  assert.deepEqual(pinned, ledger().savedTypes, "the pins it was given are unchanged");
});

test("refused: a retired name declared again", () => {
  assert.throws(() => appendSavedNames(section(), ["zoomLevel", "legacyGridOn"], "stored value"),
    refused("stored value 'legacyGridOn' is retired and cannot be declared again: old saved data would take on the new meaning"));
});

test("refused: one name declared twice", () => {
  assert.throws(() => appendSavedNames(section(), ["panSpeed", "zoomLevel", "panSpeed"], "stored value"),
    refused("stored value 'panSpeed' is declared twice"));
});

test("refused: a saved name declared with another type", () => {
  assert.throws(() => pinStoredTypes(ledger().savedTypes, [{ name: "showLegend", type: "string" }]),
    refused("'showLegend' was saved as boolean; declaring it as string makes every device that holds it fail its read, "
      + "and the store resets to defaults. Retire 'showLegend' and declare a new name"));
});

test("a pinned type is kept across revisions, and new pins may join", () => {
  const previous = ledger().savedTypes;
  assertStoredTypesKept(previous, previous, "4f2a9c1");
  assertStoredTypesKept(previous, { ...previous, tileRadiusM: "int" }, "4f2a9c1");
});

test("refused: a pinned type that changed since a revision", () => {
  const previous = ledger().savedTypes;
  assert.throws(() => assertStoredTypesKept(previous, { ...previous, zoomLevel: "long" }, "4f2a9c1"),
    refused("'zoomLevel' was pinned as int in 4f2a9c1 and is long now: a pinned saved type never changes or leaves"));
});

test("refused: a pinned type that left since a revision", () => {
  const { showLegend: _dropped, ...rest } = ledger().savedTypes;
  assert.throws(() => assertStoredTypesKept(ledger().savedTypes, rest, "4f2a9c1"),
    refused("'showLegend' was pinned as boolean in 4f2a9c1 and is gone now: a pinned saved type never changes or leaves"));
});

test("a name held natively may leave the held list", () => {
  assertHeldOnlyShrinks(["gridStepM", "zoomLevel"], ["zoomLevel"], "4f2a9c1");
  assertHeldOnlyShrinks(["gridStepM", "zoomLevel"], [], "4f2a9c1");
});

test("refused: a name that joined the held list since a revision", () => {
  assert.throws(() => assertHeldOnlyShrinks(["zoomLevel"], ["zoomLevel", "tileRadiusM"], "4f2a9c1"),
    refused("'tileRadiusM' is held natively now but was not in 4f2a9c1: a new saved value is held by its generated record"));
});

const declaredStores = [{ name: "gridStepM", store: "acme-settings" }, { name: "zoomLevel", store: "acme-settings" }] as const;

test("a ledger that pins no store yet gains the store map whole after its existing bytes, and a second generate keeps it", () => {
  const before = JSON.parse(ledgerText) as Ledger & { readonly savedStores?: Readonly<Record<string, string>> };
  const next = { ...before, savedStores: pinSavedStores(before.savedStores, declaredStores) };
  assert.equal(written(next), ledgerText.replace(/\n\}\n$/u,
    ',\n  "savedStores": {\n    "gridStepM": "acme-settings",\n    "zoomLevel": "acme-settings"\n  }\n}\n'));
  assert.equal(written({ ...next, savedStores: pinSavedStores(next.savedStores, [...declaredStores].reverse()) }), written(next));
});

test("a new saved name's store is pinned after the pinned ones", () => {
  const next = pinSavedStores({ gridStepM: "acme-settings" }, [{ name: "panSpeed", store: "acme-dev" },
    { name: "gridStepM", store: "acme-settings" }]);
  assert.deepEqual(Object.entries(next), [["gridStepM", "acme-settings"], ["panSpeed", "acme-dev"]]);
});

test("refused: a saved name declared in another store", () => {
  assert.throws(() => pinSavedStores({ gridStepM: "acme-settings" }, [{ name: "gridStepM", store: "acme-dev" }]),
    refused("'gridStepM' was saved in 'acme-settings'; declaring it in 'acme-dev' makes every device lose its saved value. "
      + "Retire 'gridStepM' and declare a new name"));
});

test("a pinned store is kept across revisions, new pins may join, and a revision that pinned no store keeps none", () => {
  const previous = { gridStepM: "acme-settings" };
  assertSavedStoresKept(previous, previous, "4f2a9c1");
  assertSavedStoresKept(previous, { ...previous, panSpeed: "acme-dev" }, "4f2a9c1");
  assertSavedStoresKept(undefined, previous, "4f2a9c1");
});

test("refused: a pinned store that changed since a revision", () => {
  assert.throws(() => assertSavedStoresKept({ gridStepM: "acme-settings" }, { gridStepM: "acme-dev" }, "4f2a9c1"),
    refused("'gridStepM' was pinned to 'acme-settings' in 4f2a9c1 and is in 'acme-dev' now: a pinned store never changes or leaves"));
});

test("refused: a pinned store that left since a revision, or a ledger that dropped its store map", () => {
  const gone = "'gridStepM' was pinned to 'acme-settings' in 4f2a9c1 and is gone now: a pinned store never changes or leaves";
  assert.throws(() => assertSavedStoresKept({ gridStepM: "acme-settings" }, { zoomLevel: "acme-settings" }, "4f2a9c1"), refused(gone));
  assert.throws(() => assertSavedStoresKept({ gridStepM: "acme-settings" }, undefined, "4f2a9c1"), refused(gone));
});
