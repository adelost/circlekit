import type { ProductIr } from "./product-model.js";
import {
  PORTABLE_SURFACE_CLASSES,
  type PortableSurfaceClass,
} from "./component-tree-model.js";
import {
  componentRenderScopeKey,
  type ComponentRenderContractIr,
  type ComponentRenderEventIr,
  type ComponentRenderInputIr,
} from "./component-render-contract-model.js";
import {
  decodeNativeNavigationBindingManifest,
  navigationConformance,
  type NativeNavigationBindingManifest,
} from "./navigation-conformance-model.js";

/**
 * One product, one compiled IR, one native binding manifest per host.
 *
 * Applications had grown local copies of this comparison in platform parity
 * tests and product-local registry decoders. Copies of the same contract drift
 * silently, and the first sign is a renderer that stopped binding something the
 * product still declares. The comparison belongs next to the IR it reads.
 *
 * Findings are DATA, not exceptions: a caller that wants the whole picture gets
 * every axis in one pass instead of the first failure, and a test can assert the
 * axis and direction rather than that something threw.
 */
export const NATIVE_BINDING_MANIFEST_SCHEMA_VERSION = 6 as const;

export interface NativeComponentRendererRegistration extends ComponentRenderContractIr {
  /** Compile-bound native implementation symbol; ProductSpec does not author it. */
  readonly rendererId: string;
}

export interface NativeBindingManifest {
  readonly stage: "native-export";
  readonly schemaVersion: typeof NATIVE_BINDING_MANIFEST_SCHEMA_VERSION;
  readonly sourceFile: string;
  /** Artifact profile ids this host actually renders. */
  readonly profiles?: readonly string[];
  /** Actual instance registrations exported by the native host. */
  readonly components: readonly NativeComponentRendererRegistration[];
  readonly icons: readonly { readonly iconId: string; readonly nativeSymbol: string }[];
  /**
   * Exact native node adapters for this host. A node with no ports still has
   * one entry: omitting the section would turn the entire node/port axis off.
   */
  readonly nodes: readonly {
    readonly nodeId: string;
    readonly nativePortId: string;
    readonly profiles: readonly string[];
    readonly inputPorts: readonly string[];
    readonly outputPorts: readonly string[];
  }[];
  readonly finiteValues?: readonly { readonly id: string; readonly values: readonly string[] }[];
  /** Actual host registrations, never copied from expected ProductIr. */
  readonly navigation: NativeNavigationBindingManifest;
}

/**
 * No `capability` axis: defineProduct already refuses an artifact whose renderers
 * do not provide its required capabilities, so an IR that reaches this comparison
 * cannot carry that gap. A second check there would only look like coverage.
 */
export type ConformanceAxis =
  | "artifact"
  | "component-render"
  | "icon"
  | "node-port"
  | "finite-value"
  | "navigation";

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
 * The IR side needs the same defence as the manifest side. Older Product IR may
 * omit a section entirely, and reading it as an array would crash. A section the
 * product omits is unasserted for the same reason a manifest omission is.
 */
const irSection = <T,>(value: readonly T[] | undefined): readonly T[] => value ?? [];

/** Every mounted lego port, as the `mount.port` refs wiring and native bindings use. */
function portRefs(ir: ProductIr): { inputs: Set<string>; outputs: Set<string> } {
  const inputs = new Set(ir.portRegistry.nodePorts
    .filter(({ direction }) => direction === "input").map(({ ref }) => ref));
  const outputs = new Set(ir.portRegistry.nodePorts
    .filter(({ direction }) => direction === "output").map(({ ref }) => ref));
  return { inputs, outputs };
}

function componentRenderConformance(
  declared: readonly ComponentRenderContractIr[],
  hostProfiles: ReadonlySet<string>,
  bound: readonly NativeComponentRendererRegistration[],
): ConformanceFinding[] {
  const axis = "component-render" as const;
  const hostDeclared = declared.flatMap((contract): readonly ComponentRenderContractIr[] => {
    const scopes = contract.scopes.filter(({ artifactRef }) => hostProfiles.has(artifactRef));
    return scopes.length === 0 ? [] : [{ ...contract, scopes }];
  });
  const declaredByInstance = new Map(hostDeclared.map((contract) => [contract.componentInstanceRef, contract]));
  const boundByInstance = new Map(bound.map((contract) => [contract.componentInstanceRef, contract]));
  const out = compareIds(
    axis,
    declaredByInstance.keys(),
    boundByInstance.keys(),
    "component renderer instance",
  );

  for (const instanceRef of duplicates(bound.map(({ componentInstanceRef }) => componentInstanceRef))) {
    out.push(finding(axis, "mismatch", instanceRef,
      `component renderer instance '${instanceRef}' is registered more than once`));
  }

  for (const [instanceRef, expected] of [...declaredByInstance].sort(([left], [right]) => left.localeCompare(right))) {
    const actual = bound.find((registration) => registration.componentInstanceRef === instanceRef);
    if (actual === undefined) continue;
    if (actual.componentTypeRef !== expected.componentTypeRef) {
      out.push(finding(axis, "mismatch", instanceRef,
        `component renderer instance '${instanceRef}' declares type '${expected.componentTypeRef}' ` +
        `but native binds '${actual.componentTypeRef}'`));
    }

    const expectedScopes = new Map(expected.scopes.map((scope) => [componentRenderScopeKey(scope), scope]));
    const actualScopes = new Map(actual.scopes.map((scope) => [componentRenderScopeKey(scope), scope]));
    out.push(...compareIds(
      axis,
      expectedScopes.keys(),
      actualScopes.keys(),
      `component renderer scope for '${instanceRef}'`,
    ).map((item) => ({ ...item, subject: `${instanceRef}@${item.subject}` })));
    for (const scope of duplicates(actual.scopes.map(componentRenderScopeKey))) {
      out.push(finding(axis, "mismatch", `${instanceRef}@${scope}`,
        `component renderer scope '${scope}' for '${instanceRef}' is registered more than once`));
    }

    out.push(...compareRenderInputs(instanceRef, expected.inputs, actual.inputs));
    out.push(...compareRenderEvents(instanceRef, expected.events, actual.events));
  }
  return out;

  function compareRenderInputs(
    instanceRef: string,
    expected: readonly ComponentRenderInputIr[],
    actual: readonly ComponentRenderInputIr[],
  ): ConformanceFinding[] {
    const findings = compareIds(
      axis,
      expected.map(({ inputPortRef }) => inputPortRef),
      actual.map(({ inputPortRef }) => inputPortRef),
      `immutable input on '${instanceRef}'`,
    );
    for (const portRef of duplicates(actual.map(({ inputPortRef }) => inputPortRef))) {
      findings.push(finding(axis, "mismatch", portRef,
        `immutable input '${portRef}' is registered more than once`));
    }
    const actualByPort = new Map(actual.map((item) => [item.inputPortRef, item]));
    for (const item of expected) {
      const native = actualByPort.get(item.inputPortRef);
      if (native === undefined) continue;
      if (native.producerPortRef !== item.producerPortRef ||
          native.contractRef !== item.contractRef || native.required !== item.required) {
        findings.push(finding(axis, "mismatch", item.inputPortRef,
          `immutable input '${item.inputPortRef}' expects producer '${item.producerPortRef}', ` +
          `contract '${item.contractRef}', required=${String(item.required)} but native binds producer ` +
          `'${native.producerPortRef}', contract '${native.contractRef}', required=${String(native.required)}`));
      }
    }
    return findings;
  }

  function compareRenderEvents(
    instanceRef: string,
    expected: readonly ComponentRenderEventIr[],
    actual: readonly ComponentRenderEventIr[],
  ): ConformanceFinding[] {
    const findings = compareIds(
      axis,
      expected.map(({ eventPortRef }) => eventPortRef),
      actual.map(({ eventPortRef }) => eventPortRef),
      `typed event on '${instanceRef}'`,
    );
    for (const portRef of duplicates(actual.map(({ eventPortRef }) => eventPortRef))) {
      findings.push(finding(axis, "mismatch", portRef,
        `typed event '${portRef}' is registered more than once`));
    }
    const actualByPort = new Map(actual.map((item) => [item.eventPortRef, item]));
    for (const item of expected) {
      const native = actualByPort.get(item.eventPortRef);
      if (native === undefined) continue;
      if (native.targetPortRef !== item.targetPortRef || native.contractRef !== item.contractRef) {
        findings.push(finding(axis, "mismatch", item.eventPortRef,
          `typed event '${item.eventPortRef}' expects target '${item.targetPortRef}', ` +
          `contract '${item.contractRef}' but native binds target '${native.targetPortRef}', ` +
          `contract '${native.contractRef}'`));
      }
    }
    return findings;
  }
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

  // Product manifests may assert different section sets. An absent section is
  // neither "conforms" nor "everything is missing" -- both lie. It is UNASSERTED,
  // and it says so in one line, because a silently skipped axis reads as coverage
  // and a flood of false `missing` reads as breakage.
  const unasserted = (axis: ConformanceAxis, section: string): ConformanceFinding =>
    finding(axis, "unasserted", section,
      `manifest declares no '${section}' section, so the ${axis} axis is not checked here`);

  // ONE DIRECTION ONLY, and the asymmetry is the point. A manifest describes one host,
  // so a profile it does not bind is not a defect: a multi-host product may split
  // five artifacts over several manifests. Comparing both directions per host would
  // report the other hosts' artifacts as missing, which is architecture, not drift.
  //
  // The reverse is a real defect and stays: a host claiming an artifact the product never
  // declared is a manifest asserting coverage of something that does not exist.
  //
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

  const hostProfiles = manifest.profiles === undefined
    ? artifactIds
    : new Set(manifest.profiles);
  out.push(...componentRenderConformance(ir.componentRenderContracts, hostProfiles, manifest.components));

  // Native manifests key icons by ASSET ref ("gear", "palette"), not by product
  // icon ref ("route.settings", "action.palette").
  // Compare the DISTINCT asset set, because a product may point several icon refs
  // at one asset. Comparing per icon ref would report a false orphan for every reuse.
  out.push(...compareIds(
    "icon",
    new Set(irSection(ir.iconRefs).map(({ assetRef }) => assetRef)),
    manifest.icons.map(({ iconId }) => iconId),
    "icon asset",
  ));

  // Native ports are node-relative. Qualifying them as `nodeId.port` gives the
  // same stable refs as the compiled graph and lets one generic comparison
  // prove both node identity and every input/output in both directions.
  const { inputs, outputs } = portRefs(ir);
  const nativeInputs = manifest.nodes.flatMap(({ nodeId, inputPorts }) =>
    inputPorts.map((port) => `${nodeId}.${port}`));
  const nativeOutputs = manifest.nodes.flatMap(({ nodeId, outputPorts }) =>
    outputPorts.map((port) => `${nodeId}.${port}`));
  out.push(...compareIds(
    "node-port",
    irSection(ir.nodes).map(({ id }) => id),
    manifest.nodes.map(({ nodeId }) => nodeId),
    "node",
  ));
  for (const nodeId of duplicates(manifest.nodes.map(({ nodeId }) => nodeId))) {
    out.push(finding("node-port", "mismatch", nodeId,
      `node '${nodeId}' is bound more than once`));
  }
  out.push(...compareIds("node-port", inputs, nativeInputs, "node input port"));
  out.push(...compareIds("node-port", outputs, nativeOutputs, "node output port"));

  for (const node of manifest.nodes) {
    const duplicateInputs = duplicates(node.inputPorts);
    const duplicateOutputs = duplicates(node.outputPorts);
    for (const port of duplicateInputs) {
      const ref = `${node.nodeId}.${port}`;
      out.push(finding("node-port", "mismatch", ref,
        `node input port '${ref}' is bound more than once`));
    }
    for (const port of duplicateOutputs) {
      const ref = `${node.nodeId}.${port}`;
      out.push(finding("node-port", "mismatch", ref,
        `node output port '${ref}' is bound more than once`));
    }
  }

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

  out.push(...navigationConformance(ir.navigation, hostProfiles, manifest.navigation));

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
        componentInstanceRef: requiredString(item.componentInstanceRef, `component ${index} componentInstanceRef`),
        componentTypeRef: requiredString(item.componentTypeRef, `component ${index} componentTypeRef`),
        rendererId: requiredString(item.rendererId, `component ${index} rendererId`),
        scopes: list(item.scopes, `component ${index} scopes`).map((scopeValue, scopeIndex) => {
          const scope = record(scopeValue, `component ${index} scope ${scopeIndex}`);
          return {
            artifactRef: requiredString(scope.artifactRef, `component ${index} scope ${scopeIndex} artifactRef`),
            screenRef: requiredString(scope.screenRef, `component ${index} scope ${scopeIndex} screenRef`),
            surface: portableSurface(scope.surface, `component ${index} scope ${scopeIndex} surface`),
            mountRef: requiredString(scope.mountRef, `component ${index} scope ${scopeIndex} mountRef`),
          };
        }),
        inputs: list(item.inputs, `component ${index} inputs`).map((inputValue, inputIndex) => {
          const nativeInput = record(inputValue, `component ${index} input ${inputIndex}`);
          return {
            inputPortRef: requiredString(nativeInput.inputPortRef, `component ${index} input ${inputIndex} inputPortRef`),
            producerPortRef: requiredString(nativeInput.producerPortRef, `component ${index} input ${inputIndex} producerPortRef`),
            contractRef: requiredString(nativeInput.contractRef, `component ${index} input ${inputIndex} contractRef`),
            required: requiredBoolean(nativeInput.required, `component ${index} input ${inputIndex} required`),
          };
        }),
        events: list(item.events, `component ${index} events`).map((eventValue, eventIndex) => {
          const event = record(eventValue, `component ${index} event ${eventIndex}`);
          return {
            eventPortRef: requiredString(event.eventPortRef, `component ${index} event ${eventIndex} eventPortRef`),
            targetPortRef: requiredString(event.targetPortRef, `component ${index} event ${eventIndex} targetPortRef`),
            contractRef: requiredString(event.contractRef, `component ${index} event ${eventIndex} contractRef`),
          };
        }),
      };
    }),
    icons: list(root.icons, "manifest icons").map((value, index) => {
      const item = record(value, `manifest icon ${index}`);
      return {
        iconId: requiredString(item.iconId, `icon ${index} iconId`),
        nativeSymbol: requiredString(item.nativeSymbol, `icon ${index} nativeSymbol`),
      };
    }),
    nodes: list(root.nodes, "manifest nodes").map((value, index) => {
      const item = record(value, `manifest node ${index}`);
      return {
        nodeId: requiredString(item.nodeId, `node ${index} nodeId`),
        nativePortId: requiredString(item.nativePortId, `node ${index} nativePortId`),
        profiles: stringList(item.profiles, `node ${index} profiles`),
        inputPorts: stringList(item.inputPorts, `node ${index} inputPorts`),
        outputPorts: stringList(item.outputPorts, `node ${index} outputPorts`),
      };
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
    navigation: decodeNativeNavigationBindingManifest(root.navigation),
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

function requiredBoolean(value: unknown, owner: string): boolean {
  if (typeof value !== "boolean") throw new Error(`${owner} must be a boolean`);
  return value;
}

function portableSurface(value: unknown, owner: string): PortableSurfaceClass {
  const surface = requiredString(value, owner);
  if (!PORTABLE_SURFACE_CLASSES.includes(surface as PortableSurfaceClass)) {
    throw new Error(`${owner} '${surface}' is not a portable surface`);
  }
  return surface as PortableSurfaceClass;
}

function stringList(value: unknown, owner: string): readonly string[] {
  return list(value, owner).map((item, index) => requiredString(item, `${owner}[${index}]`));
}

function duplicates(values: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return [...repeated].sort();
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
