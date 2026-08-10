/**
 * The foundation's view of a state authority's adapter.
 *
 * StateAuthorityAdapter is opaque so a product declaration cannot name
 * `.adapter.outputPortRef` and friends. The emitters still need those fields,
 * so they read them here — and so does the suite, through this same function.
 *
 * This module is deliberately NOT re-exported from index.ts. `export *` there
 * would put the accessor back on the public surface and make the ban
 * decorative again at the first refactor. Importing this path is a visible,
 * greppable act; the chain it replaces looked innocent.
 */
import type { StateAuthorityAdapter } from "./state-authority-model.js";

export interface StateAuthorityAdapterFields {
  readonly nodeTypeRef: string;
  readonly nodeInstanceRef: string;
  readonly inputPortRef: string;
  readonly outputPortRef: string;
}

export function adapterFields(adapter: StateAuthorityAdapter): StateAuthorityAdapterFields {
  return adapter as unknown as StateAuthorityAdapterFields;
}
