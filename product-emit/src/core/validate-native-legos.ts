import type {
  LegoConfigRef,
  LegoContract,
  ProductNodeType,
  PortBindingIr,
  ProductIr,
  ProductNodeInstance,
} from "@v1d/product-spec";

/**
 * Readable Kotlin files remain split by product-owned domain labels. The
 * labels never carry a second graph: nodes, contracts, bindings and demand
 * all come from the already compiled Product IR.
 */
export type NativeLegoDomainSource = Pick<
  ProductIr,
  "nodeTypes" | "nodes" | "configs" | "portRegistry"
>;

export interface NativeLegoDomainProjectionEntry {
  readonly id: string;
  readonly contracts: readonly LegoContract[];
  readonly configs: readonly LegoConfigRef[];
  readonly nodeTypes: readonly ProductNodeType[];
  readonly nodes: readonly ProductNodeInstance[];
  readonly bindings: readonly PortBindingIr[];
}

export interface NativeLegoDomainProjection {
  readonly aggregate: ProductIr["portRegistry"];
  readonly domains: readonly NativeLegoDomainProjectionEntry[];
}

export function projectNativeLegoDomains(
  product: NativeLegoDomainSource,
): NativeLegoDomainProjection {
  // Files are a readability split, never a second product registry. Every
  // instance already has one stable dotted ID, so its leading segment is the
  // only domain label the emitter needs. A hand-authored domain list could
  // omit a real node while leaving the compiled graph green.
  const domainIds = [...new Set(product.nodes.map(({ id }) => domainOf(id)))];
  const typeById = new Map(product.nodeTypes.map((item) => [item.id, item]));
  const configById = new Map(product.configs.map((item) => [item.id, item]));
  const nodeDomain = new Map<string, string>();

  for (const node of product.nodes) {
    const domain = domainOf(node.id);
    if (!typeById.has(node.nodeTypeRef)) {
      throw new Error(`node instance '${node.id}' uses missing node type '${node.nodeTypeRef}'`);
    }
    nodeDomain.set(node.id, domain);
  }

  const domains = domainIds.map((id): NativeLegoDomainProjectionEntry => {
    const nodes = product.nodes.filter((node) => nodeDomain.get(node.id) === id);
    if (nodes.length === 0) throw new Error(`native Lego domain '${id}' has no node instances`);
    const nodeTypeIds = new Set(nodes.map(({ nodeTypeRef }) => nodeTypeRef));
    const nodeTypes = product.nodeTypes.filter(({ id: typeId }) => nodeTypeIds.has(typeId));
    const configIds = new Set(nodes.flatMap(({ config }) => Object.values(config)));
    const configs = [...configIds].map((configId) => {
      const config = configById.get(configId);
      if (config === undefined) throw new Error(`native Lego domain '${id}' uses missing config '${configId}'`);
      return config;
    });
    const contractIds = new Set(nodeTypes.flatMap(({ inputs, outputs }) =>
      [...inputs, ...outputs].map(({ contract }) => contract.id)));
    const contracts = product.portRegistry.contracts.filter(({ id: contractId }) => contractIds.has(contractId));
    const bindings = product.portRegistry.bindings.filter(({ from, to }) => {
      const fromOwner = portOwner(from);
      const toOwner = portOwner(to);
      return nodeDomain.get(fromOwner) === id && nodeDomain.get(toOwner) === id;
    });
    return { id, contracts, configs, nodeTypes, nodes, bindings };
  });

  const assignedTypes = new Set(domains.flatMap(({ nodeTypes }) => nodeTypes.map(({ id }) => id)));
  const orphanTypes = product.nodeTypes.filter(({ id }) => !assignedTypes.has(id));
  if (orphanTypes.length > 0) {
    throw new Error(`node type has no native Lego domain '${orphanTypes.map(({ id }) => id).join("', '")}'`);
  }
  const assignedConfigs = new Set(domains.flatMap(({ configs }) => configs.map(({ id }) => id)));
  const orphanConfigs = product.configs.filter(({ id }) => !assignedConfigs.has(id));
  if (orphanConfigs.length > 0) {
    throw new Error(`config has no native Lego domain '${orphanConfigs.map(({ id }) => id).join("', '")}'`);
  }
  return { aggregate: product.portRegistry, domains };
}

function domainOf(value: string): string {
  const [domain, member] = value.split(".");
  if (domain === undefined || member === undefined || domain.length === 0 || member.length === 0) {
    throw new Error(`node instance '${value}' must use a dotted product ID`);
  }
  return domain;
}

function portOwner(ref: string): string {
  const split = ref.lastIndexOf(".");
  if (split < 1) throw new Error(`invalid product port ref '${ref}'`);
  return ref.slice(0, split);
}
