/**
 * The foundation's entry point: `@v1d/product-spec/foundation`.
 *
 * A state authority has two audiences, and they need different things.
 *
 * A **product** declares authorities and binds one port, so it imports from
 * `.` and reads `definition.presentationPortRef`. The adapter is opaque there
 * on purpose: reaching through it says nothing a product can decide.
 *
 * A **foundation** — an emitter, a validator, a conformance suite — generates
 * the native catalogue from those declarations, so it genuinely needs the
 * adapter's field names. There is more than one: CircleKit emits from here,
 * and Skyvw's appspec has its own emitters over the same model. Both are the
 * same consumer class, in two repositories.
 *
 * Keeping the accessor off `.` is what makes the ban a wall rather than a
 * habit: a product that cannot import the escape hatch cannot quietly reach
 * through it. Splitting it onto this subpath gives the second audience an
 * official door instead of a deep import into `dist/`, which `exports` closes
 * and `moduleResolution: NodeNext` enforces.
 *
 * The import path is the declaration of role. `from ".../foundation"` in a
 * product file is a reviewable mistake; the three-hop chain it replaced looked
 * like ordinary authoring.
 */
export { adapterFields } from "./state-authority-internals.js";
export type { StateAuthorityAdapterFields } from "./state-authority-internals.js";
