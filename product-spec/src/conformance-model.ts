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
  readonly profiles: readonly string[];
  readonly components: readonly {
    readonly componentId: string;
    readonly rendererId: string;
    readonly profiles: readonly string[];
  }[];
  readonly icons: readonly { readonly iconId: string; readonly nativeSymbol: string }[];
  readonly services: readonly {
    readonly serviceId: string;
    readonly nativePortId: string;
    readonly profiles: readonly string[];
    readonly inputPorts: readonly string[];
    readonly outputPorts: readonly string[];
  }[];
  readonly finiteValues: readonly { readonly id: string; readonly values: readonly string[] }[];
}

/**
 * No `capability` axis: defineProduct already refuses an artifact whose renderers
 * do not provide its required capabilities, so an IR that reaches this comparison
 * cannot carry that gap. A second check there would only look like coverage.
 */
export type ConformanceAxis =
  | "artifact"
  | "renderer"
  | "component"
  | "icon"
  | "service-port"
  | "finite-value";

/**
 * `missing` — the product declares it and native does not bind it.
 * `orphan`  — native binds it and the product does not declare it.
 * `mismatch` — both sides know it and disagree about its content.
 */
export type ConformanceDirection = "missing" | "orphan" | "mismatch";

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

/** Every mounted lego port, as the `mount.port` refs wiring and native bindings use. */
function portRefs(ir: ProductIr): { inputs: Set<string>; outputs: Set<string> } {
  const inputs = new Set<string>();
  const outputs = new Set<string>();
  for (const mount of ir.legos.mounts) {
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
  const artifactIds = new Set(ir.artifacts.map(({ id }) => id));

  out.push(...compareIds("artifact", artifactIds, manifest.profiles, "artifact profile"));

  // A renderer that binds nothing is as wrong as a component that binds nowhere:
  // it means the product still advertises a host that stopped rendering.
  out.push(...compareIds(
    "renderer",
    ir.rendererBindings.map(({ id }) => id),
    manifest.components.map(({ rendererId }) => rendererId),
    "renderer",
  ));

  out.push(...compareIds(
    "component",
    ir.componentCatalog.map(({ id }) => id),
    manifest.components.map(({ componentId }) => componentId),
    "component",
  ));

  // A native binding may not invent a profile the product never declared, or the
  // manifest silently claims coverage on a host that does not exist.
  for (const component of manifest.components) {
    for (const profile of component.profiles) {
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

  out.push(...compareIds(
    "icon",
    ir.iconRefs.map(({ id }) => id),
    manifest.icons.map(({ iconId }) => iconId),
    "product icon",
  ));

  const { inputs, outputs } = portRefs(ir);
  for (const service of manifest.services) {
    for (const port of service.inputPorts) {
      if (!inputs.has(port)) {
        out.push(finding(
          "service-port",
          "orphan",
          port,
          `service '${service.serviceId}' binds input port '${port}', which no mounted lego declares`,
        ));
      }
    }
    for (const port of service.outputPorts) {
      if (!outputs.has(port)) {
        out.push(finding(
          "service-port",
          "orphan",
          port,
          `service '${service.serviceId}' binds output port '${port}', which no mounted lego declares`,
        ));
      }
    }
  }

  // Two-way parity on the value space itself, not just its name: a native enum
  // that gained or lost a case is exactly the drift finite values exist to stop.
  const declaredValues = new Map(ir.finiteValues.map(({ id, values }) => [id, [...values].sort()]));
  const boundValues = new Map(manifest.finiteValues.map(({ id, values }) => [id, [...values].sort()]));
  out.push(...compareIds("finite-value", declaredValues.keys(), boundValues.keys(), "finite value"));
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
