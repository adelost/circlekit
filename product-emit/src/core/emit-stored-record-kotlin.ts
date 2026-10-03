import {
  storedPropertyOf, storedValueCatalog, type StoredLongDeclaration, type StoredNumberDeclaration, type StoredValueDeclaration,
} from "@v1d/product-spec";
import type { SourcedKotlinEmissionOptions } from "./emission-options.js";
import { kotlinFloatLiteral, kotlinLongLiteral, kotlinSimpleName, kotlinStringLiteral } from "./kotlin-syntax.js";

export interface StoredRecordKotlinOptions extends SourcedKotlinEmissionOptions {
  /** `Power` names the class `Generated<Prefix>PowerStored` and its interface `Generated<Prefix>PowerStoredFields`. */
  readonly recordName: string;
  /** The product's key-value store, fully qualified: `string(key)` and `int`/`long`/`float`/`boolean(key, fallback)`. */
  readonly keyValueStore: string;
  /** Each stored choice's native enum, fully qualified, by stored value id: a platform fact the product states. */
  readonly nativeTypes: Readonly<Record<string, string>>;
  /** Where the product keeps `nativeTypes`; the refusal that asks for a missing row names it. */
  readonly nativeTypesFile: string;
}

/** One field: its Kotlin type and default, how it is read from its key and what is written back under it. */
interface RecordField {
  readonly property: string;
  readonly key: string;
  readonly type: string;
  readonly defaultValue: string;
  readonly read: string;
  readonly write: string;
  readonly choice?: { readonly enumType: string; readonly values: readonly string[] };
}

/**
 * The typed record of one store: a data class with every stored value as a field with its declared default, an interface
 * a native state class implements by delegation, and the codec. `read` takes each key with its declared type: a missing
 * key or an unknown choice is the default, a ranged value is clamped, an optional outside its bounds is absent.
 * `writeTo` puts every key back, a ranged value clamped and an absent optional as null. Each choice's native enum is
 * bound by an exhaustive `when`, so Kotlin refuses an enum whose entries differ from the declared choices.
 */
export function emitStoredRecordKotlin(values: readonly StoredValueDeclaration[], options: StoredRecordKotlinOptions): string {
  const { recordName } = options;
  if (values.length === 0) throw new Error(`stored record '${recordName}' is empty: a store with nothing to save has no record`);
  const [store, other] = [...new Set(values.map((value) => value.store))];
  if (other !== undefined) throw new Error(`stored record '${recordName}' mixes stores '${store}' and '${other}'`);
  const fields = storedValueCatalog(values).map((value) => recordField(value, options));
  const record = `Generated${options.symbolPrefix}${recordName}Stored`;
  const imports = new Set([options.keyValueStore, ...fields.flatMap(({ choice }) => choice === undefined ? [] : [choice.enumType])]);
  return [
    "// GENERATED FILE. DO NOT EDIT.",
    `// GENERATED FROM ${options.sourceFile}`,
    `// Generator SHA-256: ${options.sourceSha}`,
    `package ${options.packageName}`,
    "",
    ...[...imports].sort().map((symbol) => `import ${symbol}`),
    "",
    `/** What the '${store}' store saves, as fields; a native state class implements them by delegating to [${record}]. */`,
    `interface ${record}Fields {`,
    ...fields.map(({ property, type }) => `    val ${property}: ${type}`),
    "}",
    "",
    `/** What the '${store}' store saves: each field under its declared key, with its declared default and range. */`,
    `data class ${record}(`,
    ...fields.map(({ property, type, defaultValue }) => `    override val ${property}: ${type} = ${defaultValue},`),
    `) : ${record}Fields {`,
    "    /** Every field under its key: a ranged value clamped, an absent optional as null. */",
    "    fun writeTo(changes: MutableMap<String, Any?>) {",
    ...fields.map(({ key, write }) => `        changes[${key}] = ${write}`),
    "    }",
    "",
    "    companion object {",
    "        /** Every field from its key: missing is the default, a ranged value is clamped, an optional out of bounds is absent. */",
    `        fun read(values: ${kotlinSimpleName(options.keyValueStore)}): ${record} = ${record}(`,
    ...fields.map(({ property, read }) => `            ${property} = ${read},`),
    "        )",
    "    }",
    "}",
    ...fields.flatMap(({ property, choice }) => choice === undefined ? [] : choiceParity(property, choice)),
    "",
  ].join("\n");
}

function recordField(value: StoredValueDeclaration, options: StoredRecordKotlinOptions): RecordField {
  const property = storedPropertyOf(value);
  const key = kotlinStringLiteral(value.wireName);
  const field = { property, key };
  switch (value.kind) {
    case "stored-flag":
      return { ...field, type: "Boolean", defaultValue: `${value.defaultValue}`,
        read: `values.boolean(${key}, ${value.defaultValue})`, write: `this.${property}` };
    case "stored-int": {
      const clamp = `.coerceIn(${value.min}, ${value.max})`;
      return { ...field, type: "Int", defaultValue: `${value.defaultValue}`,
        read: `values.int(${key}, ${value.defaultValue})${clamp}`, write: `this.${property}${clamp}` };
    }
    case "stored-long":
      return { ...field, ...ranged(value, property, key, { type: "Long", literal: kotlinLongLiteral, absent: "Long.MIN_VALUE",
        present: "it != Long.MIN_VALUE" }) };
    case "stored-number":
      return { ...field, ...ranged(value, property, key, { type: "Float", literal: kotlinFloatLiteral, absent: "Float.NaN",
        present: "it.isFinite()" }) };
    case "stored-choice": {
      const enumType = Object.hasOwn(options.nativeTypes, value.id) ? options.nativeTypes[value.id] : undefined;
      if (enumType === undefined) {
        throw new Error(`stored choice '${value.id}' has no Kotlin enum: add '${value.id}': '<package.Enum>' to ${options.nativeTypesFile}`);
      }
      const name = kotlinSimpleName(enumType);
      const fallback = `${name}.${value.defaultValue}`;
      return { ...field, type: name, defaultValue: fallback, write: `this.${property}.name`,
        read: `values.string(${key})?.let { s -> ${name}.entries.firstOrNull { it.name == s } }\n                ?: ${fallback}`,
        choice: { enumType, values: value.values } };
    }
    case "stored-text": {
      const fallback = kotlinStringLiteral(value.defaultValue);
      return { ...field, type: "String", defaultValue: fallback, read: `values.string(${key}) ?: ${fallback}`, write: `this.${property}` };
    }
  }
}

interface NumericKind {
  readonly type: "Long" | "Float";
  readonly literal: (value: number) => string;
  /** The fallback an optional read asks for, which no saved value equals. */
  readonly absent: string;
  readonly present: string;
}

/** A defaulted long or float is clamped to its stated bounds; an optional one outside them is absent. */
function ranged(value: StoredLongDeclaration | StoredNumberDeclaration, property: string, key: string, kind: NumericKind) {
  const { min, max } = value;
  const reader = `values.${kind.type.toLowerCase()}`;
  if (value.defaultValue === undefined) {
    const inside = [kind.present, ...min === undefined ? [] : [`it >= ${kind.literal(min)}`],
      ...max === undefined ? [] : [`it <= ${kind.literal(max)}`]];
    return { type: `${kind.type}?`, defaultValue: "null", read: `${reader}(${key}, ${kind.absent}).takeIf { ${inside.join(" && ")} }`,
      write: `this.${property}` };
  }
  const clamp = min !== undefined && max !== undefined ? `.coerceIn(${kind.literal(min)}, ${kind.literal(max)})`
    : min !== undefined ? `.coerceAtLeast(${kind.literal(min)})`
      : max !== undefined ? `.coerceAtMost(${kind.literal(max)})` : "";
  const fallback = kind.literal(value.defaultValue);
  return { type: kind.type, defaultValue: fallback, read: `${reader}(${key}, ${fallback})${clamp}`, write: `this.${property}${clamp}` };
}

function choiceParity(property: string, { enumType, values }: NonNullable<RecordField["choice"]>): readonly string[] {
  const name = kotlinSimpleName(enumType);
  return [
    "",
    "/** Kotlin refuses a native enum whose entries differ from the declared choices. */",
    `private fun declared${property[0]!.toUpperCase()}${property.slice(1)}(value: ${name}): Unit = `
      + `when (value) { ${values.map((choice) => `${name}.${choice}`).join(", ")} -> Unit }`,
  ];
}
