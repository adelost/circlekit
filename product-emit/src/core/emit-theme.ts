import {
  CHROMA_FLOOR_RATIO,
  STOPS_PER_BAND,
  type Ramp,
  type RampBand,
  type ThemeCatalogIr,
  type ThemeSpec,
} from "./theme-model.js";
import { kotlinIdentifier, kotlinStringLiteral } from "./kotlin-syntax.js";
import { CIRCLEKIT_STYLE } from "@v1d/circlekit-assets";
import type { CssEmissionOptions, SourcedKotlinEmissionOptions } from "./emission-options.js";

/**
 * Resolves the declaration to platform-ready sRGB and emits it for Kotlin and
 * CSS from the same pass, so the watch and the web cannot drift.
 *
 * OKLCH runs HERE, at build time, once. Neither runtime implements it: a phone
 * and a browser rounding a cube root differently would colour the same jump two
 * ways, which is a bug, not a style difference.
 */

function gamma(v: number): number {
  return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
}

/** OKLCH to sRGB hex, clamped. Out-of-gamut inputs clip rather than throw. */
export function oklchToHex(lightness: number, chroma: number, hueDeg: number): string {
  const h = (hueDeg * Math.PI) / 180;
  const a = chroma * Math.cos(h);
  const b = chroma * Math.sin(h);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ];
  return `#${rgb
    .map((v) => Math.max(0, Math.min(255, Math.round(gamma(Math.max(0, Math.min(1, v))) * 255))))
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("")}`;
}

/** Chroma carries magnitude inside a band; lightness barely moves. */
export function bandStops(band: RampBand): readonly string[] {
  if (band.solid) return [oklchToHex(band.lightness, band.chromaMax, band.hueDeg)];
  return Array.from({ length: STOPS_PER_BAND }, (_, index) => {
    const t = index / (STOPS_PER_BAND - 1);
    return oklchToHex(
      band.lightness - band.lightnessTravel * t,
      band.chromaMax * (CHROMA_FLOOR_RATIO + (1 - CHROMA_FLOOR_RATIO) * t),
      band.hueDeg,
    );
  });
}

export function emitThemeKotlin(ir: ThemeCatalogIr, options: SourcedKotlinEmissionOptions): string {
  const { symbolPrefix } = options;
  const fixed = ir.themes[0]!;
  const identity = Object.entries(fixed.identity)
    .map(([id, hex]) => `    val ${pascal(id)} = Color(0x${argb(hex)})`)
    .join("\n");
  const categories = fixed.categories
    .map((a) => `    /** ${a.meaning} */\n    val ${pascal(a.id)} = Color(0x${argb(a.hex)})`)
    .join("\n");
  const status = Object.entries(fixed.status)
    .map(([id, hex]) => `    val ${pascal(id)} = Color(0x${argb(hex)})`)
    .join("\n");
  const palettes = ir.themes.map((theme) => emitKotlinScalePalette(theme, symbolPrefix)).join("\n\n");
  const all = ir.themes.map((theme) => pascal(theme.native.nativeTheme)).join(", ");
  const resolver = ir.themes
    .map((theme) => `        ${theme.native.kotlinSymbol} -> ${pascal(theme.native.nativeTheme)}`)
    .join("\n");
  return `package ${options.packageName}

import androidx.compose.ui.graphics.Color
import com.adelost.designkit.ui.CircleColorTheme

// GENERATED from ${options.sourceFile} - do not edit.
// SOURCE ${options.sourceSha}
// REGISTRY ${ir.registrySourceSha} v${ir.nativeRegistryVersion}
//
// Editing a colour means editing the TypeScript declaration. The same pass emits
// the web's custom properties, so both surfaces move together or not at all.

enum class ThemeRampKind { SAFETY_ENVELOPE, MAGNITUDE }

/** [stops] is low end first. A solid band carries exactly one stop. */
data class ThemeBand(
    val id: String,
    val upTo: Float,
    val ruleEdge: Boolean,
    val label: String,
    val stops: List<Color>,
)

data class ThemeRamp(
    val id: String,
    val kind: ThemeRampKind,
    val unit: String,
    val bands: List<ThemeBand>,
) {
    /** The band a value falls in, and how far through it the value sits. */
    fun sample(value: Float): Color {
        var low = 0f
        for (band in bands) {
            if (value < band.upTo || band === bands.last()) {
                if (band.stops.size == 1) return band.stops.first()
                val span = (band.upTo - low).coerceAtLeast(1e-3f)
                val t = ((value - low) / span).coerceIn(0f, 1f)
                val at = t * (band.stops.size - 1)
                val index = at.toInt().coerceAtMost(band.stops.size - 2)
                return lerpColor(band.stops[index], band.stops[index + 1], at - index)
            }
            low = band.upTo
        }
        return bands.last().stops.last()
    }

    fun bandOf(value: Float): ThemeBand = bands.firstOrNull { value < it.upTo } ?: bands.last()
}

private fun lerpColor(from: Color, to: Color, t: Float) = Color(
    red = from.red + (to.red - from.red) * t,
    green = from.green + (to.green - from.green) * t,
    blue = from.blue + (to.blue - from.blue) * t,
    alpha = 1f,
)

/** Product identity tokens. CircleKit owns chrome and neutral surfaces. */
object ${symbolPrefix}PaletteIdentity {
${identity}
}

/** Fixed semantic categories. This is not the user-selectable theme axis. */
object ${symbolPrefix}PaletteCategory {
${categories}
}

/** Fixed ordered ok / watch / abort scale. Theme selection never retunes it. */
object ${symbolPrefix}PaletteStatus {
${status}
}

/** A theme may retune scales and bands only; native CircleColorTheme is the identity. */
data class ${symbolPrefix}ThemeScalePalette(
    val nativeTheme: CircleColorTheme,
    val wind: ThemeRamp,
    val altitude: ThemeRamp,
    val trackSpeed: ThemeRamp,
)

object Generated${symbolPrefix}ThemeScales {
${palettes}

    val All: List<${symbolPrefix}ThemeScalePalette> = listOf(${all})

    fun resolve(theme: CircleColorTheme): ${symbolPrefix}ThemeScalePalette = when (theme) {
${resolver}
    }
}
`;
}

export function emitThemeCss(ir: ThemeCatalogIr, options: CssEmissionOptions): string {
  const { tokenPrefix } = options;
  const fixed = ir.themes[0]!;
  const chrome = Object.entries(CIRCLEKIT_STYLE)
    .map(([id, hex]) => `  --circle-${kebab(id)}: ${hex};`)
    .join("\n");
  const identity = Object.entries(fixed.identity)
    .map(([id, hex]) => `  --${tokenPrefix}-identity-${id}: ${hex};`)
    .join("\n");
  const categories = fixed.categories.map((category) => `  --${tokenPrefix}-category-${category.id}: ${category.hex};`).join("\n");
  const fixedStatus = Object.entries(fixed.status)
    .map(([id, hex]) => `  --${tokenPrefix}-status-${id}: ${hex};`)
    .join("\n");
  const palettes = ir.themes.map((theme) => {
    const ramps = theme.ramps
      .flatMap((ramp) =>
        ramp.bands.flatMap((band) => {
          const stops = bandStops(band);
          const rows = stops.map((hex, index) => `  --${tokenPrefix}-${ramp.id}-${band.id}-${index}: ${hex};`);
          rows.push(`  --${tokenPrefix}-${ramp.id}-${band.id}: linear-gradient(90deg, ${stops.join(", ")});`);
          return rows;
        }),
      )
      .join("\n");
    return `[data-${tokenPrefix}-theme="${theme.native.nativeTheme}"] {\n${ramps}\n}`;
  }).join("\n\n");
  return `/* GENERATED from ${options.sourceFile} - do not edit.
   SOURCE ${options.sourceSha}
   REGISTRY ${ir.registrySourceSha} v${ir.nativeRegistryVersion}

   The same declaration emits the app's Kotlin. A jump reads the same colour on
   the watch and on the web because neither side chose the pigment. */
:root {
${chrome}

${identity}

${categories}

${fixedStatus}
}

${palettes}
`;
}

function emitKotlinScalePalette(theme: ThemeCatalogIr["themes"][number], symbolPrefix: string): string {
  const rampById = new Map(theme.ramps.map((ramp) => [ramp.id, ramp] as const));
  const ramp = (id: "wind" | "altitude" | "track-speed") => {
    const value = rampById.get(id);
    if (value === undefined) throw new Error(`theme ${theme.native.nativeTheme} is missing semantic ramp '${id}'`);
    return emitKotlinRamp(value, "        ");
  };
  return `    val ${pascal(theme.native.nativeTheme)} = ${symbolPrefix}ThemeScalePalette(
        nativeTheme = ${theme.native.kotlinSymbol},
        wind = ${ramp("wind")},
        altitude = ${ramp("altitude")},
        trackSpeed = ${ramp("track-speed")},
    )`;
}

function emitKotlinRamp(ramp: Ramp, indent: string): string {
  const bandIndent = `${indent}        `;
  const bands = ramp.bands.map((band) => {
    const stops = bandStops(band).map((hex) => `Color(0x${argb(hex)})`).join(", ");
    return `${bandIndent}ThemeBand(${kotlinStringLiteral(band.id)}, ${band.upTo}f, ruleEdge = ${band.ruleEdge}, label = ${kotlinStringLiteral(band.label)}, stops = listOf(${stops}))`;
  }).join(",\n");
  return `ThemeRamp(\n${indent}    id = ${kotlinStringLiteral(ramp.id)},\n${indent}    kind = ThemeRampKind.${ramp.kind === "magnitude" ? "MAGNITUDE" : "SAFETY_ENVELOPE"},\n${indent}    unit = ${kotlinStringLiteral(ramp.unit)},\n${indent}    bands = listOf(\n${bands},\n${indent}    ),\n${indent})`;
}

/**
 * `SEA_GLASS` / `off-nominal` -> `SeaGlass` / `OffNominal`.
 *
 * The ids reaching here are SCREAMING_SNAKE by construction (nativeTheme is
 * derived that way) or lower kebab (declared token ids), so the case of the
 * input carries no meaning and is flattened before the shared identifier rule
 * runs. That lowercase step is the ONLY thing this adds; the word splitting
 * and the validation come from kotlin-syntax rather than a local regex.
 */
function pascal(id: string): string {
  return kotlinIdentifier(id.toLowerCase());
}

function kebab(id: string): string {
  return id.replace(/[A-Z]/g, (character) => `-${character.toLowerCase()}`).replaceAll("_", "-");
}

function argb(hex: string): string {
  return `FF${hex.replace("#", "").toUpperCase()}`;
}

/**
 * The developer tools' token block, built from the same declaration the product
 * uses. The viewers hold no pigment of their own: change a colour in theme.ts
 * and the architecture views move with the watch.
 */
export function themeToolTokens(theme: ThemeSpec): string {
  const category = (id: string) => theme.categories.find((entry) => entry.id === id)!.hex;
  return [
    `background:${CIRCLEKIT_STYLE.surface};color:${CIRCLEKIT_STYLE.action}`,
    `--ink:${CIRCLEKIT_STYLE.action}`,
    `--muted:${CIRCLEKIT_STYLE.actionMuted}`,
    `--dim:${CIRCLEKIT_STYLE.faint}`,
    `--line:${CIRCLEKIT_STYLE.line}`,
    `--sky:${category("sky")}`,
    `--rain:${category("rain")}`,
    `--sun:${category("sun")}`,
    `--violet:${category("violet")}`,
    `--positive:${theme.status.ok}`,
    `--caution:${theme.status.caution}`,
    `--danger:${theme.status.danger}`,
  ].join(";");
}
