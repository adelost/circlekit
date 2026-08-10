/** Product-neutral declaration provenance shared by every emitter family. */
export interface SourceRef {
  readonly file: string;
  readonly declarationId: string;
}

/** A compile diagnostic whose target vocabulary is supplied by its layer. */
export interface Diagnostic<Target extends string = "registry" | "kotlin"> {
  readonly rule: string;
  readonly declarationKind: string;
  readonly declarationId: string;
  readonly sourceFile: string;
  readonly target?: Target;
  readonly message: string;
}
