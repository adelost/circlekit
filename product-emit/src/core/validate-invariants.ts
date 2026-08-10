import { diagnostic } from "./diagnostics.js";
import type { InvariantSpec } from "@v1d/product-spec";
import type { Diagnostic } from "./model.js";

/** Stable product semantics; enforcement belongs to compilers and native ports. */
export type PortableInvariant = Pick<InvariantSpec, "id" | "statement">;

/** Structural validation stays repo- and platform-independent. */
export function validateInvariants(
  invariants: readonly PortableInvariant[],
  productId: string,
  diagnostics: Diagnostic[],
): void {
  const seen = new Set<string>();
  for (const invariant of invariants) {
    const source = { file: productId, declarationId: invariant.id };
    if (seen.has(invariant.id)) {
      diagnostics.push(diagnostic(
        "invariant.duplicate-id",
        "invariant",
        source,
        `invariant id ${invariant.id} is declared more than once`,
      ));
    }
    seen.add(invariant.id);

    // A statement is what a reader is held to. An id is not a statement.
    if (invariant.statement.trim().length < MIN_STATEMENT_LENGTH) {
      diagnostics.push(diagnostic(
        "invariant.statement-too-thin",
        "invariant",
        source,
        `statement must be a full sentence of at least ${MIN_STATEMENT_LENGTH} characters`,
      ));
    }
    if (!invariant.statement.trim().endsWith(".")) {
      diagnostics.push(diagnostic(
        "invariant.statement-not-a-sentence",
        "invariant",
        source,
        "statement must read as a sentence and end with a period",
      ));
    }

  }
}

const MIN_STATEMENT_LENGTH = 24;
