import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { RING_ICON_ASSETS } from "../dist/src/ring-icon-assets.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const designkit = resolve(root, "designkit/src/main/java/com/adelost/designkit/ui");
const outputs = new Map([
  [resolve(designkit, "RingIcons.kt"), emitRingIcons()],
  [resolve(designkit, "RingIconPortableCatalog.kt"), emitCatalog()],
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
    const fills = icon.paths.filter(({ kind }) => kind === "fill");
    const strokes = icon.paths.filter(({ kind }) => kind === "stroke");
    const evenOdd = fills.some(({ fillRule }) => fillRule === "evenodd");
    if (fills.some(({ fillRule }) => (fillRule === "evenodd") !== evenOdd)) {
      throw new Error(`icon '${icon.id}' mixes fill rules inside one native glyph`);
    }
    const strokeWidths = new Set(strokes.map(({ strokeWidth }) => strokeWidth));
    if (strokeWidths.size > 1) throw new Error(`icon '${icon.id}' mixes native stroke widths`);
    const args = [kotlinString(icon.id)];
    if (fills.length > 0) args.push(`fills = listOf(${fills.map(({ pathData }) => kotlinString(pathData)).join(", ")})`);
    if (strokes.length > 0) args.push(`strokes = listOf(${strokes.map(({ pathData }) => kotlinString(pathData)).join(", ")})`);
    const strokeWidth = [...strokeWidths][0];
    if (strokeWidth !== undefined && strokeWidth !== 2.6) args.push(`strokeWidth = ${strokeWidth}f`);
    if (evenOdd) args.push("evenOdd = true");
    return `    val ${pascal(icon.id)}: ImageVector by lazy { glyph(${args.join(", ")}) }`;
  }).join("\n");
  return `// GENERATED from product-spec/src/ring-icon-assets.ts - do not edit.\n` +
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
`    private fun glyph(\n` +
`        name: String,\n` +
`        fills: List<String> = emptyList(),\n` +
`        strokes: List<String> = emptyList(),\n` +
`        strokeWidth: Float = 2.6f,\n` +
`        evenOdd: Boolean = false,\n` +
`    ): ImageVector = ImageVector.Builder(\n` +
`        name = name, defaultWidth = 24.dp, defaultHeight = 24.dp,\n` +
`        viewportWidth = 24f, viewportHeight = 24f,\n` +
`    ).apply {\n` +
`        fills.forEach { data -> addPath(\n` +
`            pathData = addPathNodes(data),\n` +
`            pathFillType = if (evenOdd) PathFillType.EvenOdd else PathFillType.NonZero,\n` +
`            fill = SolidColor(Color.White),\n` +
`        ) }\n` +
`        strokes.forEach { data -> addPath(\n` +
`            pathData = addPathNodes(data), fill = null, stroke = SolidColor(Color.White),\n` +
`            strokeLineWidth = strokeWidth, strokeLineCap = StrokeCap.Round,\n` +
`            strokeLineJoin = StrokeJoin.Round,\n` +
`        ) }\n` +
`    }.build()\n\n${properties}\n}\n`;
}

function emitCatalog() {
  const accents = RING_ICON_ASSETS.map((icon) =>
    `    ${kotlinString(icon.id)} to CircleAccent.${constant(icon.accent)},`).join("\n");
  const icons = RING_ICON_ASSETS.map((icon) => `    RingIcons.${pascal(icon.id)},`).join("\n");
  const composites = RING_ICON_ASSETS.filter(({ layers }) => layers !== undefined).map((icon) => {
    const layers = icon.layers.map((layer) =>
      `CircleIconLayer(RingIcons.${pascal(layer.assetRef)}, CircleAccent.${constant(layer.accent)})`).join(", ");
    return `    ${kotlinString(icon.id)} to CircleIconStyle(listOf(${layers}), primaryAccent = CircleAccent.${constant(icon.accent)}),`;
  }).join("\n");
  return `// GENERATED from product-spec/src/ring-icon-assets.ts - do not edit.\n` +
`package com.adelost.designkit.ui\n\n` +
`internal val PORTABLE_RING_ICON_ACCENTS: Map<String, CircleAccent> = mapOf(\n${accents}\n)\n\n` +
`internal val PORTABLE_RING_ICON_CATALOG = listOf(\n${icons}\n)\n\n` +
`internal val PORTABLE_COMPOSITE_ICON_STYLES: Map<String, CircleIconStyle> by lazy { mapOf(\n${composites}\n) }\n`;
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
