import type { SettingIr } from "./model.js";
import type { KotlinSettingGroup } from "./emit-kotlin.js";

/**
 * A settings catalogue is split into one generated file per group. The split is
 * only safe if it is a partition: every setting lands in exactly one group and
 * no group names a setting that does not exist. Miss one and the aggregate API
 * silently loses a descriptor, which native code then cannot find at all.
 */
export function validateSettingGroups<EffectRef extends string>(
  settings: readonly SettingIr<EffectRef>[],
  groups: readonly KotlinSettingGroup[],
): void {
  const declared = new Set(settings.map(({ id }) => id));
  const owner = new Map<string, string>();
  for (const group of groups) {
    if (group.settingIds.length === 0) throw new Error(`setting group '${group.id}' is empty`);
    for (const settingId of group.settingIds) {
      if (!declared.has(settingId)) {
        throw new Error(`setting group '${group.id}' names unknown setting '${settingId}'`);
      }
      if (owner.has(settingId)) {
        throw new Error(`setting '${settingId}' belongs to more than one generated group`);
      }
      owner.set(settingId, group.id);
    }
  }
  if (owner.size !== settings.length) {
    const missing = settings.filter(({ id }) => !owner.has(id)).map(({ id }) => id);
    throw new Error(`generated setting groups omit: ${missing.join(", ")}`);
  }
}
