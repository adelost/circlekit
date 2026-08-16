import { kotlinEnumToken } from "../core/kotlin-syntax.js";
import type { IsoOptionDeclaration } from "./iso-option-model.js";

/**
 * What an iso option needs from a setting when it borrows one: the setting
 * already holds the name, the sentence and the icon, so a borrowing option
 * copies them at generation time instead of the app reaching for them on every
 * recomposition.
 */
export interface EmittableSetting {
  readonly id: string;
  readonly kind: "enum-setting" | "boolean-setting";
  readonly values?: readonly { readonly id: string; readonly label: string }[];
  readonly defaultValueId?: string;
  readonly control: {
    readonly id: string;
    readonly title: { readonly text: string };
    readonly hint: { readonly text: string };
    readonly iconId: string;
  };
}

export interface ResolvedIsoOption {
  readonly key: string;
  readonly label: string;
  readonly icon: string;
  readonly hint: string;
  readonly statePresentation: IsoOptionDeclaration["statePresentation"];
}

export function validateIsoOptions(
  options: readonly IsoOptionDeclaration[],
  settings: readonly EmittableSetting[],
): void {
  if (options.length === 0) throw new Error("no iso options declared");
  const settingById = new Map(settings.map((setting) => [setting.id, setting]));
  // Keys only become comparable AFTER resolution: a literal `spot` and the
  // setting `iso.spot`, whose control id is also `spot`, are two distinct
  // declarations that would land on one map entry and silently lose a row.
  // The declaration cannot see that collision; this is the only place both
  // sides exist at once.
  const claimed = new Set<string>();
  for (const option of options) {
    if (option.settingRef !== undefined) {
      const setting = settingById.get(option.settingRef);
      if (setting === undefined) {
        throw new Error(`iso option points at missing setting '${option.settingRef}'`);
      }
      if (setting.control.iconId.trim() === "") {
        throw new Error(`setting '${setting.id}' has no icon for its iso option to wear`);
      }
    }
    const presentation = option.statePresentation;
    if (option.kind === "CHOICE_OF_N") {
      if (presentation === undefined) {
        throw new Error(
          `iso choice '${option.settingRef ?? option.key}' needs a total state presentation`,
        );
      }
      if (presentation.kind === "FINITE" && Object.keys(presentation.states).length < 2) {
        throw new Error(
          `iso choice '${option.settingRef ?? option.key}' declares fewer than two state faces`,
        );
      }
      if (option.settingRef !== undefined && presentation.kind === "FINITE") {
        const setting = settingById.get(option.settingRef)!;
        if (setting.kind !== "enum-setting" || setting.values === undefined || setting.defaultValueId === undefined) {
          throw new Error(`iso choice '${option.settingRef}' must borrow an enum setting`);
        }
        const declaredLabels = Object.keys(presentation.states).sort();
        const settingLabels = setting.values.map(({ label }) => label).sort();
        if (JSON.stringify(declaredLabels) !== JSON.stringify(settingLabels)) {
          throw new Error(
            `iso choice '${option.settingRef}' state faces ${declaredLabels.join(", ")} do not exactly match ` +
              `setting answers ${settingLabels.join(", ")}`,
          );
        }
        for (const value of setting.values) {
          const resettable = presentation.states[value.label]!.resettable;
          const expected = value.id !== setting.defaultValueId;
          if (resettable !== expected) {
            throw new Error(
              `iso choice '${option.settingRef}' answer '${value.label}' declares resettable=${resettable}; ` +
                `its default is '${setting.defaultValueId}', so resettable must be ${expected}`,
            );
          }
        }
      }
    } else if (presentation !== undefined) {
      throw new Error(
        `iso option '${option.settingRef ?? option.key}' declares state presentation but is ` +
          `${option.kind ?? "ACTION"}; state faces belong to a CHOICE_OF_N`,
      );
    }
    const { key } = resolveIsoOption(option, settingById);
    if (claimed.has(key)) {
      throw new Error(`two iso options both answer to the key '${key}'`);
    }
    claimed.add(key);
  }
}

/**
 * Where an option's identity comes from is a question for the declaration, not
 * for the renderer, so both kinds leave here looking the same. Total by
 * contract: validateIsoOptions has already proven a borrowed setting exists and
 * carries an icon.
 */
export function resolveIsoOption(
  option: IsoOptionDeclaration,
  settingById: ReadonlyMap<string, EmittableSetting>,
): ResolvedIsoOption {
  if (option.settingRef === undefined) {
    return {
      key: option.key,
      label: option.label,
      icon: option.icon,
      hint: option.hint,
      statePresentation: option.statePresentation,
    };
  }
  const setting = settingById.get(option.settingRef)!;
  return {
    key: setting.control.id,
    label: setting.control.title.text,
    icon: kotlinEnumToken(setting.control.iconId),
    hint: setting.control.hint.text,
    statePresentation: option.statePresentation,
  };
}
