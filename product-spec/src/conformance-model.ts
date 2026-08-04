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

  // ONE DIRECTION ONLY, and the asymmetry is the point. A manifest describes one host,
  // so a profile it does not bind is not a defect: CircleKit Showcase declares five
  // artifacts across four hosts, and its Android manifest legitimately renders two of
  // them. Comparing both directions reported the iPhone, watchOS and Garmin artifacts as
  // missing from Android, which is not a finding, it is the architecture.
  //
  // The reverse is a real defect and stays: a host claiming an artifact the product never
  // declared is a manifest asserting coverage of something that does not exist.
  //
  // Skyvw hid this for a round because it is a single-host product: one apk that picks
  // its profile at runtime, so its manifest legitimately carries every artifact.
  // "Which artifacts has no host at all" is a question about the SET of manifests, not
  // about any one of them, and [productArtifactHostCoverage] is where it is asked.
  if (manifest.profiles === undefined) out.push(unasserted("artifact", "profiles"));
  else {
    for (const profile of [...new Set(manifest.profiles)].sort()) {
      if (!artifactIds.has(profile)) {
        out.push(finding("artifact", "orphan", profile,
          `artifact profile '${profile}' is bound natively but the product does not declare it`));
      }
    }
  }

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

  // Measured against Link, not assumed: its ten lego mount ids and its ten
  // manifest serviceIds are the SAME set, and its navigation lego declares
  // port("open")/port("destination") — exactly the bare names the manifest
  // carries. So a manifest port is service-relative and qualifies as
  // `serviceId.port`, which is the mount-qualified ref this graph uses.
  //
  // A serviceId with no matching mount is reported rather than silently
  // qualifying into a ref that cannot match anything.
  const { inputs, outputs } = portRefs(ir);
  const mountIds = new Set(irSection(ir.legos?.mounts).map(({ id }) => id));
  for (const service of manifest.services ?? []) {
    if (!mountIds.has(service.serviceId)) {
      out.push(finding("service-port", "orphan", service.serviceId,
        `service '${service.serviceId}' has no lego mount, so its ports cannot be resolved`));
      continue;
    }
    for (const [port, declared, side] of [
      ...service.inputPorts.map((p) => [p, inputs, "input"] as const),
      ...service.outputPorts.map((p) => [p, outputs, "output"] as const),
    ]) {
      const ref = `${service.serviceId}.${port}`;
      if (!declared.has(ref)) {
        out.push(finding("service-port", "orphan", ref,
          `service '${service.serviceId}' binds ${side} port '${port}', which its lego does not declare`));
      }
    }
  }
  if (manifest.services === undefined) out.push(unasserted("service-port", "services"));

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

/**
 * Read one host's manifest off disk into the shape the comparison expects.
 *
 * The manifest is generated by a native test and committed, so the file is trusted
 * right up until it is not: a half-written file, a stale schema or a hand-edited
 * "quick fix" all arrive here looking like JSON. Every product had written this
 * decoder itself, which is the same drift the comparison exists to stop, one layer
 * down. Failures name the exact field rather than surfacing as `undefined is not
 * iterable` three functions later.
 */
export function decodeNativeBindingManifest(raw: unknown): NativeBindingManifest {
  const root = record(raw, "native binding manifest");
  const stage = requiredString(root.stage, "manifest stage");
  if (stage !== "native-export") {
    throw new Error(`manifest stage '${stage}' is not a compiled native export`);
  }
  if (root.schemaVersion !== NATIVE_BINDING_MANIFEST_SCHEMA_VERSION) {
    throw new Error(
      `manifest schema ${String(root.schemaVersion)} is unsupported; ` +
      `this package reads v${NATIVE_BINDING_MANIFEST_SCHEMA_VERSION}`,
    );
  }
  return {
    stage: "native-export",
    schemaVersion: NATIVE_BINDING_MANIFEST_SCHEMA_VERSION,
    sourceFile: requiredString(root.sourceFile, "manifest sourceFile"),
    // An omitted section stays omitted: `unasserted` is a real answer, and defaulting
    // it to [] here would silently convert "not declared" into "declares none".
    ...(root.profiles === undefined
      ? {}
      : { profiles: stringList(root.profiles, "manifest profiles") }),
    components: list(root.components, "manifest components").map((value, index) => {
      const item = record(value, `manifest component ${index}`);
      return {
        componentId: requiredString(item.componentId, `component ${index} componentId`),
        rendererId: requiredString(item.rendererId, `component ${index} rendererId`),
        profiles: stringList(item.profiles, `component ${index} profiles`),
      };
    }),
    icons: list(root.icons, "manifest icons").map((value, index) => {
      const item = record(value, `manifest icon ${index}`);
      return {
        iconId: requiredString(item.iconId, `icon ${index} iconId`),
        nativeSymbol: requiredString(item.nativeSymbol, `icon ${index} nativeSymbol`),
      };
    }),
    ...(root.services === undefined ? {} : {
      services: list(root.services, "manifest services").map((value, index) => {
        const item = record(value, `manifest service ${index}`);
        return {
          serviceId: requiredString(item.serviceId, `service ${index} serviceId`),
          nativePortId: requiredString(item.nativePortId, `service ${index} nativePortId`),
          profiles: stringList(item.profiles, `service ${index} profiles`),
          inputPorts: stringList(item.inputPorts, `service ${index} inputPorts`),
          outputPorts: stringList(item.outputPorts, `service ${index} outputPorts`),
        };
      }),
    }),
    ...(root.finiteValues === undefined ? {} : {
      finiteValues: list(root.finiteValues, "manifest finiteValues").map((value, index) => {
        const item = record(value, `manifest finite value ${index}`);
        return {
          id: requiredString(item.id, `finite value ${index} id`),
          values: stringList(item.values, `finite value ${index} values`),
        };
      }),
    }),
  };
}

function record(value: unknown, owner: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${owner} must be an object`);
  }
  return value as Record<string, unknown>;
}

function list(value: unknown, owner: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new Error(`${owner} must be an array`);
  return value;
}

function requiredString(value: unknown, owner: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${owner} must be a nonblank string`);
  }
  return value;
}

function stringList(value: unknown, owner: string): readonly string[] {
  return list(value, owner).map((item, index) => requiredString(item, `${owner}[${index}]`));
}

/**
 * Which declared artifacts no host binds at all.
 *
 * [productArtifactConformance] deliberately cannot answer this: it sees one manifest, and
 * an artifact absent from one host is normal. Dropping the question entirely would be the
 * worse failure, because then a product could declare an artifact nobody renders and every
 * per-host run would still come back empty. Ask it once, over every host the product ships.
 */
export function productArtifactHostCoverage(
  ir: ProductIr,
  manifests: readonly NativeBindingManifest[],
): readonly ConformanceFinding[] {
  const unasserted = manifests.filter(({ profiles }) => profiles === undefined);
  if (unasserted.length > 0) {
    return unasserted.map((manifest) => finding("artifact", "unasserted", manifest.sourceFile,
      `manifest '${manifest.sourceFile}' declares no 'profiles' section, so host coverage ` +
      "cannot be measured for any artifact"));
  }
  const bound = new Set(manifests.flatMap(({ profiles }) => [...(profiles ?? [])]));
  return irSection(ir.artifacts)
    .map(({ id }) => id)
    .filter((id) => !bound.has(id))
    .sort()
    .map((id) => finding("artifact", "missing", id,
      `artifact '${id}' is declared but no host manifest binds it`));
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
