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
  /** Answer -> icon, empty when the option wears one glyph throughout. */
  readonly stateIcons: Readonly<Record<string, string>>;
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
    } else if (option.stateIcons !== undefined) {
      // An icon per answer only means something where there is more than one
      // answer. On an ACTION or a TOGGLE it would be a state map nobody reads.
      if (option.kind !== "CHOICE_OF_N") {
        throw new Error(
          `iso option '${option.key}' declares stateIcons but is ${option.kind ?? "ACTION"}; ` +
            "an icon per answer belongs to a CHOICE_OF_N",
        );
      }
      if (Object.keys(option.stateIcons).length < 2) {
        throw new Error(
          `iso option '${option.key}' declares stateIcons for fewer than two answers; ` +
            "one icon for every answer is just the option's icon",
        );
      }
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
      stateIcons: option.stateIcons ?? {},
    };
  }
  const setting = settingById.get(option.settingRef)!;
  return {
    key: setting.control.id,
    label: setting.control.title.text,
    icon: kotlinEnumToken(setting.control.iconId),
    hint: setting.control.hint.text,
    // A borrowed setting brings its own single icon; an icon per answer would
    // be a second identity for a control that already has one.
    stateIcons: {},
  };
}
