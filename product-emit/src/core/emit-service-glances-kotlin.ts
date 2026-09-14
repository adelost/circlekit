import type { SourcedKotlinEmissionOptions } from "./emission-options.js";
import { kotlinStringLiteral } from "./kotlin-syntax.js";
import {
  SERVICE_GLANCE_UNITS,
  serviceGlanceDeclaredIntervalMs,
  serviceGlanceUnit,
  validateServiceGlances,
  type ServiceGlanceDeclaration,
  type ServiceGlanceRules,
} from "./service-glance-model.js";

export interface ServiceGlanceKotlinOptions<IconRef extends string> extends SourcedKotlinEmissionOptions {
  /** Fully qualified native types the rows are built from: the owner identity and the icon enum. */
  readonly nativeSymbols: { readonly source: string; readonly icon: string };
  /** Anything else the source expressions name. */
  readonly imports?: readonly string[];
  /** The native owner identity of one glance, as a Kotlin expression of the `source` type. */
  readonly sourceOf: (glance: ServiceGlanceDeclaration<IconRef>) => string;
}

/**
 * The one list a native strip iterates. Each row carries its owner identity, spoken label, icon, unit and, where the
 * declaration knows it, the interval the ring counts against; everything live stays with the owner.
 */
export function emitServiceGlancesKotlin<IconRef extends string>(
  glances: readonly ServiceGlanceDeclaration<IconRef>[],
  rules: ServiceGlanceRules<IconRef>,
  options: ServiceGlanceKotlinOptions<IconRef>,
): string {
  validateServiceGlances(glances, rules);
  const generated = `Generated${options.symbolPrefix}`;
  const simple = (qualified: string) => qualified.slice(qualified.lastIndexOf(".") + 1);
  const rows = glances.map((glance) => {
    const interval = serviceGlanceDeclaredIntervalMs(glance);
    return `        ${generated}ServiceGlance(${options.sourceOf(glance)}, ${kotlinStringLiteral(glance.label)}, `
      + `${simple(options.nativeSymbols.icon)}.${glance.icon}, ${generated}ServiceGlanceUnit.${serviceGlanceUnit(glance)}, `
      + `${interval === undefined ? "null" : `${interval}L`}),`;
  }).join("\n");
  const imports = [...new Set([options.nativeSymbols.source, options.nativeSymbols.icon, ...(options.imports ?? [])])]
    .sort().map((symbol) => `import ${symbol}`).join("\n");
  return `// GENERATED FILE. DO NOT EDIT.
// GENERATED FROM ${options.sourceFile}
// Generator SHA-256: ${options.sourceSha}
package ${options.packageName}

${imports}

/** What a glyph's number means. */
internal enum class ${generated}ServiceGlanceUnit { ${SERVICE_GLANCE_UNITS.join(", ")} }

/** One declared service as a strip draws it; [declaredIntervalMs] is null where the owner measures it. */
internal data class ${generated}ServiceGlance(
    val source: ${simple(options.nativeSymbols.source)},
    val label: String,
    val icon: ${simple(options.nativeSymbols.icon)},
    val unit: ${generated}ServiceGlanceUnit,
    val declaredIntervalMs: Long?,
)

internal object ${generated}ServiceGlances {
    val all: List<${generated}ServiceGlance> = listOf(
${rows}
    )

    fun require(source: ${simple(options.nativeSymbols.source)}): ${generated}ServiceGlance =
        requireNotNull(all.firstOrNull { it.source == source }) { "No service glance declared for $source" }
}
`;
}
