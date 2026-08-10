import type { Diagnostic as CoreDiagnostic, SourceRef } from "../core/model.js";

export type { SourceRef } from "../core/model.js";

export const APP_SPEC_VERSION = 5 as const;

export type RequiredHost = "phone" | "wear";
export const REQUIRED_HOSTS = ["phone", "wear"] as const satisfies readonly RequiredHost[];

export type SettingStoreRef = "power-settings" | "dev-settings" | "diagnostics-settings";

export interface SemanticCopy {
  readonly text: string;
}

export interface ChoiceAccessibilitySpec {
  readonly role: "adjustable";
  readonly label: string;
  readonly value: "selected-label";
  readonly action: "select-choice";
  readonly colorIsOnlySignal: false;
}

export interface ToggleAccessibilitySpec {
  readonly role: "switch";
  readonly label: string;
  readonly value: "checked-label";
  readonly action: "toggle";
  readonly colorIsOnlySignal: false;
}

export interface PortableEnumValue {
  readonly id: string;
  readonly label: string;
}

/**
 * How a setting's value reaches the store.
 *
 * `wire-registry` means the setting owns a key of its own, named `wireName`.
 * `set-membership` means it owns no key at all: the value exists only as
 * presence in one shared collection, and `wireName` is its id INSIDE that
 * collection. Declaring the second as the first would be a lie with
 * consequences — the generated descriptor would name a key nothing writes, and
 * migrating to make that true would silently reset every existing install.
 *
 * This is about structure, not encoding. HOW a store writes the value into its
 * own key — an enum as its name, a boolean as the negation of the row it draws
 * — stays native, exactly like the value's native type does.
 */
export type SettingPersistencePolicy = "wire-registry" | "set-membership";

interface SettingDeclarationBase<EffectRef extends string> {
  readonly id: string;
  readonly wireName: string;
  readonly persistence: {
    readonly storeRef: SettingStoreRef;
    readonly policy: SettingPersistencePolicy;
  };
  /** Native effect to run after, and only after, a persisted value changed. */
  readonly changedEffectRef?: EffectRef;
  readonly selectorId: string;
  readonly intentId: string;
  readonly control: {
    readonly id: string;
    readonly title: SemanticCopy;
    readonly hint: SemanticCopy;
    /** Portable semantic token. RingIcons live in the native registry. */
    readonly iconId: string;
    readonly accessibility: ChoiceAccessibilitySpec | ToggleAccessibilitySpec;
  };
  readonly requiredHosts: readonly RequiredHost[];
  readonly hostOverrides: readonly HostOverride[];
  readonly source: SourceRef;
}

export interface EnumSettingDeclaration<EffectRef extends string = never>
  extends SettingDeclarationBase<EffectRef> {
  readonly kind: "enum-setting";
  readonly values: readonly PortableEnumValue[];
  readonly defaultValueId: string;
  readonly control: SettingDeclarationBase<EffectRef>["control"] & {
    readonly accessibility: ChoiceAccessibilitySpec;
  };
}

export interface BooleanSettingDeclaration<EffectRef extends string = never>
  extends SettingDeclarationBase<EffectRef> {
  readonly kind: "boolean-setting";
  readonly defaultValue: boolean;
  readonly labels: { readonly false: string; readonly true: string };
  readonly control: SettingDeclarationBase<EffectRef>["control"] & {
    readonly accessibility: ToggleAccessibilitySpec;
  };
}

export type SettingDeclaration<EffectRef extends string = never> =
  EnumSettingDeclaration<EffectRef> | BooleanSettingDeclaration<EffectRef>;

export type HostOverride = {
  readonly host: RequiredHost;
  readonly reason: "os-capability" | "input-mode" | "surface-constraint";
  readonly presentation: "add" | "replace" | "omit";
  readonly justification: string;
};

interface SettingIrBase<EffectRef extends string> {
  readonly id: string;
  readonly wireName: string;
  readonly persistence: SettingDeclarationBase<EffectRef>["persistence"];
  readonly changedEffectRef?: EffectRef;
  readonly selector: { readonly id: string };
  readonly intent: { readonly id: string; readonly effect: "set-setting" };
  readonly control: {
    readonly id: string;
    readonly title: SemanticCopy;
    readonly hint: SemanticCopy;
    readonly iconId: string;
    readonly accessibility: ChoiceAccessibilitySpec | ToggleAccessibilitySpec;
  };
  readonly requiredHosts: readonly RequiredHost[];
  readonly hostOverrides: readonly HostOverride[];
  readonly source: SourceRef;
}

export interface EnumSettingIr<EffectRef extends string = never> extends SettingIrBase<EffectRef> {
  readonly kind: "enum-setting";
  readonly values: readonly PortableEnumValue[];
  readonly defaultValueId: string;
  readonly control: SettingIrBase<EffectRef>["control"] & { readonly accessibility: ChoiceAccessibilitySpec };
}

export interface BooleanSettingIr<EffectRef extends string = never> extends SettingIrBase<EffectRef> {
  readonly kind: "boolean-setting";
  readonly defaultValue: boolean;
  readonly labels: { readonly false: string; readonly true: string };
  readonly control: SettingIrBase<EffectRef>["control"] & { readonly accessibility: ToggleAccessibilitySpec };
}

export type SettingIr<EffectRef extends string = never> =
  EnumSettingIr<EffectRef> | BooleanSettingIr<EffectRef>;

export interface NormalizedSettingsIr<EffectRef extends string = never> {
  readonly kind: "settings-ir";
  readonly appSpecVersion: typeof APP_SPEC_VERSION;
  readonly settings: readonly SettingIr<EffectRef>[];
  readonly graph: ArchitectureGraph;
}

export interface ArchitectureNode {
  readonly id: string;
  readonly kind: "setting" | "selector" | "intent" | "control" | "store" | "host";
  readonly origin: "generated" | "native";
  readonly shared: boolean;
  readonly source: SourceRef;
}

export interface ArchitectureEdge {
  readonly from: string;
  readonly to: string;
  readonly kind: "reads" | "writes" | "produces" | "activatedBy" | "renders";
}

export interface ArchitectureGraph {
  readonly nodes: readonly ArchitectureNode[];
  readonly edges: readonly ArchitectureEdge[];
}

export type Diagnostic = CoreDiagnostic<RequiredHost | "registry" | "kotlin">;

export interface CompileResult<EffectRef extends string = never> {
  readonly ir: NormalizedSettingsIr<EffectRef> | null;
  readonly diagnostics: readonly Diagnostic[];
}
