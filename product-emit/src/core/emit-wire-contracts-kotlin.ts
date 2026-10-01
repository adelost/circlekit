import {
  contractFingerprint, validateContract, type LegoContract, type LegoContractRef, type LegoField,
  type LegoFiniteValueDeclaration, type LegoListRef, type LegoPrimitive,
} from "@v1d/product-spec";
import type { SourcedKotlinEmissionOptions } from "./emission-options.js";
import { kotlinEnumToken, kotlinIdentifier, kotlinStringLiteral } from "./kotlin-syntax.js";

/**
 * Wire contracts as Kotlin over org.json, declared once in TypeScript and read by `readContractPayload` on the server.
 *
 * Per contract, a data class whose init refuses a value outside a declared bound, a `toJson()` that writes every key
 * (JSONObject.NULL for a null nullable key, nothing for a null optional key), and a `parse(json)` that refuses what
 * the TypeScript read refuses: a missing, mistyped, out-of-range or undeclared value, an element a distinct list
 * repeats, and an unknown key unless the contract ignores it. An absent optional key reads as null. Finite fields are
 * enums that carry their wire value, lists `List<T>` (`Set<T>` when distinct), nested contracts their own class,
 * integers `Long` within ±(2^53−1), numbers finite `Double`.
 *
 * A field both optional and nullable is refused: Kotlin has one null for "absent" and "null", and a client that
 * cannot say which would clear what it meant to leave alone.
 */
export function emitWireContractsKotlin(
  contracts: readonly LegoContract[],
  finiteValues: readonly LegoFiniteValueDeclaration[],
  options: SourcedKotlinEmissionOptions,
): string {
  const names = wireNames(options.symbolPrefix);
  const emitted = collectContracts(contracts);
  const finites = referencedFinites(emitted, finiteValues);
  requireDistinctTypeNames(names, emitted, finites);
  const kotlin = `// GENERATED FILE. DO NOT EDIT.
// GENERATED FROM ${options.sourceFile}
// Declaration SHA-256: ${options.sourceSha}
package ${options.packageName}

import org.json.JSONArray
import org.json.JSONObject

${helpers(names)}

${[...finites.map((declaration) => finiteEnum(declaration, names)), ...emitted.map((contract) =>
    dataClass(contract, finites, names))].join("\n\n")}
`;
  const lines = kotlin.split("\n").length - 1;
  if (lines >= 500) throw new Error(`wire contracts Kotlin is ${lines} lines; split the contracts into two emissions`);
  return kotlin;
}

interface WireNames {
  readonly prefix: string;
  readonly value: string;
  readonly kind: string;
  readonly wire: string;
  readonly reader: string;
}

function wireNames(prefix: string): WireNames {
  const generated = `Generated${prefix}`;
  return { prefix: generated, value: `${generated}WireValue`, kind: `${generated}WireKind`, wire: `${generated}Wire`,
    reader: `${generated}WireReader` };
}

const typeName = (names: WireNames, id: string) => `${names.prefix}${kotlinIdentifier(id)}`;

/** The given contracts and every contract they nest, once each, in first-use order. */
function collectContracts(contracts: readonly LegoContract[]): readonly LegoContract[] {
  const byId = new Map<string, LegoContract>();
  const visit = (contract: LegoContract): void => {
    const known = byId.get(contract.id);
    if (known !== undefined) {
      if (known !== contract && contractFingerprint(known) !== contractFingerprint(contract)) {
        throw new Error(`two different wire contracts are named '${contract.id}'`);
      }
      return;
    }
    if (contract.boundary !== "wire") {
      throw new Error(`emitWireContractsKotlin emits wire contracts; '${contract.id}' has boundary '${contract.boundary}'`);
    }
    validateContract(contract);
    if (contract.fields.length === 0) throw new Error(`wire contract '${contract.id}' has no fields, so it has no data class`);
    byId.set(contract.id, contract);
    for (const field of contract.fields) {
      if (field.optional === true && field.nullable) {
        throw new Error(`wire contract '${contract.id}' field '${field.name}' is optional and nullable; a Kotlin client `
          + "cannot tell an absent key from null, so declare it optional or nullable");
      }
      const nested = nestedContract(field.value);
      if (nested !== undefined) visit(nested);
    }
  };
  contracts.forEach(visit);
  return [...byId.values()];
}

type WireKind =
  | { readonly kind: LegoPrimitive }
  | { readonly kind: "finite"; readonly ref: string }
  | { readonly kind: "record"; readonly contract: LegoContract };

type FieldKind = WireKind | { readonly kind: "list"; readonly element: WireKind; readonly distinct: boolean };

function kindOf(value: LegoField["value"]): FieldKind {
  if (typeof value !== "string" && "list" in value) {
    const list = value as LegoListRef;
    return { kind: "list", element: elementKind(list.list), distinct: list.distinct };
  }
  return elementKind(value);
}

function elementKind(value: LegoField["value"]): WireKind {
  if (typeof value === "string") return { kind: value };
  if ("contract" in value) return { kind: "record", contract: (value as LegoContractRef).contract };
  return { kind: "finite", ref: value.ref };
}

function nestedContract(value: LegoField["value"]): LegoContract | undefined {
  const kind = kindOf(value);
  const element = kind.kind === "list" ? kind.element : kind;
  return element.kind === "record" ? element.contract : undefined;
}

/** Every finite declaration a field or list element names, exactly once, in first-use order. */
function referencedFinites(
  contracts: readonly LegoContract[],
  finiteValues: readonly LegoFiniteValueDeclaration[],
): readonly LegoFiniteValueDeclaration[] {
  const used = new Map<string, LegoFiniteValueDeclaration>();
  for (const field of contracts.flatMap((contract) => contract.fields)) {
    const kind = kindOf(field.value);
    const element = kind.kind === "list" ? kind.element : kind;
    if (element.kind !== "finite" || used.has(element.ref)) continue;
    const declarations = finiteValues.filter(({ id }) => id === element.ref);
    if (declarations.length !== 1 || declarations[0]!.values.length === 0) {
      throw new Error(`finite '${element.ref}' needs exactly one nonempty value declaration`);
    }
    const declaration = declarations[0]!;
    const tokens = declaration.values.map(kotlinEnumToken);
    const invalid = declaration.values.find((value) => !/^[A-Za-z][A-Za-z0-9_]*$/u.test(kotlinEnumToken(value)));
    if (invalid !== undefined) throw new Error(`finite '${declaration.id}' value '${invalid}' is no Kotlin constant`);
    const twice = tokens.find((token, index) => tokens.indexOf(token) !== index);
    if (twice !== undefined) {
      const values = declaration.values.filter((value) => kotlinEnumToken(value) === twice);
      throw new Error(`finite '${declaration.id}' values '${values.join("' and '")}' are one Kotlin constant ${twice}`);
    }
    used.set(element.ref, declaration);
  }
  return [...used.values()];
}

function requireDistinctTypeNames(
  names: WireNames,
  contracts: readonly LegoContract[],
  finites: readonly LegoFiniteValueDeclaration[],
): void {
  const all = [names.value, names.kind, names.wire, names.reader,
    ...finites.map(({ id }) => typeName(names, id)), ...contracts.map(({ id }) => typeName(names, id))];
  const twice = all.find((name, index) => all.indexOf(name) !== index);
  if (twice !== undefined) throw new Error(`two wire declarations are emitted as Kotlin type ${twice}`);
}

function finiteEnum(declaration: LegoFiniteValueDeclaration, names: WireNames): string {
  return `/** Finite \`${declaration.id}\`, as written on the wire. */
enum class ${typeName(names, declaration.id)}(override val wire: String) : ${names.value} {
${declaration.values.map((value) => `    ${kotlinEnumToken(value)}(${kotlinStringLiteral(value)}),`).join("\n")}
}`;
}

const KOTLIN_KEYWORDS = new Set(["as", "break", "class", "continue", "do", "else", "false", "for", "fun", "if", "in",
  "interface", "is", "null", "object", "package", "return", "super", "this", "throw", "true", "try", "typealias",
  "typeof", "val", "var", "when", "while"]);
const property = (name: string) => KOTLIN_KEYWORDS.has(name) ? `\`${name}\`` : name;

function dataClass(contract: LegoContract, finites: readonly LegoFiniteValueDeclaration[], names: WireNames): string {
  const name = typeName(names, contract.id);
  const finiteName = (ref: string) => typeName(names, finites.find(({ id }) => id === ref)!.id);
  const fields = contract.fields.map((field) => ({ field, kind: kindOf(field.value), name: property(field.name) }));
  const properties = fields.map(({ field, kind, name: prop }) =>
    `    val ${prop}: ${kotlinType(kind, finiteName, names)}${nullable(field) ? "?" : ""}${field.optional === true ? " = null" : ""},`);
  const laws = fields.flatMap(({ field, name: prop }) => declaredLaws(contract, field, prop));
  const policy = contract.unknownFields === "ignore" ? "an unknown key is ignored" : "an unknown key is refused";
  return `/** Wire contract \`${contract.id}\`; ${policy}. */
data class ${name}(
${properties.join("\n")}
) {
${laws.length === 0 ? "" : `    init {\n${laws.map((law) => `        ${law}`).join("\n")}\n    }\n\n`}    fun toJson(): JSONObject {
        val json = JSONObject()
${fields.map(({ field, kind, name: prop }) => `        ${writeKey(field, kind, prop)}`).join("\n")}
        return json
    }

    companion object {
        const val CONTRACT = "${contract.id}"
        private val FIELDS = setOf(${contract.fields.map(({ name: key }) => `"${key}"`).join(", ")})

        fun parse(json: JSONObject): ${name} {
            val read = ${names.reader}(json, CONTRACT, FIELDS, ignoreUnknown = ${contract.unknownFields === "ignore"})
            return ${name}(
${fields.map(({ field, kind, name: prop }) => `                ${prop} = ${readKey(field, kind, finiteName, names)},`).join("\n")}
            )
        }
    }
}`;
}

const nullable = (field: LegoField) => field.nullable || field.optional === true;

function kotlinType(kind: FieldKind, finiteName: (ref: string) => string, names: WireNames): string {
  switch (kind.kind) {
    case "string": return "String";
    case "boolean": return "Boolean";
    case "integer": return "Long";
    case "number": return "Double";
    case "finite": return finiteName(kind.ref);
    case "record": return typeName(names, kind.contract.id);
    case "list": return `${kind.distinct ? "Set" : "List"}<${kotlinType(kind.element, finiteName, names)}>`;
  }
}

function readKind(kind: FieldKind, finiteName: (ref: string) => string, names: WireNames): string {
  switch (kind.kind) {
    case "string": case "boolean": case "integer": case "number": return `${names.wire}.${kind.kind}`;
    case "finite": return `${names.wire}.finite("${kind.ref}", ${finiteName(kind.ref)}.entries)`;
    case "record": return `${names.wire}.record("${kind.contract.id}") { ${typeName(names, kind.contract.id)}.parse(it) }`;
    case "list": return `${names.wire}.${kind.distinct ? "set" : "list"}(${readKind(kind.element, finiteName, names)})`;
  }
}

function readKey(field: LegoField, kind: FieldKind, finiteName: (ref: string) => string, names: WireNames): string {
  const reader = readKind(kind, finiteName, names);
  if (field.optional === true) return `read.optional("${field.name}", ${reader})`;
  return field.nullable ? `read.nullable("${field.name}", ${reader})` : `read.required("${field.name}", ${reader})`;
}

function writeValue(kind: FieldKind, value: string): string {
  switch (kind.kind) {
    case "finite": return `${value}.wire`;
    case "record": return `${value}.toJson()`;
    case "list": {
      const element = kind.element.kind === "finite" ? ".map { it.wire }" : kind.element.kind === "record" ? ".map { it.toJson() }" : "";
      return `JSONArray(${value}${element})`;
    }
    default: return value;
  }
}

/** A null optional key is left out; a null nullable key is written as JSONObject.NULL; every other key is written. */
function writeKey(field: LegoField, kind: FieldKind, prop: string): string {
  if (field.optional === true) return `if (${prop} != null) json.put("${field.name}", ${writeValue(kind, prop)})`;
  if (!field.nullable) return `json.put("${field.name}", ${writeValue(kind, prop)})`;
  const written = writeValue(kind, "it");
  const value = written === "it" ? prop : written.startsWith("it.") ? `${prop}?.${written.slice(3)}` : `${prop}?.let { ${written} }`;
  return `json.put("${field.name}", ${value} ?: JSONObject.NULL)`;
}

/** The declared bounds and sibling law of one field, so no instance outside them can be built. */
function declaredLaws(contract: LegoContract, field: LegoField, prop: string): readonly string[] {
  const where = `contract '${contract.id}' field '${field.name}'`;
  const orNull = (law: string) => nullable(field) ? `${prop} == null || ${law}` : law;
  const laws: string[] = [];
  if (field.min !== undefined || field.max !== undefined) {
    const literal = (bound: number) => field.value === "integer" && Number.isSafeInteger(bound) ? `${bound}L` : kotlinNumber(bound);
    const bounds = [field.min === undefined ? undefined : `${prop} >= ${literal(field.min)}`,
      field.max === undefined ? undefined : `${prop} <= ${literal(field.max)}`].filter((law) => law !== undefined);
    const unit = field.unit === undefined ? "" : ` ${field.unit}`;
    laws.push(`require(${orNull(bounds.join(" && "))}) { "${where}=\${${prop}} violates ${field.min ?? "-∞"}..${field.max ?? "∞"}${unit}" }`);
  }
  if (field.gteField !== undefined) {
    const other = contract.fields.find(({ name }) => name === field.gteField)!;
    const otherProp = property(other.name);
    const compare = `${prop} >= ${otherProp}`;
    const guarded = [nullable(field) ? `${prop} == null` : undefined, nullable(other) ? `${otherProp} == null` : undefined]
      .filter((guard) => guard !== undefined);
    laws.push(`require(${[...guarded, compare].join(" || ")}) { "${where}=\${${prop}} must be >= '${other.name}'=\${${otherProp}}" }`);
  }
  return laws;
}

/** A Kotlin Double literal for a finite bound: `-90` is `-90.0`, `1e+21` stays as it is. */
function kotlinNumber(value: number): string {
  const text = String(value);
  return /[.eE]/u.test(text) ? text : `${text}.0`;
}

function helpers(names: WireNames): string {
  return `/** A finite wire value: the declared string it is written as. */
interface ${names.value} {
    val wire: String
}

/** One declared kind of wire value read from what org.json parsed; a refusal names the contract and the field. */
class ${names.kind}<T : Any>(private val problem: String, private val convert: (Any, String, String) -> T?) {
    fun read(value: Any, contract: String, path: String): T =
        convert(value, contract, path) ?: throw IllegalArgumentException("contract '$contract' field '$path' must $problem")
}

/** The kinds a wire contract declares. An integer is whole and within the range JavaScript reads exactly. */
object ${names.wire} {
    const val MAX_SAFE_INTEGER = 9_007_199_254_740_991L

    val string = ${names.kind}("be string") { value, _, _ -> value as? String }
    val boolean = ${names.kind}("be boolean") { value, _, _ -> value as? Boolean }
    val number = ${names.kind}("be number") { value, _, _ -> (value as? Number)?.toDouble()?.takeIf { it.isFinite() } }
    val integer = ${names.kind}("be integer") { value, _, _ -> whole(value)?.takeIf { it in -MAX_SAFE_INTEGER..MAX_SAFE_INTEGER } }

    fun <E : ${names.value}> finite(id: String, entries: List<E>) =
        ${names.kind}("belong to finite '$id'") { value, _, _ -> entries.firstOrNull { it.wire == value } }

    fun <T : Any> record(id: String, parse: (JSONObject) -> T) =
        ${names.kind}("be a '$id' record") { value, _, _ -> (value as? JSONObject)?.let(parse) }

    fun <T : Any> list(element: ${names.kind}<T>) = ${names.kind}("be a list") { value, contract, path ->
        (value as? JSONArray)?.let { array -> List(array.length()) { index -> element.read(array.get(index), contract, "$path[$index]") } }
    }

    fun <T : Any> set(element: ${names.kind}<T>) = ${names.kind}<Set<T>>("be a list") { value, contract, path ->
        (value as? JSONArray)?.let { array ->
            val members = LinkedHashSet<T>()
            for (index in 0 until array.length()) {
                val member = element.read(array.get(index), contract, "$path[$index]")
                require(members.add(member)) { "contract '$contract' field '$path' repeats \${quoted(member)}" }
            }
            members
        }
    }

    private fun whole(value: Any): Long? = when (value) {
        is Int -> value.toLong()
        is Long -> value
        is Number -> value.toDouble().takeIf { it.isFinite() && it == Math.rint(it) }?.toLong()
        else -> null
    }

    private fun quoted(value: Any): String = when (value) {
        is ${names.value} -> "'\${value.wire}'"
        is String -> "'$value'"
        else -> value.toString()
    }
}

/** Reads one wire contract's keys: missing and null are refused unless the field says otherwise. */
class ${names.reader}(private val json: JSONObject, private val contract: String, fields: Set<String>, ignoreUnknown: Boolean) {
    init {
        if (!ignoreUnknown) for (key in json.keys()) require(key in fields) { "contract '$contract' has undeclared field '$key'" }
    }

    fun <T : Any> required(name: String, kind: ${names.kind}<T>): T {
        require(json.has(name)) { "contract '$contract' is missing field '$name'" }
        return kind.read(json.get(name), contract, name)
    }

    /** A key that must be present; its value may be null. */
    fun <T : Any> nullable(name: String, kind: ${names.kind}<T>): T? {
        require(json.has(name)) { "contract '$contract' is missing field '$name'" }
        val value = json.get(name)
        return if (value == JSONObject.NULL) null else kind.read(value, contract, name)
    }

    /** A key that may be absent, read as null; when present it is not null. */
    fun <T : Any> optional(name: String, kind: ${names.kind}<T>): T? =
        if (json.has(name)) kind.read(json.get(name), contract, name) else null
}`;
}
