import type { ProductIr } from "./product-model.js";

/**
 * One product, one compiled IR, one native binding manifest per host.
 *
 * Every app had grown its own copy of this comparison — Skyvw in Kotlin parity
 * tests, Link in a product-local registry decoder, Showcase in a third. Copies of
 * the same contract drift silently, and the first sign is a renderer that stopped
 * binding something the product still declares. The comparison belongs next to
 * the IR it reads.
 *
 * Findings are DATA, not exceptions: a caller that wants the whole picture gets
 * every axis in one pass instead of the first failure, and a test can assert the
 * axis and direction rather than that something threw.
 */
export const NATIVE_BINDING_MANIFEST_SCHEMA_VERSION = 2 as const;

export interface NativeBindingManifest {
  readonly stage: "native-export";
  readonly schemaVersion: typeof NATIVE_BINDING_MANIFEST_SCHEMA_VERSION;
  readonly sourceFile: string;
  /** Artifact profile ids this host actually renders. */
  readonly profiles?: readonly string[];
  readonly components: readonly {
    readonly componentId: string;
    readonly rendererId: string;
    readonly profiles: readonly string[];
  }[];
  readonly icons: readonly { readonly iconId: string; readonly nativeSymbol: string }[];
  readonly services?: readonly {
    readonly serviceId: string;
    readonly nativePortId: string;
    readonly profiles: readonly string[];
    readonly inputPorts: readonly string[];
    readonly outputPorts: readonly string[];
  }[];
  readonly finiteValues?: readonly { readonly id: string; readonly values: readonly string[] }[];
}

/**
 * No `capability` axis: defineProduct already refuses an artifact whose renderers
 * do not provide its required capabilities, so an IR that reaches this comparison
 * cannot carry that gap. A second check there would only look like coverage.
 */
export type ConformanceAxis =
  | "artifact"
  | "component"
  | "icon"
  | "service-port"
  | "finite-value";

/**
 * `missing` — the product declares it and native does not bind it.
 * `orphan`  — native binds it and the product does not declare it.
 * `mismatch` — both sides know it and disagree about its content.
 * `unasserted` — the manifest omits this section entirely, so the axis was not
 *   checked. Reported rather than skipped: silence here reads as coverage.
 */
export type ConformanceDirection = "missing" | "orphan" | "mismatch" | "unasserted";

export interface ConformanceFinding {
  readonly axis: ConformanceAxis;
  readonly direction: ConformanceDirection;
  readonly subject: string;
  readonly message: string;
}

const finding = (
  axis: ConformanceAxis,
  direction: ConformanceDirection,
  subject: string,
  message: string,
): ConformanceFinding => ({ axis, direction, subject, message });

/** Both directions of one id set, so neither side can drift unnoticed. */
function compareIds(
  axis: ConformanceAxis,
  declared: Iterable<string>,
  bound: Iterable<string>,
  noun: string,
): ConformanceFinding[] {
  const declaredSet = new Set(declared);
  const boundSet = new Set(bound);
  const out: ConformanceFinding[] = [];
  for (const id of [...declaredSet].sort()) {
    if (!boundSet.has(id)) {
      out.push(finding(axis, "missing", id, `${noun} '${id}' is declared but no native binding renders it`));
    }
  }
  for (const id of [...boundSet].sort()) {
    if (!declaredSet.has(id)) {
      out.push(finding(axis, "orphan", id, `${noun} '${id}' is bound natively but the product does not declare it`));
    }
  }
  return out;
}

/**
 * The IR side needs the same defence as the manifest side. CircleKit Showcase
 * compiles an IR with no finiteValues at all — the product predates them — and
 * reading it as an array crashed. A section the PRODUCT omits is unasserted for
 * the same reason a section the manifest omits is.
 */
const irSection = <T,>(value: readonly T[] | undefined): readonly T[] => value ?? [];

/** Every mounted lego port, as the `mount.port` refs wiring and native bindings use. */
function portRefs(ir: ProductIr): { inputs: Set<string>; outputs: Set<string> } {
  const inputs = new Set<string>();
  const outputs = new Set<string>();
  for (const mount of irSection(ir.legos?.mounts)) {
    for (const port of mount.lego.inputs) inputs.add(`${mount.id}.${port.id}`);
    for (const port of mount.lego.outputs) outputs.add(`${mount.id}.${port.id}`);
  }
  return { inputs, outputs };
}

/**
 * Compare a compiled ProductIr with one host's native binding manifest.
 *
 * Returns every disagreement rather than the first. An empty array means this
 * host renders exactly what the product declares, and nothing more.
 */
export function productArtifactConformance(
  ir: ProductIr,
  manifest: NativeBindingManifest,
): readonly ConformanceFinding[] {
  const out: ConformanceFinding[] = [];
  const artifactIds = new Set(irSection(ir.artifacts).map(({ id }) => id));

  // Manifests differ by product: CircleKit Showcase declares components and icons
  // and nothing else, while Link declares all five sections. An absent section is
  // neither "conforms" nor "everything is missing" -- both lie. It is UNASSERTED,
  // and it says so in one line, because a silently skipped axis reads as coverage
  // and a flood of false `missing` reads as breakage.
  const unasserted = (axis: ConformanceAxis, section: string): ConformanceFinding =>
    finding(axis, "unasserted", section,
      `manifest declares no '${section}' section, so the ${axis} axis is not checked here`);

  if (manifest.profiles === undefined) out.push(unasserted("artifact", "profiles"));
  else out.push(...compareIds("artifact", artifactIds, manifest.profiles, "artifact profile"));

  out.push(...compareIds(
    "component",
    irSection(ir.componentCatalog).map(({ id }) => id),
    manifest.components.map(({ componentId }) => componentId),
    "component",
  ));

  // No `renderer` axis. It is tempting to match components[].rendererId against
  // the product's rendererBindings, and the first version did — but they name
  // different things. The manifest names a component's native implementation
  // ("capture", "colors"); rendererBindings names a platform
  // ("android-phone-compose"). Comparing them produced five false `missing` and a
  // wall of false `orphan` against CircleKit Showcase. The fixture used one name
  // for both concepts, which is precisely why it stayed green.
  //
  // What the manifest CAN prove is that no component is bound twice for one
  // profile, which is a real defect and unrepresentable in the IR.
  const boundOnce = new Set<string>();
  for (const component of manifest.components) {
    for (const profile of component.profiles ?? []) {
      const key = `${component.componentId}@${profile}`;
      if (boundOnce.has(key)) {
        out.push(finding("component", "mismatch", key,
          `component '${component.componentId}' is bound twice for profile '${profile}'`));
      }
      boundOnce.add(key);
    }
  }

  // A native binding may not invent a profile the product never declared, or the
  // manifest silently claims coverage on a host that does not exist.
  for (const component of manifest.components) {
    for (const profile of component.profiles ?? []) {
      if (!artifactIds.has(profile)) {
        out.push(finding(
          "component",
          "orphan",
          `${component.componentId}@${profile}`,
          `component '${component.componentId}' binds undeclared artifact profile '${profile}'`,
        ));
      }
    }
  }

  // Both Link and CircleKit Showcase key manifest icons by ASSET ref ("gear",
  // "palette"), not by product icon ref ("route.settings", "showcase.palette").
  // Two products agreeing is enough to fix the rule; one was not, which is why
  // this stayed flagged for a round instead of being guessed.
  //
  // Compare the DISTINCT asset set, because a product may point several icon refs
  // at one asset — Link uses "gear" for both route.settings and
  // action.open-settings. Comparing per icon ref would report a false orphan for
  // every reuse.
  out.push(...compareIds(
    "icon",
    new Set(irSection(ir.iconRefs).map(({ assetRef }) => assetRef)),
    manifest.icons.map(({ iconId }) => iconId),
    "icon asset",
  ));

  // The service-port axis is UNASSERTED until its ref form is settled against a
  // second product. Link names ports RELATIVE to their service — serviceId
  // "navigation" with inputPorts ["open"] — while this helper builds fully
  // qualified "mount.port" refs. Comparing them flags every Link port as an
  // orphan, which is the same wall of false findings the renderer axis produced.
  //
  // The likely rule is `${serviceId}.${port}`, but that assumes serviceId equals
  // the lego mount id, and I have not measured Link's mount ids. One unverified
  // assumption is what shipped three defects in 0.3.30; this one waits for
  // evidence instead of shipping a check that is wrong by construction.
  out.push(unasserted("service-port", "port ref form unsettled"));

  // Two-way parity on the value space itself, not just its name: a native enum
  // that gained or lost a case is exactly the drift finite values exist to stop.
  const declaredValues = new Map(irSection(ir.finiteValues).map(({ id, values }) => [id, [...values].sort()]));
  const boundValues = new Map((manifest.finiteValues ?? []).map(({ id, values }) => [id, [...values].sort()]));
  if (ir.finiteValues === undefined) out.push(unasserted("finite-value", "product finiteValues"));
  else if (manifest.finiteValues === undefined) out.push(unasserted("finite-value", "finiteValues"));
  else out.push(...compareIds("finite-value", declaredValues.keys(), boundValues.keys(), "finite value"));
  for (const [id, declared] of [...declaredValues].sort(([a], [b]) => a.localeCompare(b))) {
    const bound = boundValues.get(id);
    if (bound !== undefined && JSON.stringify(declared) !== JSON.stringify(bound)) {
      out.push(finding(
        "finite-value",
        "mismatch",
        id,
        `finite value '${id}' declares [${declared.join(", ")}] but native binds [${bound.join(", ")}]`,
      ));
    }
  }

  return out;
}

/** Throw one error naming every disagreement, for callers that want a hard gate. */
export function assertProductArtifactConformance(
  ir: ProductIr,
  manifest: NativeBindingManifest,
): void {
  const findings = productArtifactConformance(ir, manifest);
  if (findings.length === 0) return;
  const lines = findings.map(({ axis, direction, message }) => `  [${axis}/${direction}] ${message}`);
  throw new Error(
    `product '${ir.id}' does not conform to native bindings in ${manifest.sourceFile}:\n${lines.join("\n")}`,
  );
}
