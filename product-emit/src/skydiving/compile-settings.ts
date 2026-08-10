import { normalizeSetting } from "./normalize-setting.js";
import {
  APP_SPEC_VERSION,
  REQUIRED_HOSTS,
  type ArchitectureGraph,
  type CompileResult,
  type Diagnostic,
  type SettingDeclaration,
  type SettingIr,
} from "./model.js";

export interface CompileSettingsInput<EffectRef extends string = never> {
  readonly declarations: readonly SettingDeclaration<EffectRef>[];
  /**
   * The native file that implements the stores these settings persist to.
   *
   * A store node is the one node in the graph with no declaration behind it —
   * it exists natively and the graph only points at it. The pointer is the
   * caller's to give: this compiler cannot know which file, and guessing would
   * make the attribution a decoration rather than a reference.
   */
  readonly storeSourceFile: string;
}

/** Portable compiler. Kotlin/native correctness is proven independently by the
 * product's native binding layer and the Android compiler, never self-attested
 * TS. */
export function compileSettings<EffectRef extends string>(
  input: CompileSettingsInput<EffectRef>,
): CompileResult<EffectRef> {
  const diagnostics: Diagnostic[] = [];
  const context = {
    seenIds: new Set<string>(),
    seenWireNames: new Set<string>(),
    seenControlIds: new Set<string>(),
    diagnostics,
  };
  const settings = input.declarations.flatMap((declaration) => {
    const normalized = normalizeSetting(declaration, context);
    return normalized === null ? [] : [normalized];
  });
  if (diagnostics.length > 0) return { ir: null, diagnostics };
  return {
    ir: {
      kind: "settings-ir",
      appSpecVersion: APP_SPEC_VERSION,
      settings,
      graph: buildArchitectureGraph(settings, input.storeSourceFile),
    },
    diagnostics,
  };
}

function buildArchitectureGraph<EffectRef extends string>(
  settings: readonly SettingIr<EffectRef>[],
  storeSourceFile: string,
): ArchitectureGraph {
  const hostSource = { file: "<required-host-set>", declarationId: "android.required-hosts" };
  const stores = [...new Set(settings.map(({ persistence }) => persistence.storeRef))];
  return {
    nodes: [
      ...REQUIRED_HOSTS.map((host) => ({
        id: `host.${host}`, kind: "host" as const, origin: "native" as const,
        shared: true, source: hostSource,
      })),
      ...stores.map((store) => ({
        id: `store.${store}`, kind: "store" as const, origin: "native" as const,
        shared: true, source: { file: storeSourceFile, declarationId: store },
      })),
      ...settings.flatMap((setting) => [
        { id: setting.id, kind: "setting" as const, origin: "generated" as const, shared: setting.hostOverrides.length === 0, source: setting.source },
        { id: setting.selector.id, kind: "selector" as const, origin: "generated" as const, shared: true, source: setting.source },
        { id: setting.intent.id, kind: "intent" as const, origin: "generated" as const, shared: true, source: setting.source },
        { id: setting.control.id, kind: "control" as const, origin: "generated" as const, shared: setting.hostOverrides.length === 0, source: setting.source },
      ]),
    ],
    edges: settings.flatMap((setting) => [
      { from: setting.id, to: setting.selector.id, kind: "produces" as const },
      { from: setting.selector.id, to: `store.${setting.persistence.storeRef}`, kind: "reads" as const },
      { from: setting.intent.id, to: `store.${setting.persistence.storeRef}`, kind: "writes" as const },
      { from: setting.intent.id, to: setting.id, kind: "activatedBy" as const },
      ...setting.requiredHosts.map((host) => ({ from: setting.control.id, to: `host.${host}`, kind: "renders" as const })),
    ]),
  };
}
