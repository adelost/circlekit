import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { RING_ICON_ASSETS } from "../dist/src/ring-icon-assets.js";
import { CIRCLEKIT_STYLE } from "../dist/src/circle-style.js";
import { DEFAULT_COMPOSITE_ICON_STYLES } from "./ring-icon-native-styles.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const designkit = resolve(root, "designkit/src/main/java/com/adelost/designkit/ui");
const outputs = new Map([
  [resolve(designkit, "RingIcons.kt"), emitRingIcons()],
  [resolve(designkit, "RingIconPortableCatalog.kt"), emitCatalog()],
  [resolve(designkit, "CircleStyleTokens.kt"), emitCircleStyle()],
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
`/** Filled Ring geometry. Product semantics stay in portable ProductSpec data. */\n` +
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
  const entries = Object.entries(CIRCLEKIT_STYLE).map(([id, hex]) =>
    `    val ${pascal(id)} = Color(0xFF${hex.slice(1).toUpperCase()})`).join("\n");
  return `// GENERATED from circlekit-assets/src/circle-style.ts - do not edit.\n` +
`package com.adelost.designkit.ui\n\n` +
`import androidx.compose.ui.graphics.Color\n\n` +
`/** Opinionated cross-product chrome. Semantic product colour lives in ProductPalette. */\n` +
`object CircleStyleTokens {\n${entries}\n}\n`;
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
