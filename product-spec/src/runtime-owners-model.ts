import type { ScreenComponentFamilyRef } from "./component-tree-model.js";
import type { FetchService } from "./fetch-service-model.js";
import type { CompiledProductGraph } from "./port-graph-model.js";
import type { StoreService } from "./store-service-model.js";

/**
 * Stores and fetches stay out of the IR, but every effect they declare must be run by a compiled node
 * instance, so a policy cannot describe work no runtime does. A store effect has exactly one running
 * owner, since two instances of one type would both write; a fetch effect may be shared, and a fetch
 * that names its owner node is demanded on each screen it names.
 */
export function requireRuntimeOwners(
  declaration: {
    readonly id: string;
    readonly stores: readonly StoreService[];
    readonly fetches: readonly FetchService[];
    readonly componentFamilies: readonly ScreenComponentFamilyRef[];
  },
  graph: CompiledProductGraph,
): void {
  // Required by the type; an untyped caller that leaves one out is refused by name, never read as none.
  for (const key of ["stores", "fetches"] as const) {
    if (!Array.isArray(declaration[key])) throw new Error(`product '${declaration.id}' needs ${key}; a product with none writes ${key}: []`);
  }
  const effectsOfType = new Map(graph.nodeTypes.map((type) => [type.id, type.runtime.effects]));
  const owners = new Map<string, string[]>();
  for (const node of graph.nodes) {
    for (const effect of effectsOfType.get(node.nodeTypeRef) ?? []) owners.set(effect, [...owners.get(effect) ?? [], node.id]);
  }
  for (const store of declaration.stores) {
    for (const effect of store.effectIds) {
      const found = owners.get(effect) ?? [];
      if (found.length !== 1) {
        const named = found.length === 0 ? "" : ` (${found.join(", ")})`;
        throw new Error(`store '${store.id}' effect '${effect}' needs exactly one compiled owner, has ${found.length}${named}`);
      }
    }
  }
  const nodes = new Set(graph.nodes.map(({ id }) => id));
  const screens = new Set(declaration.componentFamilies.map(({ screen }) => screen));
  const demanded = new Set(graph.portRegistry.demandEdges.flatMap((edge) =>
    edge.kind === "component-mount" ? [`${edge.screenRef} ${edge.nodeInstanceRef}`] : []));
  for (const fetch of declaration.fetches) {
    for (const effect of fetch.effectIds) {
      if (!owners.has(effect)) throw new Error(`fetch '${fetch.id}' effect '${effect}' has no compiled owner`);
    }
    const owner = fetch.ownerNodeRef;
    if (owner === undefined) continue;
    if (!nodes.has(owner)) throw new Error(`fetch '${fetch.id}' ownerNodeRef '${owner}' is not a compiled node`);
    for (const screen of fetch.screenRefs ?? []) {
      if (!screens.has(screen)) throw new Error(`fetch '${fetch.id}' screen '${screen}' is not a component-family screen`);
      if (!demanded.has(`${screen} ${owner}`)) {
        throw new Error(`fetch '${fetch.id}' owner '${owner}' is not demanded on screen '${screen}'`);
      }
    }
  }
}
