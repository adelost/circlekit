import {
  contractFingerprint, validateContract, type LegoContract, type LegoContractRef, type LegoField,
  type LegoFiniteValueDeclaration, type LegoListRef, type LegoPrimitive,
} from "@v1d/product-spec";
import type { SourcedKotlinEmissionOptions } from "./emission-options.js";
import { kotlinEnumToken, kotlinIdentifier, kotlinStringLiteral } from "./kotlin-syntax.js";

/**
 * Wire contracts as Kotlin over org.json, declared once in TypeScript and read by `readContractPayload` on the server.
 *
 * Per contract, a data class with a `toJson()` that writes every key (JSONObject.NULL for a null nullable key, nothing
 * for a null optional key) and a `parse(json)` that refuses what the TypeScript read refuses, in the order it reads:
 * an unknown key unless the contract ignores it, then each declared key (missing, mistyped, out of range, undeclared,
 * repeated in a distinct list), then the sibling laws. The first fault throws the generated WireException with the
 * contract that was read and the dotted field path, as ContractPayloadError does. An absent optional key reads as
 * null. Finite fields are enums that carry their wire value, lists `List<T>` (`Set<T>` when distinct), nested
 * contracts their own class, integers `Long` within ±(2^53−1), numbers finite `Double`.
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
  readonly error: string;
  readonly place: string;
  readonly field: string;
}

function wireNames(prefix: string): WireNames {
  const generated = `Generated${prefix}`;
  return { prefix: generated, value: `${generated}WireValue`, kind: `${generated}WireKind`, wire: `${generated}Wire`,
    reader: `${generated}WireReader`, error: `${generated}WireException`, place: `${generated}WirePlace`,
    field: `${generated}WireField` };
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
  const all = [names.value, names.kind, names.wire, names.reader, names.error, names.place, names.field,
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
  const construct = `${name}(\n${fields.map(({ field, kind, name: prop }) =>
    `                ${prop} = ${readKey(field, kind, finiteName, names)},`).join("\n")}\n            )`;
  const siblings = fields.flatMap(({ field, name: prop }) => siblingLaw(contract, field, prop));
  const body = siblings.length === 0 ? `            return ${construct}`
    : `            val parsed = ${construct}\n${siblings.map((law) => `            ${law}`).join("\n")}\n            return parsed`;
  const policy = contract.unknownFields === "ignore" ? "an unknown key is ignored" : "an unknown key is refused";
  return `/** Wire contract \`${contract.id}\`; ${policy}. */
data class ${name}(
${properties.join("\n")}
) {
    fun toJson(): JSONObject {
        val json = JSONObject()
${fields.map(({ field, kind, name: prop }) => `        ${writeKey(field, kind, `this.${prop}`)}`).join("\n")}
        return json
    }

    companion object {
        const val CONTRACT = "${contract.id}"
        private val FIELDS = setOf(${contract.fields.map(({ name: key }) => `"${key}"`).join(", ")})

        fun parse(json: JSONObject): ${name} = parse(json, ${names.place}(CONTRACT, ""))

        internal fun parse(json: JSONObject, place: ${names.place}): ${name} {
            val read = ${names.reader}(json, CONTRACT, FIELDS, ignoreUnknown = ${contract.unknownFields === "ignore"}, place)
${body}
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
    case "record": return `${names.wire}.record("${kind.contract.id}") { record, at -> ${typeName(names, kind.contract.id)}.parse(record, at) }`;
    case "list": return `${names.wire}.${kind.distinct ? "set" : "list"}(${readKind(kind.element, finiteName, names)})`;
  }
}

/** A field's reader, with its declared bounds checked as soon as the value is read, as readContractPayload does. */
function readKey(field: LegoField, kind: FieldKind, finiteName: (ref: string) => string, names: WireNames): string {
  const bounds = field.min === undefined && field.max === undefined ? ""
    : `.within(${kotlinBound(field.min)}, ${kotlinBound(field.max)}, "${field.min ?? "-∞"}..${field.max ?? "∞"}${unitOf(field)}")`;
  const reader = `${readKind(kind, finiteName, names)}${bounds}`;
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

/**
 * A null optional key is left out; a null nullable key is written as JSONObject.NULL; every other key is written. The
 * value is read through `this.`, so a field named `json` or `it` is never the local of the same name.
 */
function writeKey(field: LegoField, kind: FieldKind, prop: string): string {
  if (field.optional === true) return `if (${prop} != null) json.put("${field.name}", ${writeValue(kind, prop)})`;
  if (!field.nullable) return `json.put("${field.name}", ${writeValue(kind, prop)})`;
  const written = writeValue(kind, "it");
  const value = written === "it" ? prop : written.startsWith("it.") ? `${prop}?.${written.slice(3)}` : `${prop}?.let { ${written} }`;
  return `json.put("${field.name}", ${value} ?: JSONObject.NULL)`;
}

/** A sibling law, checked after every key is read, where readContractPayload checks it. */
function siblingLaw(contract: LegoContract, field: LegoField, prop: string): readonly string[] {
  if (field.gteField === undefined) return [];
  const other = contract.fields.find(({ name }) => name === field.gteField)!;
  return [`read.atLeast("${field.name}", parsed.${prop}, "${other.name}", parsed.${property(other.name)}, "${unitOf(field)}")`];
}

const unitOf = (field: LegoField) => field.unit === undefined ? "" : ` ${field.unit}`;

/** A Kotlin Double for a bound, or null: `-90` is `-90.0`, `1e+21` stays as it is. */
function kotlinBound(value: number | undefined): string {
  if (value === undefined) return "null";
  const text = String(value);
  return /[.eE]/u.test(text) ? text : `${text}.0`;
}

function helpers(names: WireNames): string {
  return `/** A finite wire value: the declared string it is written as. */
interface ${names.value} {
    val wire: String
}

/** A wire payload that breaks its contract: \`contractId\` is the contract that was read, \`field\` the dotted path from its root. */
class ${names.error}(val contractId: String, val field: String, message: String) : IllegalArgumentException(message)

/** Where a record sits in a read: the contract the read started from and the dotted path to the record. */
class ${names.place}(val root: String, val path: String) {
    fun below(name: String) = if (path.isEmpty()) name else "$path.$name"
}

/** One value being read: its root and path for the exception, its own contract and name for the message. */
class ${names.field}(val root: String, val path: String, val contract: String, val name: String) {
    fun refuse(problem: String): Nothing = throw ${names.error}(root, path, "contract '$contract' field '$name'$problem")
    fun element(index: Int) = ${names.field}(root, "$path[$index]", contract, "$name[$index]")
}

/** One declared kind of wire value, read from what org.json parsed. */
class ${names.kind}<T : Any>(private val problem: String, private val convert: (Any, ${names.field}) -> T?) {
    fun read(value: Any, field: ${names.field}): T = convert(value, field) ?: field.refuse(" must $problem")

    /** The same kind with a number's declared bounds, refused as soon as the value is read. */
    fun within(min: Double?, max: Double?, bounds: String) = ${names.kind}<T>(problem) { value, field ->
        convert(value, field)?.also {
            val number = (it as Number).toDouble()
            if (min != null && number < min || max != null && number > max) field.refuse("=\${${names.wire}.js(number)} violates $bounds")
        }
    }
}

/** The kinds a wire contract declares. An integer is whole and within the range JavaScript reads exactly. */
object ${names.wire} {
    const val MAX_SAFE_INTEGER = 9_007_199_254_740_991L

    val string = ${names.kind}("be string") { value, _ -> value as? String }
    val boolean = ${names.kind}("be boolean") { value, _ -> value as? Boolean }
    /** A finite double; -0.0 reads as 0.0, one value as in JavaScript, so a distinct list holds it once. */
    val number = ${names.kind}("be number") { value, _ -> (value as? Number)?.toDouble()?.takeIf { it.isFinite() }?.plus(0.0) }
    val integer = ${names.kind}("be integer") { value, _ -> whole(value)?.takeIf { it in -MAX_SAFE_INTEGER..MAX_SAFE_INTEGER } }

    fun <E : ${names.value}> finite(id: String, entries: List<E>) =
        ${names.kind}("belong to finite '$id'") { value, _ -> entries.firstOrNull { it.wire == value } }

    fun <T : Any> record(id: String, parse: (JSONObject, ${names.place}) -> T) =
        ${names.kind}("be a '$id' record") { value, field -> (value as? JSONObject)?.let { parse(it, ${names.place}(field.root, field.path)) } }

    fun <T : Any> list(element: ${names.kind}<T>) = ${names.kind}("be a list") { value, field ->
        (value as? JSONArray)?.let { array -> List(array.length()) { index -> element.read(array.get(index), field.element(index)) } }
    }

    fun <T : Any> set(element: ${names.kind}<T>) = ${names.kind}<Set<T>>("be a list") { value, field ->
        (value as? JSONArray)?.let { array ->
            val members = LinkedHashSet<T>()
            for (index in 0 until array.length()) {
                val member = element.read(array.get(index), field.element(index))
                if (!members.add(member)) field.refuse(" repeats \${quoted(member)}")
            }
            members
        }
    }

    /** A number as JavaScript writes it in a message: a whole number has no ".0". */
    fun js(number: Double): String = if (number == Math.rint(number) && Math.abs(number) < 1e15) number.toLong().toString() else number.toString()

    private fun whole(value: Any): Long? = when (value) {
        is Int -> value.toLong()
        is Long -> value
        is Number -> value.toDouble().takeIf { it.isFinite() && it == Math.rint(it) }?.toLong()
        else -> null
    }

    private fun quoted(value: Any): String = when (value) {
        is ${names.value} -> "'\${value.wire}'"
        is String -> "'$value'"
        is Double -> js(value)
        else -> value.toString()
    }
}

/** Reads one wire record as readContractPayload does: an unknown key first, then each declared key in order. */
class ${names.reader}(
    private val json: JSONObject,
    private val contract: String,
    fields: Set<String>,
    ignoreUnknown: Boolean,
    private val place: ${names.place},
) {
    init {
        if (!ignoreUnknown) for (key in json.keys()) if (key !in fields) refuse(key, "contract '$contract' has undeclared field '$key'")
    }

    private fun refuse(name: String, message: String): Nothing = throw ${names.error}(place.root, place.below(name), message)
    private fun field(name: String) = ${names.field}(place.root, place.below(name), contract, name)
    private fun present(name: String): Any = if (json.has(name)) json.get(name) else refuse(name, "contract '$contract' is missing field '$name'")

    fun <T : Any> required(name: String, kind: ${names.kind}<T>): T = kind.read(present(name), field(name))

    /** A key that must be present; its value may be null. */
    fun <T : Any> nullable(name: String, kind: ${names.kind}<T>): T? =
        present(name).let { value -> if (value == JSONObject.NULL) null else kind.read(value, field(name)) }

    /** A key that may be absent, read as null; when present it is not null. */
    fun <T : Any> optional(name: String, kind: ${names.kind}<T>): T? = if (json.has(name)) kind.read(json.get(name), field(name)) else null

    /** A sibling law, checked after every key is read. */
    fun atLeast(name: String, value: Number?, other: String, otherValue: Number?, unit: String) {
        if (value == null || otherValue == null || value.toDouble() >= otherValue.toDouble()) return
        field(name).refuse("=\${${names.wire}.js(value.toDouble())} must be >= '$other'=\${${names.wire}.js(otherValue.toDouble())}$unit")
    }
}`;
}
