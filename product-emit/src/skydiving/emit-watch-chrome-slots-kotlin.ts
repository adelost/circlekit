import type { SourcedKotlinEmissionOptions } from "../core/emission-options.js";
import type { WatchChromeSlotDeclaration } from "./watch-chrome-slot-model.js";

/**
 * Projects the declared clock arrangement to the one table Kotlin reads.
 *
 * CircleChromeSlot is CircleKit's own vocabulary and the emitted table names it
 * directly. A parallel enum here would be the same position described twice,
 * which is exactly how a control ends up at nine in one file and ten in
 * another.
 */
export function emitWatchChromeSlotsKotlin(
  slots: WatchChromeSlotDeclaration,
  options: SourcedKotlinEmissionOptions,
): string {
  const list = (hours: readonly string[]) =>
    hours.map((hour) => `CircleChromeSlot.${hour}`).join(", ");

  return `// GENERATED FILE. DO NOT EDIT.
// GENERATED FROM ${options.sourceFile}
// Generator SHA-256: ${options.sourceSha}
package ${options.packageName}

import com.adelost.designkit.ui.CircleChromeSlot

/**
 * Which clock hour each round-face control owns.
 *
 * Absolute, never a function of the item count: muscle memory is the whole
 * point, so a catalogue that grows must not move a single button.
 */
internal object Generated${options.symbolPrefix}WatchChromeSlots {
    /** Escape. Present at every level, on every page. */
    val back: CircleChromeSlot = CircleChromeSlot.${slots.back}

    /** Forward one page. Shown only when a further page exists. */
    val next: CircleChromeSlot = CircleChromeSlot.${slots.next}

    /** Back one page. Shown only once paged away from the first. */
    val previous: CircleChromeSlot = CircleChromeSlot.${slots.previous}

    /** Where a page's items land, in fill order. */
    val items: List<CircleChromeSlot> = listOf(${list(slots.items)})

    /** Shell rail buttons, MODE first. Surfaces with a rail have no pager. */
    val rail: List<CircleChromeSlot> = listOf(${list(slots.rail)})

    /**
     * The one data-status slot. Occupied only when a surface has something to
     * report, so on a healthy scene this hour draws nothing at all.
     */
    val status: CircleChromeSlot = CircleChromeSlot.${slots.status}
}
`;
}
