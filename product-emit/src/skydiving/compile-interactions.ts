import type { Diagnostic, SettingIr } from "./model.js";
import { APP_SPEC_VERSION } from "./model.js";
import type {
  CompileInteractionsResult,
  InteractionDeclaration,
  InteractionMountDeclaration,
  NormalizedInteractionIr,
} from "./interaction-model.js";

export interface CompileInteractionsInput<EffectRef extends string = never> {
  readonly declarations: readonly InteractionDeclaration[];
  readonly settings?: readonly SettingIr<EffectRef>[];
}

/** Normalize the TypeScript declaration directly; there is no second product registry to agree with. */
export function compileInteractions<EffectRef extends string>(
  input: CompileInteractionsInput<EffectRef>,
): CompileInteractionsResult {
  const diagnostics: Diagnostic[] = [];
  const seenControls = new Set<string>();
  const seenMounts = new Set<string>();
  const interactions: NormalizedInteractionIr[] = [];
  for (const declaration of input.declarations) {
    let valid = true;
    if (seenControls.has(declaration.controlId)) {
      issue(diagnostics, "interaction.duplicate-control-id", declaration, `control '${declaration.controlId}' is declared more than once`);
      valid = false;
    }
    seenControls.add(declaration.controlId);
    valid = validHosts(declaration.requiredHosts, "requiredHosts", declaration, diagnostics) && valid;
    for (const mount of declaration.mounts) {
      if (seenMounts.has(mount.id)) {
        issue(diagnostics, "interaction.duplicate-mount-id", declaration, `mount '${mount.id}' is declared more than once`);
        valid = false;
      }
      seenMounts.add(mount.id);
      valid = validateMount(mount, declaration, diagnostics) && valid;
    }
    const mountedHosts = [...new Set(declaration.mounts.flatMap((mount) => mount.requiredHosts))];
    valid = sameSet(declaration.requiredHosts, mountedHosts, "interaction.mount.host-coverage", declaration, diagnostics) && valid;

    if (declaration.kind === "discrete-action") {
      if (declaration.timing !== "immediate" && declaration.timing !== "deliberate") {
        issue(diagnostics, "interaction.invalid-timing", declaration, `unknown timing '${declaration.timing}'`);
        valid = false;
      }
      const setting = declaration.settingId === undefined
        ? undefined
        : input.settings?.find((candidate) => candidate.id === declaration.settingId);
      if (declaration.settingId !== undefined && setting === undefined) {
        issue(diagnostics, "interaction.setting.missing", declaration, `setting '${declaration.settingId}' is absent from the same SettingsIr`);
        valid = false;
      }
      if (setting !== undefined && setting.control.id !== declaration.controlId) {
        issue(diagnostics, "interaction.setting.control-parity", declaration, `setting '${setting.id}' owns control '${setting.control.id}', not '${declaration.controlId}'`);
        valid = false;
      }
      if (valid) interactions.push({
        ...declaration,
        ...(setting === undefined ? {} : { setting: { id: setting.id, controlId: setting.control.id } }),
      });
    } else {
      for (const [field, value] of [
        ["gesturePolicy", declaration.gesturePolicy],
        ["endPolicy", declaration.endPolicy],
        ["settlePolicy", declaration.settlePolicy],
        ["accessibilityPolicy", declaration.accessibilityPolicy],
      ] as const) valid = nonBlank(value, field, declaration, diagnostics) && valid;
      if (valid) interactions.push(declaration);
    }
  }
  if (diagnostics.length > 0) return { ir: null, diagnostics };
  return {
    ir: {
      kind: "interaction-catalog-ir",
      appSpecVersion: APP_SPEC_VERSION,
      interactions: interactions.sort((a, b) => a.controlId.localeCompare(b.controlId)),
    },
    diagnostics,
  };
}

function validateMount(
  mount: InteractionMountDeclaration,
  declaration: InteractionDeclaration,
  diagnostics: Diagnostic[],
): boolean {
  let valid = validHosts(mount.requiredHosts, `mount '${mount.id}' hosts`, declaration, diagnostics);
  const expected = declaration.kind === "discrete-action" ? "atom" : "primitive";
  if (mount.kind !== expected) {
    issue(diagnostics, "interaction.mount.kind", declaration, `mount '${mount.id}' is '${mount.kind}', expected '${expected}'`);
    valid = false;
  }
  if (mount.requiredHosts.some((host) => !declaration.requiredHosts.includes(host))) {
    issue(diagnostics, "interaction.mount.host-coverage", declaration, `mount '${mount.id}' includes a host outside requiredHosts`);
    valid = false;
  }
  return valid;
}

function validHosts(values: readonly string[], field: string, declaration: InteractionDeclaration, diagnostics: Diagnostic[]): boolean {
  if (values.length > 0 && new Set(values).size === values.length && values.every((host) => host === "phone" || host === "wear")) return true;
  issue(diagnostics, "interaction.invalid-hosts", declaration, `${field} must be a non-empty unique phone/wear list`);
  return false;
}

function nonBlank(value: string, field: string, declaration: InteractionDeclaration, diagnostics: Diagnostic[]): boolean {
  if (value.trim().length > 0) return true;
  issue(diagnostics, "interaction.policy.missing", declaration, `${field} must name a policy handle`);
  return false;
}

function sameSet(a: readonly string[], b: readonly string[], rule: string, declaration: InteractionDeclaration, diagnostics: Diagnostic[]): boolean {
  if ([...a].sort().join("\u0000") === [...b].sort().join("\u0000")) return true;
  issue(diagnostics, rule, declaration, "mount host union must equal requiredHosts");
  return false;
}

function issue(diagnostics: Diagnostic[], rule: string, declaration: InteractionDeclaration, message: string): void {
  diagnostics.push({
    rule,
    declarationKind: "interaction",
    declarationId: declaration.controlId,
    sourceFile: declaration.source.file,
    target: "kotlin",
    message,
  });
}
