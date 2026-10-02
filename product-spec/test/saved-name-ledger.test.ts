import assert from "node:assert/strict";
import test from "node:test";
import {
  appendSavedNames, assertHeldOnlyShrinks, assertStoredTypesKept, pinStoredTypes, type SavedNameSection, type StoredType,
} from "../src/index.js";

/** A product's ledger as its generate writes it: two-space JSON and a final newline. */
const ledgerText = `{
  "schemaVersion": 1,
  "savedNames": {
    "storedValues": {
      "active": [
        "alarmBaseM",
        "alarmPullM"
      ],
      "retired": [
        "alarmHardDeckEnabled"
      ]
    }
  },
  "savedTypes": {
    "alarmBaseM": "int",
    "alarmPullM": "int",
    "showAchievements": "boolean"
  },
  "heldNatively": [
    "alarmBaseM",
    "alarmPullM"
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
  const storedValues = appendSavedNames(before.savedNames.storedValues, ["alarmPullM", "alarmBaseM"], "stored value");
  const savedTypes = pinStoredTypes(before.savedTypes, [{ name: "alarmPullM", type: "int" }, { name: "alarmBaseM", type: "int" }]);
  assert.equal(written({ ...before, savedNames: { storedValues }, savedTypes }), ledgerText);
});

test("a new name is appended in declaration order; listed and retired names keep their places", () => {
  const before = section();
  const after = appendSavedNames(before, ["alarmPullM", "cueSeatBeltsM", "alarmBaseM", "mapCacheRadiusM"], "stored value");
  assert.deepEqual(after, { active: ["alarmBaseM", "alarmPullM", "cueSeatBeltsM", "mapCacheRadiusM"], retired: ["alarmHardDeckEnabled"] });
  assert.deepEqual(before, section(), "the section it was given is unchanged");
});

test("a new saved type is pinned after the pinned ones, and a pinned type stays when its name is no longer declared", () => {
  const pinned = ledger().savedTypes;
  const next = pinStoredTypes(pinned, [{ name: "mapCacheRadiusM", type: "int" }, { name: "constructor", type: "string" },
    { name: "alarmPullM", type: "int" }]);
  assert.deepEqual(Object.entries(next), [["alarmBaseM", "int"], ["alarmPullM", "int"], ["showAchievements", "boolean"],
    ["mapCacheRadiusM", "int"], ["constructor", "string"]]);
  assert.deepEqual(pinned, ledger().savedTypes, "the pins it was given are unchanged");
});

test("refused: a retired name declared again", () => {
  assert.throws(() => appendSavedNames(section(), ["alarmPullM", "alarmHardDeckEnabled"], "stored value"),
    refused("stored value 'alarmHardDeckEnabled' is retired and cannot be declared again: old saved data would take on the new meaning"));
});

test("refused: one name declared twice", () => {
  assert.throws(() => appendSavedNames(section(), ["cueSeatBeltsM", "alarmPullM", "cueSeatBeltsM"], "stored value"),
    refused("stored value 'cueSeatBeltsM' is declared twice"));
});

test("refused: a saved name declared with another type", () => {
  assert.throws(() => pinStoredTypes(ledger().savedTypes, [{ name: "showAchievements", type: "string" }]),
    refused("'showAchievements' was saved as boolean; declaring it as string makes every device that holds it fail its read, "
      + "and the store resets to defaults. Retire 'showAchievements' and declare a new name"));
});

test("a pinned type is kept across revisions, and new pins may join", () => {
  const previous = ledger().savedTypes;
  assertStoredTypesKept(previous, previous, "4f2a9c1");
  assertStoredTypesKept(previous, { ...previous, mapCacheRadiusM: "int" }, "4f2a9c1");
});

test("refused: a pinned type that changed since a revision", () => {
  const previous = ledger().savedTypes;
  assert.throws(() => assertStoredTypesKept(previous, { ...previous, alarmPullM: "long" }, "4f2a9c1"),
    refused("'alarmPullM' was pinned as int in 4f2a9c1 and is long now: a pinned saved type never changes or leaves"));
});

test("refused: a pinned type that left since a revision", () => {
  const { showAchievements: _dropped, ...rest } = ledger().savedTypes;
  assert.throws(() => assertStoredTypesKept(ledger().savedTypes, rest, "4f2a9c1"),
    refused("'showAchievements' was pinned as boolean in 4f2a9c1 and is gone now: a pinned saved type never changes or leaves"));
});

test("a name held natively may leave the held list", () => {
  assertHeldOnlyShrinks(["alarmBaseM", "alarmPullM"], ["alarmPullM"], "4f2a9c1");
  assertHeldOnlyShrinks(["alarmBaseM", "alarmPullM"], [], "4f2a9c1");
});

test("refused: a name that joined the held list since a revision", () => {
  assert.throws(() => assertHeldOnlyShrinks(["alarmPullM"], ["alarmPullM", "mapCacheRadiusM"], "4f2a9c1"),
    refused("'mapCacheRadiusM' is held natively now but was not in 4f2a9c1: a new saved value is held by its generated record"));
});
