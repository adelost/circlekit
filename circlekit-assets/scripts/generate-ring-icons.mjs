import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { RING_ICON_ASSETS } from "../dist/src/ring-icon-assets.js";
import { CIRCLEKIT_ACCENTS, CIRCLEKIT_LINE, CIRCLEKIT_NEUTRAL_TONES, CIRCLEKIT_PRESS, CIRCLEKIT_STYLE, CIRCLEKIT_SWITCH, CIRCLEKIT_TONE, CIRCLEKIT_TEXT } from "../dist/src/circle-style.js";
import { circleTones } from "../dist/src/circle-tone.js";
import { DEFAULT_COMPOSITE_ICON_STYLES } from "./ring-icon-native-styles.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const designkit = resolve(root, "designkit/src/main/java/com/adelost/designkit/ui");
const outputs = new Map([
  [resolve(designkit, "RingIcons.kt"), emitRingIcons()],
  [resolve(designkit, "RingIconPortableCatalog.kt"), emitCatalog()],
  [resolve(designkit, "CircleStyleTokens.kt"), emitCircleStyle()],
  [resolve(designkit, "CircleTextRoles.kt"), emitCircleText()],
  [resolve(designkit, "CircleLine.kt"), emitCircleLine()],
  [resolve(designkit, "CirclePress.kt"), emitCirclePress()],
]);
const check = process.argv.includes("--check");
let drift = false;
for (const [path, content] of outputs) {
  if (check) {
    if (readFileSync(path, "utf8") !== content) {
      console.error(`portable icon output drift: ${path}`);
      drift = true;
    }
  } else {
    writeFileSync(path, content, "utf8");
  }
}
if (drift) process.exitCode = 1;

function emitCircleText() {
  const scale = CIRCLEKIT_TEXT.phoneFloorSp / CIRCLEKIT_TEXT.roles.note.sp;
  const float = value => `${Number(value.toFixed(6))}f`;
  const spec = (role, factor) => `CircleRoleStyle(${float(role.sp * factor)}, ${role.weight}, ${float(role.tracking)}, ${float((role.unitSp ?? role.sp) * factor)}, ${role.unitWeight ?? role.weight})`;
  const roles = Object.entries(CIRCLEKIT_TEXT.roles).map(([id, role]) =>
    `    data object ${id.toUpperCase()} : ${id === "number" ? "CircleTextRole" : "CircleWordRole"}("${id.toUpperCase()}", ${spec(role, 1)}, ${spec(role, scale)})`).join("\n");
  return `// GENERATED from circlekit-assets/src/circle-style.ts - do not edit.\n` +
    `package com.adelost.designkit.ui\n\n` +
    `data class CircleRoleStyle(val sp: Float, val weight: Int, val trackingEm: Float, val unitSp: Float, val unitWeight: Int)\n\n` +
    `enum class CircleTextFace { ONEST, BARLOW_SEMI_CONDENSED }\n\n` +
    `object CircleTextFaces { val Words = CircleTextFace.${CIRCLEKIT_TEXT.faces.words.toUpperCase().replaceAll(" ", "_")}; val Numerals = CircleTextFace.${CIRCLEKIT_TEXT.faces.numerals.toUpperCase().replaceAll(" ", "_")} }\n\n` +
    `sealed class CircleTextRole(val name: String, val watch: CircleRoleStyle, val phone: CircleRoleStyle) {\n${roles}\n` +
    `    companion object { val entries: List<CircleTextRole> get() = listOf(${Object.keys(CIRCLEKIT_TEXT.roles).map(id => id.toUpperCase()).join(", ")}) }\n}\n\n` +
    `/** Words cannot select NUMBER: only a typed value may occupy that role. */\n` +
    `sealed class CircleWordRole(name: String, watch: CircleRoleStyle, phone: CircleRoleStyle) : CircleTextRole(name, watch, phone)\n`;
}

function emitCircleLine() {
  const roles = Object.entries(CIRCLEKIT_LINE).map(([id, value]) =>
    `    const val ${pascal(id)}Dp = ${value}f\n    val ${pascal(id)} = ${pascal(id)}Dp.dp`).join("\n");
  return `// GENERATED from circlekit-assets/src/circle-style.ts - do not edit.\n` +
    `package com.adelost.designkit.ui\n\nimport androidx.compose.ui.unit.dp\n\n` +
    `/** Line roles at the canonical 192 dp face; density scaling belongs to the viewport. */\n` +
    `object CircleLine {\n${roles}\n}\n`;
}

function emitCirclePress() {
  const rungs = Object.entries(CIRCLEKIT_PRESS).map(([id, value]) =>
    `    const val ${id}: ${id.endsWith("Ms") ? "Long" : "Int"} = ${value}${id.endsWith("Ms") ? "L" : ""}`).join("\n");
  return `// GENERATED from circlekit-assets/src/circle-style.ts - do not edit.\n` +
    `package com.adelost.designkit.ui\n\n` +
    `/** The native and web press ladder share one declaration. */\nobject CirclePress {\n${rungs}\n}\n`;
}

function emitRingIcons() {
  const properties = RING_ICON_ASSETS.map((icon) => {
    const paths = icon.paths.map((path) => path.kind === "fill"
      ? `fill(${kotlinString(path.pathData)}, PathFillType.${path.fillRule === "evenodd" ? "EvenOdd" : "NonZero"})`
      : `stroke(${kotlinString(path.pathData)}, ${path.strokeWidth}f)`).join("; ");
    return `    val ${pascal(icon.id)}: ImageVector by lazy { glyph(${kotlinString(icon.id)}) { ${paths} } }`;
  }).join("\n");
  return `// GENERATED from circlekit-assets/src/ring-icon-assets.ts - do not edit.\n` +
`package com.adelost.designkit.ui\n\n` +
`import androidx.compose.ui.graphics.Color\n` +
`import androidx.compose.ui.graphics.PathFillType\n` +
`import androidx.compose.ui.graphics.SolidColor\n` +
`import androidx.compose.ui.graphics.StrokeCap\n` +
`import androidx.compose.ui.graphics.StrokeJoin\n` +
`import androidx.compose.ui.graphics.vector.ImageVector\n` +
`import androidx.compose.ui.graphics.vector.addPathNodes\n` +
`import androidx.compose.ui.unit.dp\n\n` +
`/** WHAT: Builds native vectors from the shared portable icon catalog.\n` +
` * WHY: Keeps product semantics separate from reusable filled geometry. */\n` +
`object RingIcons {\n` +
`    private fun glyph(name: String, paths: ImageVector.Builder.() -> Unit): ImageVector = ImageVector.Builder(\n` +
`        name = name, defaultWidth = 24.dp, defaultHeight = 24.dp,\n` +
`        viewportWidth = 24f, viewportHeight = 24f,\n` +
`    ).apply(paths).build()\n\n` +
`    private fun ImageVector.Builder.fill(data: String, fillType: PathFillType) {\n` +
`        addPath(\n` +
`            pathData = addPathNodes(data),\n` +
`            pathFillType = fillType,\n` +
`            fill = SolidColor(Color.White),\n` +
`        )\n` +
`    }\n\n` +
`    private fun ImageVector.Builder.stroke(data: String, width: Float) {\n` +
`        addPath(\n` +
`            pathData = addPathNodes(data), fill = null, stroke = SolidColor(Color.White),\n` +
`            strokeLineWidth = width, strokeLineCap = StrokeCap.Round,\n` +
`            strokeLineJoin = StrokeJoin.Round,\n` +
`        )\n` +
`    }\n\n${properties}\n}\n`;
}

function emitCatalog() {
  const icons = RING_ICON_ASSETS.map((icon) => `    RingIcons.${pascal(icon.id)},`).join("\n");
  const composites = RING_ICON_ASSETS.filter(({ layers }) => layers !== undefined).map((icon) => {
    const style = DEFAULT_COMPOSITE_ICON_STYLES[icon.id];
    if (style === undefined || style.layers.length !== icon.layers.length) {
      throw new Error(`native style for composite '${icon.id}' does not match geometry slots`);
    }
    const layers = icon.layers.map((layer, index) =>
      `CircleIconLayer(RingIcons.${pascal(layer.assetRef)}, CircleAccent.${constant(style.layers[index])})`).join(", ");
    return `    ${kotlinString(icon.id)} to CircleIconStyle(listOf(${layers}), primaryAccent = CircleAccent.${constant(style.primary)}),`;
  }).join("\n");
  return `// GENERATED from circlekit-assets/src/ring-icon-assets.ts - do not edit.\n` +
`package com.adelost.designkit.ui\n\n` +
`internal val PORTABLE_RING_ICON_CATALOG = listOf(\n${icons}\n)\n\n` +
`internal val PORTABLE_COMPOSITE_ICON_STYLES: Map<String, CircleIconStyle> by lazy { mapOf(\n${composites}\n) }\n`;
}

function emitCircleStyle() {
  const colour = (hex) => `Color(0xFF${hex.slice(1).toUpperCase()})`;
  const entries = Object.entries(CIRCLEKIT_STYLE).map(([id, hex]) => `    val ${pascal(id)} = ${colour(hex)}`).join("\n");
  const tone = Object.entries(CIRCLEKIT_TONE).map(([id, value]) => `    const val ${pascal(id)} = ${value}f`).join("\n");
  const neutral = Object.entries(CIRCLEKIT_NEUTRAL_TONES).map(([id, hex]) => `${id} = ${colour(hex)}`).join(", ");
  return `// GENERATED from circlekit-assets/src/circle-style.ts - do not edit.\n` +
`package com.adelost.designkit.ui\n\n` +
`import androidx.compose.ui.graphics.Color\n` +
`import androidx.compose.ui.unit.dp\n\n` +
`/** Opinionated cross-product chrome. Semantic product colour lives in ProductPalette. */\n` +
`object CircleStyleTokens {\n${entries}\n\n` +
`    /** The tones of a thing that is about no kind: a pointer, the weather, an icon without a colour. */\n` +
`    val NeutralTones = CircleTones(${neutral})\n}\n\n` +
`/** The house tone rule, as circle-tone.ts applies it at build time. Read, never re-implemented, at runtime. */\n` +
`object CircleToneRule {\n${tone}\n}\n\n` +
`/** The house colours of the kit's icon vocabulary, tones derived at build time. A product supplies its own. */\n` +
`internal val CIRCLE_ACCENT_DEFAULT_TONES: Map<CircleAccent, CircleTones> = mapOf(\n${accents()}\n)\n\n` +
`/** The on/off switch's geometry. */\n` +
`object CircleSwitchTokens {\n${dimensions(CIRCLEKIT_SWITCH)}\n}\n`;
}

function dimensions(group) {
  return Object.entries(group).map(([id, value]) => `    val ${pascal(id)} = ${value}.dp`).join("\n");
}

function accents() {
  const colour = (hex) => `Color(0xFF${hex.slice(1).toUpperCase()})`;
  return Object.entries(CIRCLEKIT_ACCENTS).map(([id, value]) => {
    const tones = typeof value === "string" ? circleTones(value) : value;
    const fields = ["strong", "dim", "ground", "edge"].map((key) => `${key} = ${colour(tones[key])}`).join(", ");
    return `    CircleAccent.${id.toUpperCase()} to CircleTones(${fields}),`;
  }).join("\n");
}

function kotlinString(value) {
  return JSON.stringify(value).replaceAll("$", "\\$");
}

function pascal(value) {
  return value.split("-").map((part) => part[0].toUpperCase() + part.slice(1)).join("");
}

function constant(value) {
  return value.replaceAll("-", "_").toUpperCase();
}
