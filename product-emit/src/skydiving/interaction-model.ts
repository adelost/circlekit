import type { Diagnostic, RequiredHost, SourceRef } from "./model.js";

export type InteractionControlId = string & { readonly __interactionControlId: unique symbol };
export type InteractionPolicyHandle = string & { readonly __interactionPolicyHandle: unique symbol };
export type InteractionMountId = string & { readonly __interactionMountId: unique symbol };

export const interactionControlId = (value: string): InteractionControlId => value as InteractionControlId;
export const interactionPolicyHandle = (value: string): InteractionPolicyHandle => value as InteractionPolicyHandle;
export const interactionMountId = (value: string): InteractionMountId => value as InteractionMountId;

export type InteractionTiming = "immediate" | "deliberate";
export type InteractionMountKind = "atom" | "primitive";

export interface InteractionMountDeclaration {
  readonly id: InteractionMountId;
  readonly kind: InteractionMountKind;
  readonly requiredHosts: readonly [RequiredHost, ...RequiredHost[]];
}

interface InteractionDeclarationBase {
  readonly controlId: InteractionControlId;
  readonly mounts: readonly [InteractionMountDeclaration, ...InteractionMountDeclaration[]];
  readonly requiredHosts: readonly [RequiredHost, ...RequiredHost[]];
  readonly source: SourceRef;
}

export interface DiscreteInteractionDeclaration extends InteractionDeclarationBase {
  readonly kind: "discrete-action";
  readonly timing: InteractionTiming;
  /** Present only when mechanics decorate an existing persisted SettingsIr control. */
  readonly settingId?: string;
}

export interface ContinuousInteractionDeclaration extends InteractionDeclarationBase {
  readonly kind: "continuous-manipulation";
  readonly gesturePolicy: InteractionPolicyHandle;
  readonly endPolicy: InteractionPolicyHandle;
  readonly settlePolicy: InteractionPolicyHandle;
  readonly accessibilityPolicy: InteractionPolicyHandle;
}

export type InteractionDeclaration = DiscreteInteractionDeclaration | ContinuousInteractionDeclaration;

export interface NormalizedDiscreteInteractionIr extends DiscreteInteractionDeclaration {
  readonly setting?: { readonly id: string; readonly controlId: string };
}

export type NormalizedContinuousInteractionIr = ContinuousInteractionDeclaration;
export type NormalizedInteractionIr = NormalizedDiscreteInteractionIr | NormalizedContinuousInteractionIr;

export interface NormalizedInteractionCatalogIr {
  readonly kind: "interaction-catalog-ir";
  readonly appSpecVersion: number;
  readonly interactions: readonly NormalizedInteractionIr[];
}

export interface CompileInteractionsResult {
  readonly ir: NormalizedInteractionCatalogIr | null;
  readonly diagnostics: readonly Diagnostic[];
}
