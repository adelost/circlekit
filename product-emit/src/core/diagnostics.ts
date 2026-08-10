import type { Diagnostic, SourceRef } from "./model.js";

export function diagnostic(
  rule: string,
  declarationKind: string,
  source: SourceRef,
  message: string,
  target?: "registry" | "kotlin",
): Diagnostic {
  return {
    rule,
    declarationKind,
    declarationId: source.declarationId,
    sourceFile: source.file,
    ...(target === undefined ? {} : { target }),
    message,
  };
}

export function registryDiagnostic(
  rule: string,
  bindingId: string,
  message: string,
): Diagnostic {
  return {
    rule,
    declarationKind: "native-binding",
    declarationId: bindingId,
    sourceFile: "<native-registry>",
    target: "registry",
    message,
  };
}
