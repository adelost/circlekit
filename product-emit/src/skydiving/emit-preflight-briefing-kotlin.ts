import type { SourcedKotlinEmissionOptions } from "../core/emission-options.js";
import { kotlinEnumToken, kotlinStringLiteral } from "../core/kotlin-syntax.js";
import {
  type PreflightBriefingCatalog,
  type PreflightBriefingDefinition,
  validatePreflightBriefingCatalog,
} from "./preflight-briefing-model.js";

/** Emits typed, closed preflight rules for one exhaustive native evaluator. */
export function emitPreflightBriefingKotlin(
  catalog: PreflightBriefingCatalog,
  options: SourcedKotlinEmissionOptions,
): string {
  validatePreflightBriefingCatalog(catalog);
  const g = `Generated${options.symbolPrefix}`;
  return `// GENERATED FILE. DO NOT EDIT.
// GENERATED FROM ${options.sourceFile}
// Product declaration SHA-256: ${options.sourceSha}
package ${options.packageName}

@JvmInline value class ${g}PreflightMetricRef(val wireId: String)
@JvmInline value class ${g}PreflightStateRef(val wireId: String)
@JvmInline value class ${g}PreflightRampRef(val wireId: String)
@JvmInline value class ${g}PreflightIconRef(val wireId: String)
@JvmInline value class ${g}PreflightCopyRef(val wireId: String)
@JvmInline value class ${g}PreflightStateValue(val wireId: String)

enum class ${g}PreflightAvailability { REQUIRED, OPTIONAL }

sealed interface ${g}PreflightRule {
    data class CircularDelta(
        val metric: ${g}PreflightMetricRef,
        val minimumMagnitude: Float,
        val deltaDeg: Float,
    ) : ${g}PreflightRule

    data class RampCrossing(
        val metric: ${g}PreflightMetricRef,
        val ramp: ${g}PreflightRampRef,
    ) : ${g}PreflightRule

    data class StateProjection(
        val state: ${g}PreflightStateRef,
        val cautionValues: Set<${g}PreflightStateValue>,
        val abortValues: Set<${g}PreflightStateValue>,
    ) : ${g}PreflightRule
}

data class ${g}PreflightBriefingDefinition(
    val id: String,
    val label: String,
    val icon: ${g}PreflightIconRef,
    val copy: ${g}PreflightCopyRef,
    val availability: ${g}PreflightAvailability,
    val rule: ${g}PreflightRule,
)

object ${g}PreflightBriefingCatalog {
    val ALL: List<${g}PreflightBriefingDefinition> = listOf(
${catalog.definitions.map((definition) => emitDefinition(definition, g)).join(",\n")}
    )
    val BY_ID: Map<String, ${g}PreflightBriefingDefinition> = ALL.associateBy { it.id }
}
`;
}

function emitDefinition(definition: PreflightBriefingDefinition, g: string): string {
  return `        ${g}PreflightBriefingDefinition(
            id = ${q(definition.id)},
            label = ${q(definition.label)},
            icon = ${g}PreflightIconRef(${q(definition.iconRef)}),
            copy = ${g}PreflightCopyRef(${q(definition.copyRef)}),
            availability = ${g}PreflightAvailability.${kotlinEnumToken(definition.availability)},
            rule = ${emitRule(definition.rule, g)},
        )`;
}

function emitRule(rule: PreflightBriefingDefinition["rule"], g: string): string {
  switch (rule.kind) {
    case "circular-delta":
      return `${g}PreflightRule.CircularDelta(${g}PreflightMetricRef(${q(rule.metricRef)}), ${float(rule.minimumMagnitude)}, ${float(rule.deltaDeg)})`;
    case "ramp-crossing":
      return `${g}PreflightRule.RampCrossing(${g}PreflightMetricRef(${q(rule.metricRef)}), ${g}PreflightRampRef(${q(rule.rampRef)}))`;
    case "state-projection":
      return `${g}PreflightRule.StateProjection(${g}PreflightStateRef(${q(rule.stateRef)}), ${stateSet(rule.cautionValues, g)}, ${stateSet(rule.abortValues, g)})`;
  }
}

function stateSet(values: readonly string[], g: string): string {
  return values.length === 0
    ? "emptySet()"
    : `setOf(${values.map((value) => `${g}PreflightStateValue(${q(value)})`).join(", ")})`;
}

function q(value: string): string {
  return kotlinStringLiteral(value);
}

function float(value: number): string {
  return `${Number.isInteger(value) ? value.toFixed(1) : value}f`;
}
