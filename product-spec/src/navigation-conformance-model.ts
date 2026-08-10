import type { ProductNavigationIr } from "./navigation-model.js";

export interface NativeNavigationBindingManifest {
  readonly artifacts: readonly {
    readonly artifactRef: string;
    readonly entryPageRef: string;
    readonly pages: readonly {
      readonly pageRef: string;
      readonly restore: "root" | "process";
      readonly back: "previous" | "consume" | "system";
      readonly guardContractRef: string | null;
    }[];
  }[];
  readonly activePageBindings: readonly {
    readonly publisherPortRef: string;
    readonly pageHostPortRef: string;
  }[];
  readonly actionGroups: readonly {
    readonly artifactRef: string;
    readonly componentInstanceRef: string;
    readonly actions: readonly {
      readonly sourcePortRef: string;
      readonly targetPortRef: string;
      readonly effect: "push" | "dispatch";
    }[];
  }[];
}

export interface NavigationConformanceFinding {
  readonly axis: "navigation";
  readonly direction: "missing" | "orphan" | "mismatch";
  readonly subject: string;
  readonly message: string;
}

export function navigationConformance(
  declared: ProductNavigationIr,
  hostProfiles: ReadonlySet<string>,
  bound: NativeNavigationBindingManifest,
): readonly NavigationConformanceFinding[] {
  const out: NavigationConformanceFinding[] = [];
  const expectedArtifacts = new Map(declared.artifacts
    .filter(({ artifactRef }) => hostProfiles.has(artifactRef))
    .map((artifact) => [artifact.artifactRef, artifact]));
  const boundArtifacts = new Map(bound.artifacts.map((artifact) => [artifact.artifactRef, artifact]));
  compareIds(out, expectedArtifacts.keys(), boundArtifacts.keys(), "artifact navigation");
  for (const [artifactRef, expected] of expectedArtifacts) {
    const actual = boundArtifacts.get(artifactRef);
    if (actual === undefined) continue;
    if (expected.entryPageRef !== actual.entryPageRef) {
      out.push(mismatch(`${artifactRef}/entry`,
        `artifact '${artifactRef}' entry '${actual.entryPageRef}' differs from compiled '${expected.entryPageRef}'`));
    }
    const expectedPages = new Map(expected.pages.map((page) => [`${artifactRef}/${page.pageRef}`, page]));
    const actualPages = new Map(actual.pages.map((page) => [`${artifactRef}/${page.pageRef}`, page]));
    compareIds(out, expectedPages.keys(), actualPages.keys(), `page in '${artifactRef}'`);
    for (const [key, expectedPage] of expectedPages) {
      const actualPage = actualPages.get(key);
      if (actualPage !== undefined && stable(expectedPage) !== stable(actualPage)) {
        out.push(mismatch(key, `page '${key}' differs from compiled restore/back/guard semantics`));
      }
    }
    duplicates(actual.pages.map(({ pageRef }) => pageRef)).forEach((pageRef) =>
      out.push(mismatch(`${artifactRef}/${pageRef}`, `page '${pageRef}' in '${artifactRef}' is registered more than once`)));
  }
  duplicates(bound.artifacts.map(({ artifactRef }) => artifactRef)).forEach((artifactRef) =>
    out.push(mismatch(artifactRef, `artifact navigation '${artifactRef}' is registered more than once`)));

  const expectedActive = `${declared.activePagePortRef}->${declared.pageHostPortRef}`;
  const boundActive = bound.activePageBindings.map(({ publisherPortRef, pageHostPortRef }) =>
    `${publisherPortRef}->${pageHostPortRef}`);
  compareIds(out, [expectedActive], boundActive, "active-page binding");
  duplicates(boundActive).forEach((binding) =>
    out.push(mismatch(binding, `active-page binding '${binding}' is registered more than once`)));

  const expectedGroups = new Map(declared.actionGroups.flatMap((group) => group.artifactRefs
    .filter((artifactRef) => hostProfiles.has(artifactRef))
    .map((artifactRef) => [groupKey(artifactRef, group.componentInstanceRef), {
      artifactRef,
      componentInstanceRef: group.componentInstanceRef,
      actions: group.actions.map(({ sourcePortRef, targetPortRef, effect }) => ({
        sourcePortRef, targetPortRef, effect,
      })),
    }] as const)));
  const boundGroups = new Map(bound.actionGroups.map((group) =>
    [groupKey(group.artifactRef, group.componentInstanceRef), group]));
  compareIds(out, expectedGroups.keys(), boundGroups.keys(), "action group");
  for (const [key, expected] of expectedGroups) {
    const actual = boundGroups.get(key);
    if (actual === undefined) continue;
    const expectedActions = new Map(expected.actions.map((action) => [action.sourcePortRef, action]));
    const actualActions = new Map(actual.actions.map((action) => [action.sourcePortRef, action]));
    compareIds(out, expectedActions.keys(), actualActions.keys(), `action in '${key}'`);
    for (const [sourcePortRef, expectedAction] of expectedActions) {
      const actualAction = actualActions.get(sourcePortRef);
      if (actualAction !== undefined && stable(expectedAction) !== stable(actualAction)) {
        out.push(mismatch(`${key}/${sourcePortRef}`, `action '${sourcePortRef}' in '${key}' differs from compiled target/effect`));
      }
    }
    duplicates(actual.actions.map(({ sourcePortRef }) => sourcePortRef)).forEach((sourcePortRef) =>
      out.push(mismatch(`${key}/${sourcePortRef}`, `action '${sourcePortRef}' in '${key}' is registered more than once`)));
  }
  duplicates(bound.actionGroups.map(({ artifactRef, componentInstanceRef }) =>
    groupKey(artifactRef, componentInstanceRef))).forEach((key) =>
    out.push(mismatch(key, `action group '${key}' is registered more than once`)));
  return out;
}

export function decodeNativeNavigationBindingManifest(raw: unknown): NativeNavigationBindingManifest {
  const root = record(raw, "manifest navigation");
  return {
    artifacts: list(root.artifacts, "manifest navigation artifacts").map((value, index) => {
      const artifact = record(value, `manifest navigation artifact ${index}`);
      return {
        artifactRef: string(artifact.artifactRef, `navigation artifact ${index} artifactRef`),
        entryPageRef: string(artifact.entryPageRef, `navigation artifact ${index} entryPageRef`),
        pages: list(artifact.pages, `navigation artifact ${index} pages`).map((pageValue, pageIndex) => {
          const page = record(pageValue, `navigation artifact ${index} page ${pageIndex}`);
          return {
            pageRef: string(page.pageRef, `navigation artifact ${index} page ${pageIndex} pageRef`),
            restore: choice(page.restore, ["root", "process"] as const, "navigation restore"),
            back: choice(page.back, ["previous", "consume", "system"] as const, "navigation back"),
            guardContractRef: nullableString(page.guardContractRef, "navigation guardContractRef"),
          };
        }),
      };
    }),
    activePageBindings: list(root.activePageBindings, "manifest activePageBindings").map((value, index) => {
      const binding = record(value, `manifest activePageBinding ${index}`);
      return {
        publisherPortRef: string(binding.publisherPortRef, `activePageBinding ${index} publisherPortRef`),
        pageHostPortRef: string(binding.pageHostPortRef, `activePageBinding ${index} pageHostPortRef`),
      };
    }),
    actionGroups: list(root.actionGroups, "manifest navigation actionGroups").map((value, index) => {
      const group = record(value, `manifest navigation actionGroup ${index}`);
      return {
        artifactRef: string(group.artifactRef, `actionGroup ${index} artifactRef`),
        componentInstanceRef: string(group.componentInstanceRef, `actionGroup ${index} componentInstanceRef`),
        actions: list(group.actions, `actionGroup ${index} actions`).map((actionValue, actionIndex) => {
          const action = record(actionValue, `actionGroup ${index} action ${actionIndex}`);
          return {
            sourcePortRef: string(action.sourcePortRef, `actionGroup ${index} action ${actionIndex} sourcePortRef`),
            targetPortRef: string(action.targetPortRef, `actionGroup ${index} action ${actionIndex} targetPortRef`),
            effect: choice(action.effect, ["push", "dispatch"] as const, "navigation action effect"),
          };
        }),
      };
    }),
  };
}

function compareIds(
  out: NavigationConformanceFinding[],
  declared: Iterable<string>,
  bound: Iterable<string>,
  noun: string,
): void {
  const expected = new Set(declared);
  const actual = new Set(bound);
  [...expected].sort().filter((id) => !actual.has(id)).forEach((id) => out.push({
    axis: "navigation", direction: "missing", subject: id,
    message: `${noun} '${id}' is compiled but not registered natively`,
  }));
  [...actual].sort().filter((id) => !expected.has(id)).forEach((id) => out.push({
    axis: "navigation", direction: "orphan", subject: id,
    message: `${noun} '${id}' is registered natively but not compiled`,
  }));
}

function mismatch(subject: string, message: string): NavigationConformanceFinding {
  return { axis: "navigation", direction: "mismatch", subject, message };
}

const stable = (value: unknown): string => JSON.stringify(sortKeys(value));
const groupKey = (artifactRef: string, componentInstanceRef: string): string =>
  `${artifactRef}/${componentInstanceRef}`;

function duplicates(values: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  values.forEach((value) => seen.has(value) ? repeated.add(value) : seen.add(value));
  return [...repeated];
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => [key, sortKeys(item)]));
}

function record(value: unknown, owner: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error(`${owner} must be an object`);
  return value as Record<string, unknown>;
}

function list(value: unknown, owner: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new Error(`${owner} must be an array`);
  return value;
}

function string(value: unknown, owner: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${owner} must be a nonblank string`);
  return value;
}

function nullableString(value: unknown, owner: string): string | null {
  return value === null ? null : string(value, owner);
}

function choice<const Values extends readonly string[]>(value: unknown, values: Values, owner: string): Values[number] {
  if (typeof value !== "string" || !values.includes(value)) throw new Error(`${owner} has invalid value '${String(value)}'`);
  return value;
}
