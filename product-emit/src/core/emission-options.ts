/**
 * What a product tells an emitter about itself.
 *
 * An emitter composes its Kotlin symbol names from `symbolPrefix` instead of
 * writing a product name into the template. The difference is not cosmetic: a
 * hardcoded product name means the emitter can only ever serve one product,
 * and the generated output stops being evidence that the pipeline is generic —
 * it becomes evidence that one product happens to be the only caller.
 *
 * `sourceFile` is the same argument for provenance. The GENERATED FROM header
 * names the declaration a reader should edit; only the caller knows which file
 * that is, and an emitter that names it is guessing on the product's behalf.
 */
export interface KotlinEmissionOptions {
  readonly packageName: string;
  /** Prepended to every emitted symbol, e.g. `Acme` -> `GeneratedAcmeSettings`. */
  readonly symbolPrefix: string;
  readonly sourceSha: string;
}

/**
 * For an artifact projected wholly from one declaration file, which can
 * therefore point at it.
 *
 * Settings are the exception and keep the plain options: each descriptor
 * carries its own `source`, so that header is per declaration rather than per
 * file.
 */
export interface SourcedKotlinEmissionOptions extends KotlinEmissionOptions {
  /** Repo-relative path of the declaration this artifact is projected from. */
  readonly sourceFile: string;
}

/**
 * The web half of the same emission.
 *
 * `tokenPrefix` is the product's custom-property namespace and is NOT
 * `symbolPrefix` lowercased. For some products the two agree, but only by
 * coincidence of naming; deriving one from the other would make that
 * coincidence a rule.
 */
export interface CssEmissionOptions {
  /** Namespaces every emitted custom property, e.g. `acme` -> `--acme-wind-…`. */
  readonly tokenPrefix: string;
  /** Repo-relative path of the declaration this stylesheet is projected from. */
  readonly sourceFile: string;
  readonly sourceSha: string;
}
