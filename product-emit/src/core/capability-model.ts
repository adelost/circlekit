/**
 * What a node may ask its host for, and what it may do to the world, as one
 * closed table per product.
 *
 * A node type declares `contextInputs` and `effects` as strings. Without this
 * table those strings are checked for shape and uniqueness and for nothing
 * else: "device.pressure-sensor" is a spelling, not a fact, and no artifact
 * can be asked whether it actually provides a pressure sensor.
 *
 * Every string is one of these rows. A row has a kind, so the vocabulary is
 * countable by what it is; a row may be limited to the artifacts that provide
 * it, so mounting a node into an artifact that lacks what it needs is a
 * compile failure; and a STATE_FEEDBACK row names the domain whose state is
 * read or written outside the port graph, so the generated domain graph can
 * draw that read as a dashed edge instead of pretending it does not exist.
 *
 * STATE_FEEDBACK is debt by definition: data reaching a node without a port.
 * The count of those rows is the honest distance between the declared graph
 * and the running app, and it is meant to go down, never up.
 */

export type CapabilityKind =
  | "SENSOR"
  | "PERMISSION"
  | "PLATFORM"
  | "NETWORK"
  | "STORAGE"
  | "INTENT"
  | "DEBUG"
  | "STATE_FEEDBACK";

export type EffectKind = "IO" | "ALERT" | "NAVIGATION" | "STATE_FEEDBACK";

export interface CapabilityDeclaration {
  readonly id: string;
  readonly kind: CapabilityKind;
  /** Artifact ids that provide it. Omitted means every artifact of the product. */
  readonly providedBy?: readonly string[];
  /** STATE_FEEDBACK only: the domain whose state is read without a port. */
  readonly domain?: string;
}

export interface EffectDeclaration {
  readonly id: string;
  readonly kind: EffectKind;
  /** STATE_FEEDBACK only: the domain whose state this effect writes without a port. */
  readonly domain?: string;
}

/**
 * A product's whole host vocabulary, declared once.
 *
 * `sourceFile` is provenance: the generated graph names it as the place the
 * dashed edges come from, and every diagnostic points at it. Only the product
 * knows which file that is.
 *
 * `hostOverrides` exists for the one kind of node the demand graph cannot see
 * the host of: a service the operating system instantiates on its own, such
 * as a watch-face complication. Everything else derives its hosts from where
 * its consuming components are mounted.
 */
export interface CapabilityTable {
  readonly sourceFile: string;
  readonly capabilities: readonly CapabilityDeclaration[];
  readonly effects: readonly EffectDeclaration[];
  readonly hostOverrides?: Readonly<Record<string, readonly string[]>>;
}

export const capabilityRows = (kind: Exclude<CapabilityKind, "STATE_FEEDBACK">, ids: readonly string[]) =>
  ids.map((id): CapabilityDeclaration => ({ id, kind }));

export const feedbackCapabilities = (domain: string, ids: readonly string[]) =>
  ids.map((id): CapabilityDeclaration => ({ id, kind: "STATE_FEEDBACK", domain }));

export const effectRows = (kind: Exclude<EffectKind, "STATE_FEEDBACK">, ids: readonly string[]) =>
  ids.map((id): EffectDeclaration => ({ id, kind }));

export const feedbackEffects = (domain: string, ids: readonly string[]) =>
  ids.map((id): EffectDeclaration => ({ id, kind: "STATE_FEEDBACK", domain }));
