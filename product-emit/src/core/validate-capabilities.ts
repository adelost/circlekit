import type {
  ProductComponentInstance,
  ProductNodeInstance,
  ProductNodeType,
} from "@v1d/product-spec";
import type { CapabilityTable } from "./capability-model.js";
import { domainOf } from "./declaration-ids.js";
import { diagnostic } from "./diagnostics.js";
import type { Diagnostic } from "./model.js";

/** The slice of a demand edge that says where a node runs. */
export type NodeDemandEdge =
  | { readonly kind: "component-mount"; readonly artifactRef: string; readonly nodeInstanceRef: string }
  | { readonly kind: "lifecycle"; readonly nodeInstanceRef: string };

/** Everything the capability law reads; a compiled ProductIr satisfies it. */
export interface CapabilitySource {
  readonly nodeTypes: readonly Pick<ProductNodeType, "id" | "runtime">[];
  readonly nodes: readonly Pick<ProductNodeInstance, "id" | "nodeTypeRef">[];
  readonly components: readonly Pick<ProductComponentInstance, "id">[];
  readonly artifacts: readonly { readonly id: string }[];
  readonly portRegistry: { readonly demandEdges: readonly NodeDemandEdge[] };
}

/**
 * Every string a node uses is a row, every row is used, and every host
 * provides what its nodes need.
 *
 * Runs at product compile time, before any emitter, so a misspelled context
 * input or a node mounted where its need is missing never reaches Kotlin.
 */
export function validateCapabilities(
  product: CapabilitySource,
  table: CapabilityTable,
): readonly Diagnostic<never>[] {
  const problems: Diagnostic<never>[] = [];
  const problem = (rule: string, declarationId: string, message: string): void => {
    problems.push(diagnostic(rule, "capability", { file: table.sourceFile, declarationId }, message));
  };
  const capabilityById = new Map(table.capabilities.map((row) => [row.id, row]));
  const effectById = new Map(table.effects.map((row) => [row.id, row]));
  if (capabilityById.size !== table.capabilities.length) {
    problem("capability.duplicate", "capabilities", "a capability is declared twice");
  }
  if (effectById.size !== table.effects.length) {
    problem("effect.duplicate", "effects", "an effect is declared twice");
  }
  const domains = new Set([...product.nodes, ...product.components].map(({ id }) => domainOf(id)));
  for (const row of [...table.capabilities, ...table.effects]) {
    if (row.kind === "STATE_FEEDBACK" && (row.domain === undefined || !domains.has(row.domain))) {
      problem(
        "capability.feedback-domain",
        row.id,
        `STATE_FEEDBACK names domain '${row.domain ?? ""}', which no node or component belongs to`,
      );
    }
    if (row.kind !== "STATE_FEEDBACK" && row.domain !== undefined) {
      problem("capability.domain-without-feedback", row.id, "only STATE_FEEDBACK rows name a domain");
    }
  }

  const usedCapabilities = new Set<string>();
  const usedEffects = new Set<string>();
  const typeById = new Map(product.nodeTypes.map((type) => [type.id, type]));
  const artifactIds = product.artifacts.map(({ id }) => id);
  const overrides = table.hostOverrides ?? {};
  for (const row of table.capabilities) {
    for (const host of row.providedBy ?? []) {
      if (!artifactIds.includes(host)) {
        problem("capability.provider-artifact", row.id, `providedBy names unknown artifact '${host}'`);
      }
    }
  }
  for (const [id, artifacts] of Object.entries(overrides)) {
    if (artifacts.length === 0) {
      problem("capability.override-empty", id, "a host override must name at least one artifact");
    }
    for (const host of artifacts) {
      if (!artifactIds.includes(host)) {
        problem("capability.override-artifact", id, `host override names unknown artifact '${host}'`);
      }
    }
    if (product.portRegistry.demandEdges.some((edge) => edge.nodeInstanceRef === id)) {
      problem("capability.override-derived", id, "hosts already follow demand edges; an override cannot replace them");
    }
  }
  const hosts = nodeHosts(product, artifactIds, overrides);
  for (const node of product.nodes) {
    const type = typeById.get(node.nodeTypeRef);
    if (type === undefined) continue;
    const nodeHostSet = hosts.get(node.id) ?? new Set(artifactIds);
    for (const id of type.runtime.contextInputs) {
      usedCapabilities.add(id);
      const row = capabilityById.get(id);
      if (row === undefined) {
        problem("capability.undeclared", node.id, `context input '${id}' is not a declared capability`);
        continue;
      }
      const provided = new Set(row.providedBy ?? artifactIds);
      for (const host of nodeHostSet) {
        if (!provided.has(host)) {
          problem("capability.not-provided", node.id, `needs '${id}', which artifact '${host}' does not provide`);
        }
      }
    }
    for (const id of type.runtime.effects) {
      usedEffects.add(id);
      if (!effectById.has(id)) {
        problem("effect.undeclared", node.id, `effect '${id}' is not a declared effect`);
      }
    }
  }
  for (const row of table.capabilities) {
    if (!usedCapabilities.has(row.id)) {
      problem("capability.unused", row.id, "declared but no node type asks for it");
    }
  }
  for (const row of table.effects) {
    if (!usedEffects.has(row.id)) {
      problem("effect.unused", row.id, "declared but no node type performs it");
    }
  }
  for (const id of Object.keys(overrides)) {
    if (!product.nodes.some((node) => node.id === id)) {
      problem("capability.override-orphan", id, "host override names a node that does not exist");
    }
  }
  return problems;
}

/**
 * Artifacts each node runs in, from the demand edges the compiler derived: a
 * node demanded by a mounted component runs wherever that component is
 * mounted, a node with lifecycle activation runs everywhere, and a node
 * nothing demands is assumed everywhere rather than nowhere.
 */
export function nodeHosts(
  product: Pick<CapabilitySource, "nodes" | "portRegistry">,
  artifactIds: readonly string[],
  overrides: Readonly<Record<string, readonly string[]>>,
): ReadonlyMap<string, ReadonlySet<string>> {
  const hosts = new Map<string, Set<string>>();
  for (const edge of product.portRegistry.demandEdges) {
    const set = hosts.get(edge.nodeInstanceRef) ?? new Set<string>();
    if (edge.kind === "component-mount") set.add(edge.artifactRef);
    else artifactIds.forEach((id) => set.add(id));
    hosts.set(edge.nodeInstanceRef, set);
  }
  for (const [id, artifacts] of Object.entries(overrides)) {
    // An OS-owned node may supply hosts only where the graph supplies none.
    // Even a direct caller cannot erase a mounted/lifecycle host's needs.
    if (!hosts.has(id)) hosts.set(id, new Set(artifacts));
  }
  for (const node of product.nodes) {
    if (!hosts.has(node.id)) hosts.set(node.id, new Set(artifactIds));
  }
  return hosts;
}
