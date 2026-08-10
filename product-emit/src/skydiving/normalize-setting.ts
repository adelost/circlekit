import { diagnostic } from "../core/diagnostics.js";
import {
  REQUIRED_HOSTS,
  type Diagnostic,
  type RequiredHost,
  type SettingDeclaration,
  type SettingIr,
} from "./model.js";

export interface SettingNormalizationContext {
  readonly seenIds: Set<string>;
  readonly seenWireNames: Set<string>;
  readonly seenControlIds: Set<string>;
  readonly diagnostics: Diagnostic[];
}

/** Normalises portable product data only. Native parity is compile-bound in the
 * product's own binding layer; TypeScript never certifies Kotlin symbols. */
export function normalizeSetting<EffectRef extends string>(
  declaration: SettingDeclaration<EffectRef>,
  context: SettingNormalizationContext,
): SettingIr<EffectRef> | null {
  const start = context.diagnostics.length;
  uniqueNonBlank(declaration, declaration.id, "setting id", context.seenIds, "setting.duplicate-id", context.diagnostics);
  uniqueNonBlank(declaration, declaration.wireName, "wire name", context.seenWireNames, "setting.duplicate-wire-name", context.diagnostics);
  uniqueNonBlank(declaration, declaration.control.id, "control id", context.seenControlIds, "control.duplicate-id", context.diagnostics);
  nonBlank(declaration, declaration.selectorId, "selector id", "selector.blank-id", context.diagnostics);
  nonBlank(declaration, declaration.intentId, "intent id", "intent.blank-id", context.diagnostics);
  nonBlank(declaration, declaration.control.title.text, "title", "copy.blank-title", context.diagnostics);
  nonBlank(declaration, declaration.control.iconId, "icon id", "control.blank-icon", context.diagnostics);
  nonBlank(declaration, declaration.control.accessibility.label, "accessibility label", "accessibility.blank-label", context.diagnostics);
  validateRequiredHosts(declaration, context.diagnostics);
  validateHostOverrides(declaration, context.diagnostics);

  if (declaration.kind === "enum-setting") {
    if (declaration.values.length < 2) issue(declaration, "setting.enum-cardinality", "an enum setting needs at least two values", context.diagnostics);
    uniqueValues(declaration, declaration.values.map(({ id }) => id), "value id", "setting.duplicate-value-id", context.diagnostics);
    uniqueValues(declaration, declaration.values.map(({ label }) => label), "value label", "setting.duplicate-value-label", context.diagnostics);
    declaration.values.forEach(({ id, label }) => {
      nonBlank(declaration, id, "value id", "setting.blank-value-id", context.diagnostics);
      nonBlank(declaration, label, "value label", "setting.blank-value-label", context.diagnostics);
    });
    if (!declaration.values.some(({ id }) => id === declaration.defaultValueId)) {
      issue(declaration, "setting.default-not-in-values", `default '${declaration.defaultValueId}' is absent from values`, context.diagnostics);
    }
  } else if (declaration.labels.false === declaration.labels.true) {
    issue(declaration, "setting.duplicate-boolean-label", "Boolean labels must differ", context.diagnostics);
  }

  if (context.diagnostics.length !== start) return null;
  if (declaration.kind === "enum-setting") return {
    kind: declaration.kind, id: declaration.id, wireName: declaration.wireName,
    persistence: declaration.persistence, selector: { id: declaration.selectorId },
    ...(declaration.changedEffectRef === undefined ? {} : { changedEffectRef: declaration.changedEffectRef }),
    intent: { id: declaration.intentId, effect: "set-setting" }, control: declaration.control,
    values: declaration.values, defaultValueId: declaration.defaultValueId,
    requiredHosts: declaration.requiredHosts, hostOverrides: declaration.hostOverrides, source: declaration.source,
  };
  return {
    kind: declaration.kind, id: declaration.id, wireName: declaration.wireName,
    persistence: declaration.persistence, selector: { id: declaration.selectorId },
    ...(declaration.changedEffectRef === undefined ? {} : { changedEffectRef: declaration.changedEffectRef }),
    intent: { id: declaration.intentId, effect: "set-setting" }, control: declaration.control,
    defaultValue: declaration.defaultValue, labels: declaration.labels,
    requiredHosts: declaration.requiredHosts, hostOverrides: declaration.hostOverrides, source: declaration.source,
  };
}

function uniqueNonBlank(
  declaration: SettingDeclaration<string>,
  value: string,
  label: string,
  seen: Set<string>,
  rule: string,
  diagnostics: Diagnostic[],
): void {
  nonBlank(declaration, value, label, rule, diagnostics);
  if (seen.has(value)) issue(declaration, rule, `${label} '${value}' is duplicated`, diagnostics);
  seen.add(value);
}

function uniqueValues(
  declaration: SettingDeclaration<string>,
  values: readonly string[],
  label: string,
  rule: string,
  diagnostics: Diagnostic[],
): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) issue(declaration, rule, `${label} '${value}' is duplicated`, diagnostics);
    seen.add(value);
  }
}

function nonBlank(
  declaration: SettingDeclaration<string>,
  value: string,
  label: string,
  rule: string,
  diagnostics: Diagnostic[],
): void {
  if (value.trim() === "") issue(declaration, rule, `${label} must be nonblank`, diagnostics);
}

function validateRequiredHosts(declaration: SettingDeclaration<string>, diagnostics: Diagnostic[]): void {
  const actual = [...declaration.requiredHosts].sort().join(",");
  const required = [...REQUIRED_HOSTS].sort().join(",");
  if (actual !== required) issue(declaration, "host.required-set-drift", `required hosts '${actual}' differ from '${required}'`, diagnostics);
}

function validateHostOverrides(declaration: SettingDeclaration<string>, diagnostics: Diagnostic[]): void {
  const seen = new Set<RequiredHost>();
  for (const override of declaration.hostOverrides) {
    if (seen.has(override.host)) issue(declaration, "host.duplicate-override", `host '${override.host}' has more than one override`, diagnostics);
    seen.add(override.host);
    if (!declaration.requiredHosts.includes(override.host)) issue(declaration, "host.override-outside-required", `host '${override.host}' is not required`, diagnostics);
    if (override.justification.trim() === "") issue(declaration, "host.blank-justification", `host '${override.host}' has no justification`, diagnostics);
  }
}

function issue(declaration: SettingDeclaration<string>, rule: string, message: string, diagnostics: Diagnostic[]): void {
  diagnostics.push(diagnostic(rule, declaration.kind, declaration.source, message));
}
