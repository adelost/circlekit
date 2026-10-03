import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { storedFlag, storedInt, storedPropertyOf } from "@v1d/product-spec";
import { emitStoredRecordKotlin, emitStoredValueDescriptorsKotlin, kotlinStringLiteral } from "../src/core/index.js";
import { kotlinSkip, runKotlin } from "./kotlin-toolchain.js";
import { acmeDescriptorOptions, acmeRecordOptions, acmeStoredValues } from "./stored-acme.js";

const fromTest = (path: string) => readFileSync(new URL(`../../test/${path}`, import.meta.url), "utf8");
const refused = (message: string) => ({ message });

/** Skyvw's alarm declarations at 592e1eff5 (appspec/products/skyvw/settings/alarm-heights.ts), built with the kit's kinds. */
const alarmHeight = (id: string, wireName: string, defaultValue: number, step: number) =>
  storedInt({ id, wireName, store: "power-settings", unit: "m", min: 50, max: 6_000, step, defaultValue });
const alarmSwitch = (id: string, wireName: string) => storedFlag({ id, wireName, store: "power-settings", defaultValue: true });
const skyvwAlarms = [
  alarmHeight("alarm.break-off", "alarmBreakOffM", 1_500, 100), alarmHeight("alarm.pull", "alarmPullM", 1_200, 100),
  alarmHeight("alarm.hard-deck", "alarmHardDeckM", 600, 100), alarmHeight("alarm.downwind", "alarmDownwindM", 300, 50),
  alarmHeight("alarm.base", "alarmBaseM", 200, 50), alarmHeight("alarm.final", "alarmFinalM", 100, 50),
  alarmSwitch("alarm.break-off.enabled", "alarmBreakOffEnabled"), alarmSwitch("alarm.pull.enabled", "alarmPullEnabled"),
  alarmSwitch("alarm.downwind.enabled", "alarmDownwindEnabled"), alarmSwitch("alarm.base.enabled", "alarmBaseEnabled"),
  alarmSwitch("alarm.final.enabled", "alarmFinalEnabled"),
];
const appSpec = (name: string) => `com.adelost.skydivealtimeter.appspec.AppSpec${name}`;

test("flag and int descriptors are Skyvw's generated file byte for byte, from declarations whose JSON hashes the same", () => {
  const kotlin = emitStoredValueDescriptorsKotlin(skyvwAlarms, {
    packageName: "com.adelost.skydivealtimeter.appspec.generated", symbolPrefix: "Skyvw",
    sourceFile: "appspec/products/skyvw/settings/alarm-heights.ts",
    sourceSha: createHash("sha256").update(JSON.stringify(skyvwAlarms)).digest("hex"),
    symbols: { storedValue: appSpec("StoredValue"), flag: appSpec("FlagValue"), int: appSpec("IntValue"), long: appSpec("LongValue"),
      number: appSpec("NumberValue"), choice: appSpec("ChoiceValue"), text: appSpec("TextValue") },
  });
  assert.equal(kotlin, fromTest("golden/skyvw-stored-values.kt"));
});

test("the record is the golden file the Kotlin run compiles and runs", () => {
  assert.equal(emitStoredRecordKotlin(acmeStoredValues, acmeRecordOptions), fromTest("golden/stored-record.kt"));
});

test("the descriptors of every kind, with their store, are the golden file the Kotlin run compiles", () => {
  assert.equal(emitStoredValueDescriptorsKotlin(acmeStoredValues, acmeDescriptorOptions), fromTest("golden/stored-values.kt"));
});

const sound = acmeStoredValues[0];
const refusals: readonly (readonly [string, () => unknown, string])[] = [
  ["a record of nothing", () => emitStoredRecordKotlin([], acmeRecordOptions),
    "stored record 'Settings' is empty: a store with nothing to save has no record"],
  ["a record over two stores", () => emitStoredRecordKotlin([sound, storedFlag({ ...sound, id: "acme.dev", wireName: "devOn",
    property: "devOn", store: "acme-dev" })], acmeRecordOptions),
    "stored record 'Settings' mixes stores 'acme-settings' and 'acme-dev'"],
  ["a choice with no Kotlin enum", () => emitStoredRecordKotlin(acmeStoredValues, { ...acmeRecordOptions, nativeTypes: {} }),
    "stored choice 'acme.icon-style' has no Kotlin enum: add 'acme.icon-style': '<package.Enum>' to test/stored-acme.ts"],
  ["two ids that are one Kotlin name", () => emitStoredValueDescriptorsKotlin([sound, storedFlag({ ...sound, id: "acme-sound",
    wireName: "soundOnToo", property: "soundToo" })], acmeDescriptorOptions),
    "stored values 'acme.sound' and 'acme-sound' are one Kotlin name AcmeSound"],
  ["a record that breaks the catalog law", () => emitStoredRecordKotlin([sound, storedFlag({ ...sound, id: "acme.twin" })],
    acmeRecordOptions), "stored value 'acme.twin' reuses wire name 'soundOn', already saved by 'acme.sound'"],
];

for (const [law, emit, message] of refusals) {
  test(`refused: ${law}`, () => assert.throws(emit, refused(message)));
}

interface StoredCase {
  readonly name: string;
  readonly saved?: Readonly<Record<string, string>>;
  readonly fields?: Readonly<Record<string, string>>;
  readonly read?: Readonly<Record<string, string | null>>;
  readonly written?: Readonly<Record<string, string | null>>;
  readonly error?: string;
}

/** Each case's input and its expected outcome, derived from the declarations by hand, never captured from the emitter. */
const cases = JSON.parse(fromTest("fixtures/stored-acme.json")) as readonly StoredCase[];

/** `Int 100` -> `100`, `Long MIN_VALUE` -> `Long.MIN_VALUE`, `Float NaN` -> `Float.NaN`, `String x` -> `"x"`. */
function kotlinValue(typed: string): string {
  const [type, ...words] = typed.split(" ");
  const text = words.join(" ");
  switch (type) {
    case "Boolean": case "Int": return text;
    case "Long": return text === "MIN_VALUE" ? "Long.MIN_VALUE" : `${text}L`;
    case "Float": return text === "NaN" ? "Float.NaN" : `${text}f`;
    case "String": return kotlinStringLiteral(text);
    default: throw new Error(`fixture value '${typed}' names no Kotlin type`);
  }
}

/** The saved map a case starts from, as a Kotlin `mapOf`. */
const savedMap = (saved: Readonly<Record<string, string>>) =>
  `mapOf<String, Any?>(${Object.entries(saved).map(([key, typed]) => `${kotlinStringLiteral(key)} to ${kotlinValue(typed)}`).join(", ")})`;

/** The fields a case constructs a record with, as named arguments. */
const namedFields = (fields: Readonly<Record<string, string>>) =>
  Object.entries(fields).map(([property, typed]) => `${property} = ${kotlinValue(typed)}`).join(", ");

/** A key-value store that throws as SharedPreferences does on a mistyped read, and descriptor classes for every kind. */
const acmeStore = `package dev.acme.store

interface KeyValueStore {
    fun string(key: String): String?
    fun long(key: String, fallback: Long): Long
    fun int(key: String, fallback: Int): Int
    fun float(key: String, fallback: Float): Float
    fun boolean(key: String, fallback: Boolean): Boolean
}

class StrictKeyValues(private val saved: Map<String, Any?>) : KeyValueStore {
    override fun string(key: String): String? = saved[key]?.let { it as? String ?: mismatch(key, it, "String") }
    override fun long(key: String, fallback: Long): Long = saved[key]?.let { it as? Long ?: mismatch(key, it, "Long") } ?: fallback
    override fun int(key: String, fallback: Int): Int = saved[key]?.let { it as? Int ?: mismatch(key, it, "Int") } ?: fallback
    override fun float(key: String, fallback: Float): Float = saved[key]?.let { it as? Float ?: mismatch(key, it, "Float") } ?: fallback
    override fun boolean(key: String, fallback: Boolean): Boolean =
        saved[key]?.let { it as? Boolean ?: mismatch(key, it, "Boolean") } ?: fallback
    private fun mismatch(key: String, value: Any, asked: String): Nothing =
        throw ClassCastException("$key holds \${value::class.simpleName}, read as $asked")
}

enum class AcmeStore { ACME_SETTINGS }
sealed interface StoredValue { val id: String; val wireName: String; val store: AcmeStore }
data class FlagValue(override val id: String, override val wireName: String, override val store: AcmeStore,
    val defaultValue: Boolean) : StoredValue
data class IntValue(override val id: String, override val wireName: String, override val store: AcmeStore,
    val defaultValue: Int, val min: Int, val max: Int, val step: Int) : StoredValue
data class LongValue(override val id: String, override val wireName: String, override val store: AcmeStore,
    val defaultValue: Long?, val min: Long?, val max: Long?) : StoredValue
data class NumberValue(override val id: String, override val wireName: String, override val store: AcmeStore,
    val defaultValue: Float?, val min: Float?, val max: Float?, val step: Float?) : StoredValue
data class ChoiceValue(override val id: String, override val wireName: String, override val store: AcmeStore,
    val defaultValue: String, val values: List<String>) : StoredValue
data class TextValue(override val id: String, override val wireName: String, override val store: AcmeStore,
    val defaultValue: String) : StoredValue
`;

const iconStyle = (entries: string) => `package dev.acme.ui\n\nenum class IconStyle { ${entries} }\n`;

/** Prints one JSON line per case: what was read and written, or the read's failure; then every descriptor's key. */
const harness = `package dev.acme.stored

import dev.acme.store.StrictKeyValues
import org.json.JSONObject

private fun typed(value: Any?): Any = if (value == null) JSONObject.NULL else "\${value::class.simpleName} $value"
private fun json(values: Map<String, Any?>): JSONObject = JSONObject().also { out -> values.forEach { (key, value) -> out.put(key, typed(value)) } }
private fun written(record: GeneratedAcmeSettingsStored): JSONObject = json(mutableMapOf<String, Any?>().also(record::writeTo))
private fun fields(record: GeneratedAcmeSettingsStoredFields): Map<String, Any?> = mapOf(
${acmeStoredValues.map((value) => `    "${storedPropertyOf(value)}" to record.${storedPropertyOf(value)},`).join("\n")}
)

private fun fromSaved(saved: Map<String, Any?>): String = try {
    val record = GeneratedAcmeSettingsStored.read(StrictKeyValues(saved))
    JSONObject().put("read", json(fields(record))).put("written", written(record)).toString()
} catch (error: ClassCastException) {
    JSONObject().put("error", error.message).toString()
}

fun main() {
${cases.map(({ saved, fields }) => fields === undefined
    ? `    println(fromSaved(${savedMap(saved ?? {})}))`
    : `    println(JSONObject().put("written", written(GeneratedAcmeSettingsStored(${namedFields(fields)}))).toString())`).join("\n")}
    println(GeneratedAcmeStoredValues.all.joinToString(",") { it.wireName })
}
`;

const sources = (iconEntries: string) => ({
  "AcmeStore.kt": acmeStore, "IconStyle.kt": iconStyle(iconEntries), "Harness.kt": harness,
  "AcmeSettingsStored.kt": emitStoredRecordKotlin(acmeStoredValues, acmeRecordOptions),
  "AcmeStoredValues.kt": emitStoredValueDescriptorsKotlin(acmeStoredValues, acmeDescriptorOptions),
});

test("the emitted record reads, clamps and writes every case as declared, through a store that throws on a mistyped read",
  kotlinSkip, () => {
    for (const output of runKotlin(sources("FILLED, OUTLINE"), "dev.acme.stored.HarnessKt", [])) {
      const lines = output.trim().split("\n");
      assert.equal(lines.length, cases.length + 1);
      cases.forEach(({ name, saved: _saved, fields: _fields, ...expected }, index) => {
        assert.deepEqual(JSON.parse(lines[index]!), expected, name);
      });
      assert.equal(lines[cases.length], acmeStoredValues.map(({ wireName }) => wireName).join(","), "descriptor keys");
    }
  });

test("Kotlin refuses a native enum with an entry the declaration does not choose", kotlinSkip, () => {
  assert.throws(() => runKotlin(sources("FILLED, OUTLINE, SHARP"), "dev.acme.stored.HarnessKt", []), (error: unknown) => {
    const stderr = String((error as { readonly stderr?: unknown }).stderr);
    assert.match(stderr, /AcmeSettingsStored\.kt:.*'when' expression must be exhaustive/u);
    assert.match(stderr, /SHARP/u);
    return true;
  });
});
