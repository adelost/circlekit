import type { SourcedKotlinEmissionOptions } from "../core/emission-options.js";
import type { StatusIndicatorDeclaration } from "./status-indicator-model.js";
import { STATUS_DISCLOSURES } from "./status-indicator-model.js";
import type { StatusIndicatorsNativeSymbols } from "./native-symbols.js";

/**
 * Projects the declared status indicators to the one list Kotlin iterates.
 *
 * The emitter knows nothing about what an indicator says, when it is visible,
 * or what it looks like — only that it exists, which seat it occupies, who
 * outranks whom in that seat, and whether it has a detail level. The host is
 * handed one declaration at a time and answers "should this be showing right
 * now, and what does it read", so it never gets to hold an opinion about
 * placement.
 *
 * `reason` deliberately does NOT cross over, for the same cause as the home
 * actions: Kotlin never reads it, and an emitted string nobody reads is
 * ballast that makes the declaration look decorative.
 */
export function emitStatusIndicatorsKotlin(
  indicators: readonly StatusIndicatorDeclaration[],
  options: SourcedKotlinEmissionOptions & {
    readonly nativeSymbols: StatusIndicatorsNativeSymbols;
  },
): string {
  if (indicators.length === 0) throw new Error("no status indicators declared");

  const problems: string[] = [];
  const seen = new Set<string>();
  // Priorities are checked PER SEAT rather than globally: two indicators that
  // can never appear in the same place have no contest to settle, and forcing
  // them apart would make the numbers a ranking of the whole product instead
  // of a tie-break where a tie is actually possible.
  const takenBySeat = new Map<string, Map<number, string>>();
  for (const indicator of indicators) {
    const where = `status indicator '${indicator.id}'`;
    if (seen.has(indicator.id)) problems.push(`${where} is declared twice`);
    seen.add(indicator.id);
    if (!Number.isInteger(indicator.priority)) {
      problems.push(`${where} has a non-integer priority; native emits an Int`);
    }
    const taken = takenBySeat.get(indicator.seat) ?? new Map<number, string>();
    const holder = taken.get(indicator.priority);
    if (holder !== undefined) {
      problems.push(
        `${where} and '${holder}' both claim priority ${indicator.priority} in seat `
        + `${indicator.seat}. Two indicators in one seat with one priority means the seat's `
        + "occupant depends on declaration order — give one of them a different priority, or "
        + "a seat of its own.",
      );
    }
    taken.set(indicator.priority, indicator.id);
    takenBySeat.set(indicator.seat, taken);
  }
  if (problems.length > 0) {
    throw new Error(`status indicators are not emittable:\n${problems.join("\n")}`);
  }

  const generated = `Generated${options.symbolPrefix}`;
  const rows = indicators.map((indicator) =>
    `        ${generated}StatusIndicator(`
    + `StatusIndicatorId.${indicator.id}, `
    + `${generated}StatusSeat.${indicator.seat}, `
    + `${indicator.priority}, `
    + `${generated}StatusDisclosure.${indicator.disclosure}),`
  ).join("\n");
  // Derived from the declaration, never written out here — hardcoding the
  // members is how a generated file comes to reference constants it does not
  // declare, from a generator that reports success.
  const seats = [...new Set(indicators.map((indicator) => indicator.seat))].join(", ");

  return `// GENERATED FILE. DO NOT EDIT.
// GENERATED FROM ${options.sourceFile}
// Generator SHA-256: ${options.sourceSha}
package ${options.packageName}

import ${options.nativeSymbols.statusIndicatorId}

/** The fixed places a surface reserves for what it says about itself. */
internal enum class ${generated}StatusSeat { ${seats} }

/** How much an indicator has to say: a glance, or a glance and a detail. */
internal enum class ${generated}StatusDisclosure { ${STATUS_DISCLOSURES.join(", ")} }

/**
 * One indicator's placement: which seat it occupies, who outranks whom in
 * that seat, and whether it has a detail level at all.
 */
internal data class ${generated}StatusIndicator(
    val id: StatusIndicatorId,
    val seat: ${generated}StatusSeat,
    val priority: Int,
    val disclosure: ${generated}StatusDisclosure,
)

internal object ${generated}StatusIndicators {
    /**
     * Every status indicator this product declares.
     *
     * This list IS the band. Iterating it is the only way a surface produces
     * status glyphs, so nothing downstream can hold a second opinion about
     * which seat something sits in — and adding an indicator is a change to
     * the declaration, never to a layout.
     *
     * Order here is declaration order, not precedence: precedence is
     * [${generated}StatusIndicator.priority], because a list that carried both
     * would let them disagree.
     */
    val all: List<${generated}StatusIndicator> = listOf(
${rows}
    )
}
`;
}
