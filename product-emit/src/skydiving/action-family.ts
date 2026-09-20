import { family, type InteractionTiming } from "@v1d/product-spec";
import {
  interactionControlId,
  interactionMountId,
  type DiscreteInteractionDeclaration,
  type InteractionControlId,
} from "./interaction-model.js";
import type { RequiredHost } from "./model.js";

type HostList = readonly [RequiredHost, ...RequiredHost[]];

/** WHAT: Defines shared action-family facts. WHY: Keeps host obligations independent from member placements. */
export interface ActionFamilyDefinition {
  readonly sourceFile: string;
  readonly requiredHosts: HostList;
}

/** WHAT: Carries one explicit action placement. WHY: Keeps stable mount identity and host evidence authored together. */
export interface ActionFamilyMount {
  readonly id: string;
  readonly hosts: HostList;
}

/** WHAT: Carries one action-family member. WHY: Keeps timing and stable identities explicit at the product boundary. */
export interface ActionFamilyMemberDefinition {
  readonly id: string;
  readonly timing: InteractionTiming;
  readonly mounts: readonly [ActionFamilyMount, ...ActionFamilyMount[]];
  readonly settingId?: string;
}

type NoExtra<Candidate, Shape> = Record<Exclude<keyof Candidate, keyof Shape>, never>;
type ExactMount<Mount extends ActionFamilyMount> = Mount & NoExtra<Mount, ActionFamilyMount>;
type ExactMounts<Mounts extends readonly [ActionFamilyMount, ...ActionFamilyMount[]]> = {
  readonly [Index in keyof Mounts]: Mounts[Index] extends ActionFamilyMount
    ? ExactMount<Mounts[Index]>
    : never;
};
type ExactMember<Member extends ActionFamilyMemberDefinition> =
  Omit<Member, "mounts"> & NoExtra<Member, ActionFamilyMemberDefinition> & {
    readonly mounts: ExactMounts<Member["mounts"]>;
  };

export type ActionFamilyResult<Member extends ActionFamilyMemberDefinition> =
  DiscreteInteractionDeclaration & {
    readonly controlId: InteractionControlId & Member["id"];
  };

/** WHAT: Builds discrete actions from one explicit family. WHY: Keeps shared structure out of each member without deriving host obligations from placements. */
export function defineActionFamily<const Definition extends ActionFamilyDefinition>(
  definition: Definition & NoExtra<Definition, ActionFamilyDefinition>,
) {
  requireKeys(definition, ["sourceFile", "requiredHosts"], "action family");
  const member = family({
    kind: "discrete-action" as const,
    requiredHosts: definition.requiredHosts,
  });
  return <const Member extends ActionFamilyMemberDefinition>(
    input: ExactMember<Member>,
  ): ActionFamilyResult<Member> => {
    requireKeys(input, ["id", "timing", "mounts", "settingId"], `action family member '${input.id}'`);
    input.mounts.forEach((mount) =>
      requireKeys(mount, ["id", "hosts"], `action family mount '${mount.id}'`));
    return member({
      controlId: interactionControlId(input.id),
      timing: input.timing,
      mounts: input.mounts.map((mount) => ({
        id: interactionMountId(mount.id),
        kind: "atom" as const,
        requiredHosts: mount.hosts,
      })) as unknown as DiscreteInteractionDeclaration["mounts"],
      source: { file: definition.sourceFile, declarationId: input.id },
      ...(input.settingId === undefined ? {} : { settingId: input.settingId }),
    }) as ActionFamilyResult<Member>;
  };
}

function requireKeys(value: object, allowed: readonly string[], label: string): void {
  const unexpected = Object.keys(value).filter((key) => !allowed.includes(key)).sort();
  if (unexpected.length > 0) {
    throw new Error(`${label} has unexpected field(s): ${unexpected.join(", ")}`);
  }
}
