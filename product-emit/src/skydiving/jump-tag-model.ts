/** Portable shape required by the skydiving jump-tag Kotlin emitter. */
export type JumpTagRuleEmission =
  | { readonly kind: "sink-band"; readonly metric: string; readonly min: number; readonly max: number; readonly minCoverage: number }
  | { readonly kind: "sink-uncertain"; readonly metric: string; readonly ranges: readonly (readonly [number, number])[]; readonly minCoverage: number }
  | { readonly kind: "body-drive"; readonly metric: string; readonly min: number }
  | { readonly kind: "hop-n-pop"; readonly minFallbackPeakM: number; readonly maxExitM: number; readonly maxFreefallS: number }
  | { readonly kind: "at-least"; readonly metric: string; readonly value: number }
  | { readonly kind: "finite-any"; readonly metric: string; readonly values: readonly string[] }
  | { readonly kind: "range"; readonly metric: string; readonly min?: number; readonly max?: number }
  | { readonly kind: "personal-extreme"; readonly metric: string; readonly direction: string; readonly minSamples: number }
  | { readonly kind: "rotation"; readonly metric: string; readonly moment: string; readonly axis: string | null; readonly minTurns: number; readonly maxSecondsPerTurn: number }
  | { readonly kind: "landing-bands"; readonly metric: string; readonly values: readonly string[] };

export interface JumpTagDefinitionEmission {
  readonly id: string;
  readonly label: string;
  readonly category: string;
  readonly shape: string;
  readonly edit: string;
  readonly icon: string;
  readonly tone: string;
  readonly exclusiveGroup?: string;
  readonly autoChoosesOne?: string;
  readonly quickAdd?: boolean;
  readonly suggest?: JumpTagRuleEmission;
  readonly unlessAnyDecided?: readonly string[];
}

export interface JumpTagCatalogEmission {
  /** Complete evidence vocabulary, including producer-only diagnostics. */
  readonly evidenceMetrics: readonly string[];
  readonly axes: readonly { readonly id: string; readonly label: string }[];
  readonly tags: readonly JumpTagDefinitionEmission[];
  readonly roster: {
    readonly minGroupSize: number;
    readonly maxGroupSize: number;
    readonly maxNameChars: number;
  };
  readonly ai: {
    readonly operations: readonly string[];
    readonly rejectionLiveness: "EDIT_SNAPSHOT";
    readonly maxInstructionChars: number;
    readonly maxNoteChars: number;
  };
}
