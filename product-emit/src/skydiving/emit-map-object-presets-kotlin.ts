import { kotlinStringLiteral } from "../core/kotlin-syntax.js";
import type { KotlinEmissionOptions } from "../core/emission-options.js";

export interface MapObjectPresetSource {
  /** Preset id -> the tiers it draws, from MAP_OBJECT_PRESET_TIERS. */
  readonly presetTiers: Readonly<Record<string, readonly string[]>>;
  /** Layer setting id -> the tier declared on that layer. */
  readonly layerTiers: Readonly<Record<string, string>>;
}

/**
 * Which map object layers each preset draws, resolved from the tier declared
 * on every layer.
 *
 * Emitted rather than written in Kotlin because the alternative is a
 * fourteen-name list maintained by hand next to the one that already exists,
 * and the layer it forgets is the layer nobody sees. Here the membership is
 * COMPUTED from each layer's own declaration, so adding a layer without
 * choosing a tier is a type error in the product and adding one without
 * telling the map is impossible.
 */
export function emitMapObjectPresetsKotlin(
  source: MapObjectPresetSource,
  options: KotlinEmissionOptions,
): string {
  const layerIds = Object.keys(source.layerTiers);
  const rows = Object.entries(source.presetTiers).map(([preset, tiers]) => {
    const members = layerIds.filter((id) => tiers.includes(source.layerTiers[id]!));
    const listed = members.map((id) => `            ${kotlinStringLiteral(id)},`).join("\n");
    return members.length === 0
      ? `        ${kotlinStringLiteral(preset)} to emptySet(),`
      : `        ${kotlinStringLiteral(preset)} to setOf(\n${listed}\n        ),`;
  }).join("\n");

  return `package ${options.packageName}

// GENERATED from ProductSpec map object tiers - do not edit.
// SOURCE ${options.sourceSha}
object Generated${options.symbolPrefix}MapObjectPresets {
    /** Preset id -> the layer setting ids it draws. */
    val layersByPreset: Map<String, Set<String>> = mapOf(
${rows}
    )
}
`;
}
