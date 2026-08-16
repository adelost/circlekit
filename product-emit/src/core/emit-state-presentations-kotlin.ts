import type {
  CompiledStateAuthority,
  LegoField,
  LegoFiniteValueDeclaration,
  StatePresentationField,
} from "@v1d/product-spec";
import { adapterFields } from "@v1d/product-spec/foundation";
import type { KotlinEmissionOptions } from "./emission-options.js";
import {
  kotlinEnumToken,
  kotlinIdentifier,
  kotlinStringLiteral,
} from "./kotlin-syntax.js";

interface StatePresentationKotlinOptions extends KotlinEmissionOptions {
  readonly nativePortPackageName: string;
}

interface GeneratedStatePresentationFiles {
  readonly aggregate: string;
  readonly shards: readonly Readonly<{ suffix: string; content: string }>[];
}

/**
 * Keep the public generated registry stable while placing executable lookup
 * tables in bounded files. Authorities grow with product vocabulary; they must
 * not turn one generated Kotlin object into a new monolith.
 */
export function emitStatePresentationsKotlinFiles(
  authorities: readonly CompiledStateAuthority[],
  options: StatePresentationKotlinOptions,
): GeneratedStatePresentationFiles {
  const finiteValues = uniqueFiniteValues(authorities);
  const opaqueSourceValues = uniqueOpaqueSourceValues(authorities);
  const header = statePresentationHeader(options);
  const aggregate = `${header}
${finiteValues.map((declaration) => emitFiniteEnum(declaration, options)).join("\n")}
${opaqueSourceValues.map((ref) => `internal sealed interface ${opaqueSourceValueName(ref, options)}`).join("\n")}
${authorities.map((authority) => emitSourcePayload(authority, options)).join("\n")}
${authorities.map((authority) => emitPayload(authority, options)).join("\n")}
internal data class GeneratedStatePresentationFiniteValue(
    val id: String,
    val values: Set<String>,
    val nativeSymbol: kotlin.reflect.KClass<*>,
)

internal data class GeneratedStatePresentationAuthority(
    val id: String,
    val sourcePort: GeneratedProductOutputPortId,
    val stateField: String,
    val inputPort: GeneratedProductInputPortId,
    val outputPort: GeneratedProductOutputPortId,
    val componentInputs: Set<GeneratedProductInputPortId>,
)

internal object Generated${options.symbolPrefix}StatePresentations {
${authorities.map((authority) => `    val ${lookupName(authority)} get() = ${topLevelLookupName(authority, options)}`).join("\n")}

    val authorities: List<GeneratedStatePresentationAuthority> = listOf(
${authorities.map((authority) => `        ${lookupName(authority)}.authority,`).join("\n")}
    )

    val finiteValues: List<GeneratedStatePresentationFiniteValue> = listOf(
${finiteValues.map((declaration) => `        GeneratedStatePresentationFiniteValue(
            id = ${kotlinStringLiteral(declaration.id)},
            values = setOf(${declaration.values.map(kotlinStringLiteral).join(", ")}),
            nativeSymbol = ${finiteEnumName(declaration, options)}::class,
        ),`).join("\n")}
    )

    val nativePortsByBinding: Map<String, List<${options.nativePortPackageName}.NativeProductPortRegistration>> = mapOf(
${authorities.map((authority) => `        ${kotlinStringLiteral(lookupName(authority))} to listOf(
            ${lookupName(authority)}.nativeInputPort,
            ${lookupName(authority)}.outputPort,
        ),`).join("\n")}
    )
}
`;
  const shards = chunks(authorities, 4).map((group, index) => ({
    suffix: `Lookups${index}`,
    content: `${header}
${group.map((authority) => emitTopLevelLookup(authority, options)).join("\n")}
`,
  }));
  return { aggregate, shards };
}

function statePresentationHeader(options: StatePresentationKotlinOptions): string {
  return `// GENERATED FILE. DO NOT EDIT.
// GENERATED FROM ProductConfig.stateAuthorities
// Product declaration SHA-256: ${options.sourceSha}
package ${options.packageName}
`;
}

function emitTopLevelLookup(
  authority: CompiledStateAuthority,
  options: StatePresentationKotlinOptions,
): string {
  const nested = emitLookup(authority, options).replace(
    `    internal object ${lookupName(authority)} {`,
    `    internal object ${topLevelLookupName(authority, options)} {`,
  );
  return nested.split("\n").map((line) => line.startsWith("    ") ? line.slice(4) : line).join("\n");
}

function topLevelLookupName(
  authority: CompiledStateAuthority,
  options: StatePresentationKotlinOptions,
): string {
  return `Generated${options.symbolPrefix}StatePresentation${lookupName(authority)}`;
}

function chunks<T>(values: readonly T[], size: number): readonly (readonly T[])[] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

function emitFiniteEnum(
  declaration: LegoFiniteValueDeclaration,
  options: KotlinEmissionOptions,
): string {
  const name = finiteEnumName(declaration, options);
  return `internal enum class ${name} {
${declaration.values.map((value) => `    ${kotlinEnumToken(value)},`).join("\n")}
}`;
}

function emitPayload(authority: CompiledStateAuthority, options: KotlinEmissionOptions): string {
  const payload = payloadName(authority);
  const fields = authority.presentation.fields;
  return `internal data class ${payload}(
${fields.map((field) => `    val ${kotlinIdentifier(field.name)}: ${kotlinType(field, options)},`).join("\n")}
)`;
}

/**
 * The adapter input is a real generated contract type, not an erased registry
 * placeholder. Primitive and finite state fields stay concrete. A referenced
 * value whose schema is intentionally external to this contract remains an
 * opaque nominal type: the emitter must not invent its fields or fall back to
 * Any merely because the reference is opaque here.
 */
function emitSourcePayload(authority: CompiledStateAuthority, options: KotlinEmissionOptions): string {
  return `internal data class ${sourcePayloadName(authority)}(
${authority.source.contract.fields.map((field) =>
    `    val ${kotlinIdentifier(field.name)}: ${sourceFieldType(field, authority, options)}${field.nullable ? "?" : ""},`
  ).join("\n")}
)`;
}

function emitLookup(authority: CompiledStateAuthority, options: StatePresentationKotlinOptions): string {
  const name = lookupName(authority);
  const payload = payloadName(authority);
  const sourcePayload = sourcePayloadName(authority);
  const cases = Object.entries(authority.presentation.cases);
  return `    internal object ${name} {
        val nativeInputPort: ${options.nativePortPackageName}.ProductDataInput<${sourcePayload}> =
            object : ${options.nativePortPackageName}.ProductDataInput<${sourcePayload}>(
                Generated${options.symbolPrefix}NativeLegoCatalog.PortIds.${kotlinEnumToken(adapterFields(authority.adapter).inputPortRef)},
            ) {}
        val outputPort: ${options.nativePortPackageName}.ProductOutputPort<${payload}> =
            object : ${options.nativePortPackageName}.ProductOutputPort<${payload}>(
                Generated${options.symbolPrefix}NativeLegoCatalog.PortIds.${kotlinEnumToken(adapterFields(authority.adapter).outputPortRef)},
            ) {}
        val componentInputs: Map<GeneratedProductInputPortId, ${options.nativePortPackageName}.ProductComponentInput<${payload}>> = mapOf(
${authority.presentation.consumers.map((ref) => `            Generated${options.symbolPrefix}NativeLegoCatalog.PortIds.${kotlinEnumToken(ref)} to
                object : ${options.nativePortPackageName}.ProductComponentInput<${payload}>(
                    Generated${options.symbolPrefix}NativeLegoCatalog.PortIds.${kotlinEnumToken(ref)},
                ) {},`).join("\n")}
        )
        val authority = GeneratedStatePresentationAuthority(
            id = ${kotlinStringLiteral(authority.id)},
            sourcePort = Generated${options.symbolPrefix}NativeLegoCatalog.PortIds.${kotlinEnumToken(authority.source.portRef)},
            stateField = ${kotlinStringLiteral(authority.source.stateField)},
            inputPort = Generated${options.symbolPrefix}NativeLegoCatalog.PortIds.${kotlinEnumToken(adapterFields(authority.adapter).inputPortRef)},
            outputPort = Generated${options.symbolPrefix}NativeLegoCatalog.PortIds.${kotlinEnumToken(adapterFields(authority.adapter).outputPortRef)},
            componentInputs = setOf(
${authority.presentation.consumers.map((ref) => `                Generated${options.symbolPrefix}NativeLegoCatalog.PortIds.${kotlinEnumToken(ref)},`).join("\n")}
            ),
        )
        private val cases: Map<String, ${payload}> = mapOf(
${cases.map(([state, value]) => `            ${kotlinStringLiteral(state)} to ${payload}(${emitArguments(authority.presentation.fields, value, options)}),`).join("\n")}
        )
        val stateIds: Set<String> get() = cases.keys

        fun require(stateId: String): ${payload} = requireNotNull(cases[stateId]) {
            "Unknown ${authority.id} state '$stateId'"
        }
    }`;
}

function emitArguments(
  fields: readonly StatePresentationField[],
  value: Readonly<Record<string, unknown>>,
  options: KotlinEmissionOptions,
): string {
  return fields
    .map((field) => `${kotlinIdentifier(field.name)} = ${kotlinValue(field, value[field.name], options)}`)
    .join(", ");
}

function kotlinType(field: StatePresentationField, options: KotlinEmissionOptions): string {
  if (typeof field.value !== "string") return finiteEnumName(field.value, options);
  switch (field.value) {
    case "boolean": return "Boolean";
    case "integer": return "Long";
    case "number": return "Double";
    case "string": return "String";
  }
}

function kotlinValue(
  field: StatePresentationField,
  value: unknown,
  options: KotlinEmissionOptions,
): string {
  if (typeof field.value !== "string") {
    if (typeof value !== "string") throw new Error(`${field.name} finite presentation value is not a string`);
    return `${finiteEnumName(field.value, options)}.${kotlinEnumToken(value)}`;
  }
  switch (field.value) {
    case "boolean":
      if (typeof value !== "boolean") break;
      return value ? "true" : "false";
    case "integer":
      if (typeof value !== "number" || !Number.isInteger(value)) break;
      return `${value}L`;
    case "number":
      if (typeof value !== "number" || !Number.isFinite(value)) break;
      return Number.isInteger(value) ? `${value}.0` : String(value);
    case "string":
      if (typeof value !== "string") break;
      return kotlinStringLiteral(value);
  }
  throw new Error(`${field.name} presentation value does not match ${String(field.value)}`);
}

function uniqueFiniteValues(
  authorities: readonly CompiledStateAuthority[],
): readonly LegoFiniteValueDeclaration[] {
  const values = new Map<string, LegoFiniteValueDeclaration>();
  for (const authority of authorities) {
    addFiniteValue(values, authority.source.states);
    for (const field of authority.presentation.fields) {
      if (typeof field.value === "string") continue;
      addFiniteValue(values, field.value);
    }
  }
  return [...values.values()];
}

function addFiniteValue(
  values: Map<string, LegoFiniteValueDeclaration>,
  declaration: LegoFiniteValueDeclaration,
): void {
  const previous = values.get(declaration.id);
  if (previous !== undefined && !sameValues(previous.values, declaration.values)) {
    throw new Error(`State presentation finite '${declaration.id}' has conflicting values`);
  }
  values.set(declaration.id, declaration);
}

function uniqueOpaqueSourceValues(authorities: readonly CompiledStateAuthority[]): readonly string[] {
  const finiteIds = new Set(authorities.map(({ source }) => source.states.id));
  const refs = new Set<string>();
  for (const authority of authorities) {
    for (const field of authority.source.contract.fields) {
      if (typeof field.value === "string" || finiteIds.has(field.value.ref)) continue;
      refs.add(field.value.ref);
    }
  }
  return [...refs].sort();
}

function sourceFieldType(
  field: LegoField,
  authority: CompiledStateAuthority,
  options: KotlinEmissionOptions,
): string {
  if (typeof field.value !== "string") {
    return field.value.ref === authority.source.states.id
      ? finiteEnumName(authority.source.states, options)
      : opaqueSourceValueName(field.value.ref, options);
  }
  switch (field.value) {
    case "boolean": return "Boolean";
    case "integer": return "Long";
    case "number": return "Double";
    case "string": return "String";
  }
}

function opaqueSourceValueName(ref: string, options: KotlinEmissionOptions): string {
  return `Generated${options.symbolPrefix}${kotlinIdentifier(ref)}Value`;
}

function sameValues(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function finiteEnumName(
  declaration: LegoFiniteValueDeclaration,
  options: KotlinEmissionOptions,
): string {
  return `Generated${options.symbolPrefix}${kotlinIdentifier(declaration.id)}`;
}

function payloadName(authority: CompiledStateAuthority): string {
  return `Generated${kotlinIdentifier(authority.presentation.id)}Payload`;
}

function sourcePayloadName(authority: CompiledStateAuthority): string {
  return `Generated${kotlinIdentifier(authority.id)}SourcePayload`;
}

function lookupName(authority: CompiledStateAuthority): string {
  return kotlinIdentifier(authority.id);
}
