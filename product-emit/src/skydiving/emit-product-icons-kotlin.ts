import { kotlinEnumToken, kotlinStringLiteral } from "../core/kotlin-syntax.js";
import type { KotlinEmissionOptions } from "../core/emission-options.js";
import type { ProductIr } from "@v1d/product-spec";
import type { ProductIconsNativeSymbols } from "./native-symbols.js";

const nativeAccentByPaletteToken: Readonly<Record<string, string>> = {
  "category.achievement": "ACHIEVEMENT",
  "category.cloud": "CLOUD",
  "category.cold": "COLD",
  "category.rain": "RAIN",
  "category.sky": "SKY",
  "category.sun": "SUN",
  "category.violet": "VIOLET",
  "status.caution": "CAUTION",
  "status.danger": "DANGER",
  "status.ok": "POSITIVE",
};

/** Product semantics only; native geometry capability is attested separately. */
export function emitProductIconsKotlin(
  product: ProductIr,
  options: KotlinEmissionOptions & { readonly nativeSymbols: ProductIconsNativeSymbols },
): string {
  const rows = product.iconRefs.map((icon) => {
    return `    ${iconToken(icon.id)}(${kotlinStringLiteral(icon.id)}, ${kotlinStringLiteral(icon.assetRef)}, MenuAccentToken.${nativeAccent(icon)}),`;
  }).join("\n");
  return `package ${options.packageName}

import ${options.nativeSymbols.menuAccentToken}

// GENERATED from ProductSpec iconRefs - do not edit.
// SOURCE ${options.sourceSha}
enum class Generated${options.symbolPrefix}ProductIconToken(
    val refId: String,
    val assetRef: String,
    val defaultAccent: MenuAccentToken,
) {
${rows}
}
`;
}

/**
 * The one colour claim an icon makes.
 *
 * An icon drawn in several pieces already says what colour each piece is, so a
 * whole-icon accent on top of that is a second, conflicting truth — and the
 * renderer resolves that conflict by throwing the pieces away and painting the
 * glyph flat. RAIN carried both and drew as one blue pictogram instead of a
 * grey cloud with blue drops. Refusing the pair here is what keeps that from
 * being a thing anyone can declare again.
 */
function nativeAccent(icon: { id: string; accent?: string; layers?: readonly unknown[] }): string {
  const composite = icon.layers !== undefined && icon.layers.length > 0;
  if (composite && icon.accent !== undefined) {
    throw new Error(
      `product icon '${icon.id}' declares both a whole-icon accent '${icon.accent}' and per-layer accents; ` +
        `a composed glyph is coloured by its layers alone`,
    );
  }
  if (composite) return "COMPOSITE";
  if (icon.accent === undefined) return "NEUTRAL";
  const accent = nativeAccentByPaletteToken[icon.accent];
  if (accent === undefined) {
    throw new Error(`product icon '${icon.id}' has no native accent projection for '${icon.accent}'`);
  }
  return accent;
}

/**
 * `menu.chevron-left` -> `CHEVRON_LEFT`.
 *
 * The namespace is dropped because the enum itself already is the namespace:
 * `MenuIconToken.MENU_CHEVRON_LEFT` says menu twice. That strip is the ONLY
 * thing this differs from the shared token rule by, so the casing and the
 * separator handling come from there rather than from a fourth local copy.
 */
function iconToken(id: string): string {
  return kotlinEnumToken(id.slice(id.indexOf(".") + 1));
}
