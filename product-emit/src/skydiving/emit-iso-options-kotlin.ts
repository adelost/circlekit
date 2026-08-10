import { kotlinStringLiteral } from "../core/kotlin-syntax.js";
import type { SourcedKotlinEmissionOptions } from "../core/emission-options.js";
import {
  ISO_DATA_STATUS_SEVERITY,
  ISO_VIEW_SHEET_MAX,
  type IsoDataStatusDeclaration,
  type IsoOptionDeclaration,
} from "./iso-option-model.js";
import { type EmittableSetting, resolveIsoOption } from "./validate-iso-options.js";
import type { IsoOptionsNativeSymbols } from "./native-symbols.js";

export function emitIsoOptionsKotlin(
  options: readonly IsoOptionDeclaration[],
  settings: readonly EmittableSetting[],
  statuses: readonly IsoDataStatusDeclaration[],
  emission: SourcedKotlinEmissionOptions & { readonly nativeSymbols: IsoOptionsNativeSymbols },
): string {
  const missing = ISO_DATA_STATUS_SEVERITY
    .filter((state) => !statuses.some((declared) => declared.state === state));
  if (missing.length > 0) {
    // A total mapping or no boot: a state without a declared glyph would fall
    // through to whatever a renderer felt like, which is the silent default
    // this catalogue exists to make impossible.
    throw new Error(`iso data status is missing a declaration for ${missing.join(", ")}`);
  }
  const generated = `Generated${emission.symbolPrefix}`;
  const settingById = new Map(settings.map((setting) => [setting.id, setting]));
  const rows = options.map((option) => {
    const resolved = resolveIsoOption(option, settingById);
    const stateIcons = Object.entries(resolved.stateIcons)
      .map(([answer, icon]) => `${kotlinStringLiteral(answer)} to MenuIconToken.${icon}`)
      .join(", ");
    return (
      `        ${generated}IsoOption(${kotlinStringLiteral(resolved.key)}, ` +
      `${generated}IsoOptionTier.${option.tier}, ` +
      `RowKind.${option.kind ?? "ACTION"}, ` +
      `${generated}IsoOptionDismissal.${option.dismissal}, ` +
      `${kotlinStringLiteral(resolved.label)}, MenuIconToken.${resolved.icon}, ` +
      `${kotlinStringLiteral(resolved.hint)}, ` +
      `${stateIcons === "" ? "emptyMap()" : `mapOf(${stateIcons})`}),`
    );
  }).join("\n");

  const statusRows = ISO_DATA_STATUS_SEVERITY.map((state) => {
    const declared = statuses.find((candidate) => candidate.state === state)!;
    const glyph = declared.glyph === null ? "null" : `MenuIconToken.${declared.glyph}`;
    return (
      `        ${generated}IsoDataStatus.${state} to ${generated}IsoDataStatusFace(` +
      `${glyph}, MenuAccentToken.${declared.accent}, ${kotlinStringLiteral(declared.meaning)}),`
    );
  }).join("\n");

  return `// GENERATED FILE. DO NOT EDIT.
// GENERATED FROM ${emission.sourceFile}
// Generator SHA-256: ${emission.sourceSha}
package ${emission.packageName}

import com.adelost.ringkit.ui.RowKind
import ${emission.nativeSymbols.menuAccentToken}
import ${emission.nativeSymbols.menuIconToken}

/** Where an option may be asked, ordered by how often its answer changes. */
internal enum class ${generated}IsoOptionTier { RAIL, VIEW_SHEET, SETTINGS, JUNK }

/**
 * Whether answering this question takes you off the surface that asked it.
 *
 * A property of the QUESTION, for the same reason [${generated}IsoOption.kind]
 * is. It used to be a \`closeOnTap\` boolean every caller passed, with a
 * different default per builder, so whether a menu closed depended on the
 * widget a row was drawn as rather than on what the row did.
 */
internal enum class ${generated}IsoOptionDismissal { STAYS_ON_SURFACE, LEAVES_SURFACE }

/**
 * One option's whole identity plus its placement. A host supplies STATE and a
 * CALLBACK; it cannot supply a name, a picture or an explanation, because those
 * are properties of the question and drifted the moment two hosts each spelled
 * them out.
 */
internal data class ${generated}IsoOption(
    val key: String,
    val tier: ${generated}IsoOptionTier,
    /**
     * How many answers the question has. RowKind is THE row vocabulary; a
     * second enum here would be the same option described twice, which is how
     * one key became a toggle on the watch and a choice on the phone.
     */
    val kind: RowKind,
    /** Whether answering it leaves the surface. See the enum. */
    val dismissal: ${generated}IsoOptionDismissal,
    val label: String,
    val icon: MenuIconToken,
    val hint: String,
    /**
     * The icon per ANSWER. Empty means the option wears [icon] throughout.
     *
     * Keyed by the answer as the host prints it. The host holds the live list
     * of answers, so it is the host's builder that refuses a map naming some
     * of them and not others.
     */
    val stateIcons: Map<String, MenuIconToken>,
)

/**
 * What the one data-status slot is saying, worst first.
 *
 * Ordered by severity, so taking the lowest ordinal across several layers
 * picks the state that needs a person rather than the one that happened to be
 * checked first.
 */
internal enum class ${generated}IsoDataStatus { ${ISO_DATA_STATUS_SEVERITY.join(", ")} }

/** One state's whole presentation. A null glyph draws nothing at all. */
internal data class ${generated}IsoDataStatusFace(
    val glyph: MenuIconToken?,
    val accent: MenuAccentToken,
    val meaning: String,
)

internal object ${generated}IsoDataStatusFaces {
    /**
     * Total by construction: the emitter refuses to write this map unless every
     * declared state has a face, so a renderer never has to invent one.
     */
    val all: Map<${generated}IsoDataStatus, ${generated}IsoDataStatusFace> = mapOf(
${statusRows}
    )

    fun face(status: ${generated}IsoDataStatus): ${generated}IsoDataStatusFace =
        all.getValue(status)
}

internal object ${generated}IsoOptions {
    /**
     * Six rings fit one 192 dp face without scrolling.
     *
     * The declaration already refuses to exceed this, so no shipped option set
     * can break it. It stays reachable because a HOST assembles its own rows
     * at runtime and can still hand the sheet more than it declared.
     */
    const val VIEW_SHEET_MAX = ${ISO_VIEW_SHEET_MAX}

    /**
     * Every option any spatial host can build, in declared order.
     *
     * Tiers run as contiguous blocks, so the VIEW_SHEET block IS the canonical
     * view sheet — there is no second list to keep equal to this one.
     */
    val all: List<${generated}IsoOption> = listOf(
${rows}
    )
}
`;
}
