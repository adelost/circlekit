import type {
  OutputArtifact,
  PortBindingIr,
  PortRegistryEntry,
  ProductComponentInstance,
  ProductEmitterPlugin,
  ProductNodeInstance,
  ProductNodeType,
} from "@v1d/product-spec";
import type { CapabilityDeclaration, CapabilityTable, EffectDeclaration } from "./capability-model.js";
import { domainOf } from "./declaration-ids.js";

/**
 * The product as a picture, generated from the same IR Kotlin is generated
 * from, so it can never describe a product that no longer exists.
 *
 * Two files. The DOMAIN graph is the one to read: every first id segment is a
 * node, every port binding that crosses two of them is an edge labelled with
 * the contract that crosses, and a domain nothing binds to is drawn dashed
 * red rather than left out. The FULL graph is every node and component inside
 * its domain and is for reading one domain at a time, not the whole.
 *
 * A STATE_FEEDBACK capability is a read of another domain's state that has no
 * port. Those are drawn as dashed edges so that the honest graph and the
 * declared graph are the same picture: the dashed lines are the debt.
 */
export interface DomainGraphEmission {
  /** Repo-relative path the domain graph is written to. */
  readonly domains: string;
  /** Repo-relative path the full graph is written to. */
  readonly full: string;
  /** Repo-relative path of the product JSON, named in the header as the source of the edges. */
  readonly productJsonPath: string;
}

/** Everything the graph reads; a compiled ProductIr satisfies it. */
export interface DomainGraphSource {
  readonly nodeTypes: readonly Pick<ProductNodeType, "id" | "kind" | "runtime">[];
  readonly nodes: readonly Pick<ProductNodeInstance, "id" | "nodeTypeRef">[];
  readonly components: readonly Pick<ProductComponentInstance, "id">[];
  readonly portRegistry: {
    readonly nodePorts: readonly Pick<PortRegistryEntry, "ref" | "ownerId" | "contractRef">[];
    readonly componentPorts: readonly Pick<PortRegistryEntry, "ref" | "ownerId" | "contractRef">[];
    readonly bindings: readonly Pick<PortBindingIr, "from" | "to">[];
  };
}

export function domainGraphEmitter(emission: DomainGraphEmission, table: CapabilityTable): ProductEmitterPlugin {
  return {
    id: "domain-graph",
    emit(product) {
      return [
        artifact(emission.domains, emitDomainGraph(product, table, emission.productJsonPath)),
        artifact(emission.full, emitFullGraph(product, emission.productJsonPath)),
      ];
    },
  };
}

function artifact(path: string, content: string): OutputArtifact {
  return { id: path, path, mediaType: "text/vnd.mermaid", content };
}

type OwnerKind = ProductNodeType["kind"] | "component";

interface Owner {
  readonly id: string;
  readonly domain: string;
  readonly kind: OwnerKind;
}

function owners(product: DomainGraphSource): ReadonlyMap<string, Owner> {
  const typeById = new Map(product.nodeTypes.map((type) => [type.id, type]));
  const result = new Map<string, Owner>();
  for (const node of product.nodes) {
    const type = typeById.get(node.nodeTypeRef);
    if (type === undefined) throw new Error(`node instance '${node.id}' uses missing node type '${node.nodeTypeRef}'`);
    result.set(node.id, { id: node.id, domain: domainOf(node.id), kind: type.kind });
  }
  for (const component of product.components) {
    result.set(component.id, { id: component.id, domain: domainOf(component.id), kind: "component" });
  }
  return result;
}

interface Edge {
  readonly from: string;
  readonly to: string;
  readonly contractRef: string;
}

function edges(product: DomainGraphSource): readonly Edge[] {
  const ports = new Map(
    [...product.portRegistry.nodePorts, ...product.portRegistry.componentPorts].map((port) => [port.ref, port]),
  );
  return product.portRegistry.bindings.map((binding) => {
    const from = ports.get(binding.from);
    const to = ports.get(binding.to);
    if (from === undefined || to === undefined) {
      throw new Error(`port binding '${binding.from}' -> '${binding.to}' names an unregistered port`);
    }
    return { from: from.ownerId, to: to.ownerId, contractRef: from.contractRef };
  });
}

interface FeedbackEdge {
  readonly from: string;
  readonly to: string;
  readonly label: string;
}

/** Dashed edges: state read or written outside the port graph, by capability row. */
function feedbackEdges(
  product: DomainGraphSource,
  capabilities: readonly CapabilityDeclaration[],
  effects: readonly EffectDeclaration[],
): readonly FeedbackEdge[] {
  const capabilityDomain = new Map(
    capabilities.filter((row) => row.kind === "STATE_FEEDBACK").map((row) => [row.id, row.domain ?? ""]),
  );
  const effectDomain = new Map(
    effects.filter((row) => row.kind === "STATE_FEEDBACK").map((row) => [row.id, row.domain ?? ""]),
  );
  const typeById = new Map(product.nodeTypes.map((type) => [type.id, type]));
  const result: FeedbackEdge[] = [];
  for (const node of product.nodes) {
    const type = typeById.get(node.nodeTypeRef);
    if (type === undefined) continue;
    const domain = domainOf(node.id);
    for (const id of type.runtime.contextInputs) {
      const from = capabilityDomain.get(id);
      if (from !== undefined && from !== domain) result.push({ from, to: domain, label: id });
    }
    for (const id of type.runtime.effects) {
      const to = effectDomain.get(id);
      if (to !== undefined && to !== domain) result.push({ from: domain, to, label: id });
    }
  }
  return result;
}

const shortContract = (ref: string): string => ref.replace(/^[a-z0-9-]+\./u, "");
const mermaidId = (id: string): string => id.replace(/[^A-Za-z0-9]/gu, "_");
const unique = <T>(items: readonly T[]): readonly T[] => [...new Set(items)];
const sortedEntries = <T>(map: ReadonlyMap<string, T>): readonly (readonly [string, T])[] =>
  [...map.entries()].sort(([a], [b]) => a.localeCompare(b));

function label(contracts: readonly string[], max = 3): string {
  const names = [...unique(contracts.map(shortContract))].sort();
  return names.length > max
    ? `${names.slice(0, max).join(", ")} +${names.length - max}`
    : names.join(", ");
}

function countLabel(count: number, noun: string): string | null {
  return count > 0 ? `${count} ${noun}${count === 1 ? "" : "s"}` : null;
}

export function emitDomainGraph(
  product: DomainGraphSource,
  table: CapabilityTable,
  productJsonPath: string,
): string {
  const byId = owners(product);
  const domains = new Map<string, { nodes: number; components: number }>();
  for (const owner of byId.values()) {
    const count = domains.get(owner.domain) ?? { nodes: 0, components: 0 };
    if (owner.kind === "component") count.components += 1;
    else count.nodes += 1;
    domains.set(owner.domain, count);
  }
  const solid = new Map<string, string[]>();
  for (const edge of edges(product)) {
    const a = byId.get(edge.from)?.domain;
    const b = byId.get(edge.to)?.domain;
    if (a === undefined || b === undefined) {
      throw new Error(`port binding '${edge.from}' -> '${edge.to}' names an owner that is not a node or component`);
    }
    if (a === b) continue;
    const key = `${a} ${b}`;
    solid.set(key, [...(solid.get(key) ?? []), edge.contractRef]);
  }
  const dashed = new Map<string, string[]>();
  for (const edge of feedbackEdges(product, table.capabilities, table.effects)) {
    const key = `${edge.from} ${edge.to}`;
    dashed.set(key, [...(dashed.get(key) ?? []), edge.label]);
  }
  const connected = new Set([...solid.keys()].flatMap((key) => key.split(" ")));
  const lines = [
    "%% GENERATED FILE. DO NOT EDIT.",
    `%% GENERATED FROM ${productJsonPath} (port bindings) and`,
    `%% ${table.sourceFile} (STATE_FEEDBACK rows, dashed).`,
    "%% A dashed red domain has no port binding in or out. A dashed edge is state read",
    "%% or written without a port: the distance between the declared graph and the app.",
    "graph LR",
  ];
  for (const [domain, count] of sortedEntries(domains)) {
    const parts = [countLabel(count.nodes, "node"), countLabel(count.components, "component")]
      .filter((part) => part !== null);
    lines.push(`  ${mermaidId(domain)}["${domain}<br/>${parts.join(", ")}"]`);
  }
  for (const [key, contracts] of sortedEntries(solid)) {
    const [a, b] = key.split(" ");
    lines.push(`  ${mermaidId(a!)} -->|"${label(contracts)}"| ${mermaidId(b!)}`);
  }
  for (const [key, labels] of sortedEntries(dashed)) {
    const [a, b] = key.split(" ");
    lines.push(`  ${mermaidId(a!)} -.->|"${label(labels)}"| ${mermaidId(b!)}`);
  }
  for (const [domain] of sortedEntries(domains)) {
    if (!connected.has(domain)) {
      lines.push(`  style ${mermaidId(domain)} stroke-dasharray: 5 5,stroke:#c33`);
    }
  }
  return `${lines.join("\n")}\n`;
}

export function emitFullGraph(product: DomainGraphSource, productJsonPath: string): string {
  const byId = owners(product);
  const byDomain = new Map<string, Owner[]>();
  for (const owner of byId.values()) {
    byDomain.set(owner.domain, [...(byDomain.get(owner.domain) ?? []), owner]);
  }
  const lines = [
    "%% GENERATED FILE. DO NOT EDIT.",
    `%% GENERATED FROM ${productJsonPath} (nodes, components, port bindings).`,
    "%% Read one subgraph at a time; the whole is not meant to be read at once.",
    "graph LR",
  ];
  for (const [domain, members] of sortedEntries(byDomain)) {
    lines.push(`  subgraph ${mermaidId(domain)}["${domain}"]`);
    for (const owner of [...members].sort((a, b) => a.id.localeCompare(b.id))) {
      const shape = owner.kind === "component" ? ["([", "])"] : ["[", "]"];
      const name = owner.id.slice(domain.length + 1) || owner.id;
      lines.push(`    ${mermaidId(owner.id)}${shape[0]}"${name}<br/><i>${owner.kind}</i>"${shape[1]}`);
    }
    lines.push("  end");
  }
  const seen = new Map<string, string[]>();
  for (const edge of edges(product)) {
    const key = `${edge.from} ${edge.to}`;
    seen.set(key, [...(seen.get(key) ?? []), edge.contractRef]);
  }
  for (const [key, contracts] of sortedEntries(seen)) {
    const [a, b] = key.split(" ");
    lines.push(`  ${mermaidId(a!)} -->|"${label(contracts, 2)}"| ${mermaidId(b!)}`);
  }
  return `${lines.join("\n")}\n`;
}
