import type { SourcedKotlinEmissionOptions } from "../core/emission-options.js";
import type { HomeActionDeclaration } from "./home-action-model.js";
import type { HomeActionsNativeSymbols } from "./native-symbols.js";

/**
 * Projects the declared home tiles to the one list Kotlin iterates.
 *
 * The emitter knows nothing about what a tile says or does — only that it
 * exists, which group it belongs to, and where it comes in the sequence. The
 * catalogue is handed one declaration at a time and answers "what is this tile
 * right now", so it never gets to hold an order of its own.
 *
 * `reason` deliberately does NOT cross over. Kotlin never reads it, and an
 * emitted string nobody reads is ballast that makes the declaration look
 * decorative; the reason belongs where the decision is made, and the header
 * below is the pointer there.
 */
export function emitHomeActionsKotlin(
  actions: readonly HomeActionDeclaration[],
  options: SourcedKotlinEmissionOptions & {
    /**
     * Ids the round face lifts out of its paged run into a fixed place.
     *
     * Crosses over because the round host has to filter by it, and a host that
     * hardcodes the same id holds a second opinion about placement — the exact
     * split this layer exists to prevent. It also makes the declaration's own
     * page-break reasoning checkable against the screen it describes.
     */
    readonly watchChromeHoisted: readonly string[];
    readonly nativeSymbols: HomeActionsNativeSymbols;
  },
): string {
  if (actions.length === 0) throw new Error("no home actions declared");
  const declaredIds = new Set(actions.map((action) => action.id));
  for (const id of options.watchChromeHoisted) {
    if (!declaredIds.has(id)) {
      throw new Error(`watchChromeHoisted names '${id}', which no home action declares`);
    }
  }
  const generated = `Generated${options.symbolPrefix}`;
  const rows = actions.map((action) =>
    `        ${generated}HomeAction(HomeActionId.${action.id}, ` +
    `${generated}HomeActionGroup.${action.group}),`
  ).join("\n");
  // Derived from the declaration, never written out here. Hardcoding the
  // members meant a regrouped product emitted rows referencing constants the
  // same file did not declare — a generated file that could not compile, from
  // a generator that reported success.
  const groups = [...new Set(actions.map((action) => action.group))].join(", ");

  return `// GENERATED FILE. DO NOT EDIT.
// GENERATED FROM ${options.sourceFile}
// Generator SHA-256: ${options.sourceSha}
package ${options.packageName}

import ${options.nativeSymbols.homeActionId}

internal enum class ${generated}HomeActionGroup { ${groups} }

/** One tile's placement: which group it belongs to. */
internal data class ${generated}HomeAction(
    val id: HomeActionId,
    val group: ${generated}HomeActionGroup,
)

internal object ${generated}HomeActions {
    /**
     * The home surface's tiles, in the order the user meets them.
     *
     * This list IS the layout. Iterating it is the only way the catalogue
     * produces tiles, so nothing downstream can hold a second opinion about
     * order or grouping.
     */
    val all: List<${generated}HomeAction> = listOf(
${rows}
    )

    /**
     * Tiles the round face gives a fixed place instead of a paged slot.
     *
     * The round host filters its paged run by THIS set, so the declaration and
     * the screen cannot disagree about which tile is chrome.
     */
    val watchChromeHoisted: Set<HomeActionId> = setOf(
${options.watchChromeHoisted.map((id) => `        HomeActionId.${id},`).join("\n")}
    )
}
`;
}
