import { kotlinIdentifier, kotlinStringLiteral } from "../core/kotlin-syntax.js";
import type { KotlinEmissionOptions } from "../core/emission-options.js";

export interface MapProductDeclaration {
  readonly cacheRadiusM: number;
  readonly paletteId: string;
  readonly selections: readonly {
    readonly baseId: string;
    readonly providerId: string | null;
  }[];
  readonly orderedLayerIds: readonly string[];
  readonly capabilityIds: readonly string[];
}

/** Emits the portable product snapshot and exhaustive base selection table. */
export function emitMapProductKotlin(
  source: MapProductDeclaration,
  options: KotlinEmissionOptions,
): string {
  requireUnique(source.selections.map(({ baseId }) => baseId), "map base");
  requireUnique(source.orderedLayerIds, "map layer");
  requireUnique(source.capabilityIds, "map capability");
  const providerIds = source.selections.flatMap(({ providerId }) => providerId === null ? [] : [providerId]);
  requireUnique(providerIds, "map provider");
  const selections = source.selections.map(({ baseId, providerId }) =>
    `        ${kotlinStringLiteral(baseId)} to Generated${options.symbolPrefix}MapSelection(\n` +
    `            baseId = ${kotlinStringLiteral(baseId)},\n` +
    `            providerId = ${providerId === null ? "null" : kotlinStringLiteral(providerId)},\n` +
    `            product = product,\n` +
    "        ),"
  ).join("\n");
  const list = (values: readonly string[]) => values.length === 0
    ? "emptyList()"
    : `listOf(${values.map(kotlinStringLiteral).join(", ")})`;
  const set = (values: readonly string[]) => values.length === 0
    ? "emptySet()"
    : `setOf(${values.map(kotlinStringLiteral).join(", ")})`;

  return `package ${options.packageName}

// GENERATED from the ProductSpec map product - do not edit.
// SOURCE ${options.sourceSha}
data class Generated${options.symbolPrefix}MapProductSnapshot(
    val providerIds: List<String>,
    val cacheRadiusM: Int,
    val orderedLayerIds: List<String>,
    val capabilityIds: Set<String>,
    val paletteId: String,
)

data class Generated${options.symbolPrefix}MapSelection(
    val baseId: String,
    val providerId: String?,
    val product: Generated${options.symbolPrefix}MapProductSnapshot,
)

object Generated${options.symbolPrefix}MapProduct {
    val product = Generated${options.symbolPrefix}MapProductSnapshot(
        providerIds = ${list(providerIds)},
        cacheRadiusM = ${source.cacheRadiusM},
        orderedLayerIds = ${list(source.orderedLayerIds)},
        capabilityIds = ${set(source.capabilityIds)},
        paletteId = ${kotlinStringLiteral(source.paletteId)},
    )

    private val selections = mapOf(
${selections}
    )

    fun selection(baseId: String): Generated${options.symbolPrefix}MapSelection =
        requireNotNull(selections[baseId]) { "Undeclared map base: $baseId" }
}
`;
}

function requireUnique(values: readonly string[], kind: string): void {
  const duplicates = values.filter((value, index) => values.indexOf(value) !== index);
  if (duplicates.length > 0) throw new Error(`duplicate ${kind}: ${[...new Set(duplicates)].join(", ")}`);
  for (const value of values) kotlinIdentifier(value);
}
