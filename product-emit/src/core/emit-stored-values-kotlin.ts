import { storedValueCatalog, type StoredValueDeclaration } from "@v1d/product-spec";
import type { SourcedKotlinEmissionOptions } from "./emission-options.js";
import {
  kotlinEnumToken, kotlinFloatLiteral, kotlinIdentifier, kotlinLongLiteral, kotlinSimpleName, kotlinStringLiteral,
} from "./kotlin-syntax.js";

/** The product's native descriptor class per stored kind, fully qualified. The kit names no consumer class. */
export interface StoredValueDescriptorSymbols {
  readonly storedValue: string;
  readonly flag: string;
  readonly int: string;
  readonly long: string;
  readonly number: string;
  readonly choice: string;
  readonly text: string;
  /** The product's store enum. Named, every descriptor states `store = <Enum>.<STORE_ID>`; absent, none does. */
  readonly store?: string;
}

export interface StoredValueDescriptorOptions extends SourcedKotlinEmissionOptions {
  readonly symbols: StoredValueDescriptorSymbols;
}

const SYMBOL_OF = {
  "stored-flag": "flag", "stored-int": "int", "stored-long": "long",
  "stored-number": "number", "stored-choice": "choice", "stored-text": "text",
} as const satisfies { readonly [Kind in StoredValueDeclaration["kind"]]: keyof StoredValueDescriptorSymbols };

/**
 * One Kotlin object `Generated<Prefix>StoredValues` with a descriptor per stored value: its key, default and range as
 * declared, so a store reads them from the declaration and never types them again. Named arguments, so a search for
 * `wireName = "..."` finds every saved key; imports are the symbols the values use, sorted.
 */
export function emitStoredValueDescriptorsKotlin(values: readonly StoredValueDeclaration[],
  options: StoredValueDescriptorOptions): string {
  const catalog = storedValueCatalog(values);
  const names = distinctKotlinNames(catalog);
  const { symbols } = options;
  const used = new Set([symbols.storedValue, ...catalog.map(({ kind }) => symbols[SYMBOL_OF[kind]])]);
  if (symbols.store !== undefined && catalog.length > 0) used.add(symbols.store);
  return [
    "// GENERATED FILE. DO NOT EDIT.",
    `// GENERATED FROM ${options.sourceFile}`,
    `// Generator SHA-256: ${options.sourceSha}`,
    `package ${options.packageName}`,
    "",
    ...[...used].sort().map((symbol) => `import ${symbol}`),
    "",
    "/** Saved values with no settings row: each key, default and range as declared, read by the stores. */",
    `object Generated${options.symbolPrefix}StoredValues {`,
    ...catalog.map((value, index) => `    val ${names[index]} = ${descriptor(value, symbols)}`),
    "",
    `    val all: List<${kotlinSimpleName(symbols.storedValue)}> = listOf(${names.join(", ")})`,
    "}",
    "",
  ].join("\n");
}

function descriptor(value: StoredValueDeclaration, symbols: StoredValueDescriptorSymbols): string {
  const store = symbols.store === undefined ? "" : `, store = ${kotlinSimpleName(symbols.store)}.${kotlinEnumToken(value.store)}`;
  const call = (args: string) => `${kotlinSimpleName(symbols[SYMBOL_OF[value.kind]])}(id = ${kotlinStringLiteral(value.id)}, `
    + `wireName = ${kotlinStringLiteral(value.wireName)}${store}, ${args})`;
  switch (value.kind) {
    case "stored-flag":
      return call(`defaultValue = ${value.defaultValue}`);
    case "stored-int":
      return call(`defaultValue = ${value.defaultValue}, min = ${value.min}, max = ${value.max}, step = ${value.step}`);
    case "stored-long":
      return call(`defaultValue = ${orNull(value.defaultValue, kotlinLongLiteral)}, min = ${orNull(value.min, kotlinLongLiteral)}, `
        + `max = ${orNull(value.max, kotlinLongLiteral)}`);
    case "stored-number":
      return call(`defaultValue = ${orNull(value.defaultValue, kotlinFloatLiteral)}, `
        + `min = ${orNull(value.min, kotlinFloatLiteral)}, max = ${orNull(value.max, kotlinFloatLiteral)}, `
        + `step = ${orNull(value.step, kotlinFloatLiteral)}`);
    case "stored-choice":
      return call(`defaultValue = ${kotlinStringLiteral(value.defaultValue)}, `
        + `values = listOf(${value.values.map(kotlinStringLiteral).join(", ")})`);
    case "stored-text":
      return call(`defaultValue = ${kotlinStringLiteral(value.defaultValue)}`);
  }
}

/** Two ids that spell one Kotlin name would be one `val`; refused by both names. */
function distinctKotlinNames(values: readonly StoredValueDeclaration[]): readonly string[] {
  const owners = new Map<string, string>();
  return values.map(({ id }) => {
    const name = kotlinIdentifier(id);
    const owner = owners.get(name);
    if (owner !== undefined) throw new Error(`stored values '${owner}' and '${id}' are one Kotlin name ${name}`);
    owners.set(name, id);
    return name;
  });
}

function orNull(value: number | undefined, literal: (value: number) => string): string {
  return value === undefined ? "null" : literal(value);
}
