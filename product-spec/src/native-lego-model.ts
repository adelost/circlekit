export type LegoPrimitive = "boolean" | "integer" | "number" | "string";
export type LegoRole = "source" | "adapter" | "selector" | "policy" | "consumer";
export type LegoStateOwner = "none" | "instance" | "external";
export type LegoLifetime = "call" | "operation" | "instance" | "process";
export type LegoDurability = "transient" | "durable";
export type LegoClockDomain = "none" | "monotonic" | "wall";

export interface LegoValueRef { readonly ref: string }
export interface LegoFieldOptions {
  readonly unit?: string;
  readonly nullable?: boolean;
  readonly clockDomain?: LegoClockDomain;
}

export interface LegoField {
  readonly name: string;
  readonly value: LegoPrimitive | LegoValueRef;
  readonly unit?: string;
  readonly nullable: boolean;
  readonly clockDomain: LegoClockDomain;
}

export function valueRef(ref: string): LegoValueRef {
  requireWireId(ref, "value ref");
  return { ref };
}

export function field(
  name: string,
  value: LegoPrimitive | LegoValueRef,
  options: LegoFieldOptions = {},
): LegoField {
  return {
    name,
    value,
    nullable: options.nullable ?? false,
    clockDomain: options.clockDomain ?? "none",
    ...(options.unit === undefined ? {} : { unit: options.unit }),
  };
}

export interface LegoContract {
  readonly id: string;
  readonly kind: "observation" | "state" | "snapshot" | "event";
  readonly fields: readonly LegoField[];
}

export interface LegoConfigRef { readonly id: string }

export interface LegoPort<Id extends string = string, Contract extends string = string> {
  readonly id: Id;
  readonly contract: Contract;
}

export function port<const Id extends string, const Contract extends string>(
  id: Id,
  contract: Contract,
): LegoPort<Id, Contract> {
  return { id, contract };
}

export interface LegoRuntimeSpec {
  readonly stateOwner: LegoStateOwner;
  readonly lifetime: LegoLifetime;
  readonly durability: LegoDurability;
  readonly clockDomain: LegoClockDomain;
  readonly contextInputs: readonly string[];
  readonly effects: readonly string[];
}

export interface LegoSpec {
  readonly id: string;
  readonly role: LegoRole;
  readonly inputs: readonly LegoPort[];
  readonly outputs: readonly LegoPort[];
  readonly runtime: LegoRuntimeSpec;
}

export function defineLegoSpec<const T extends LegoSpec>(spec: T): T {
  requireWireId(spec.id, "LegoSpec");
  validatePorts(spec.inputs, `${spec.id} input`);
  validatePorts(spec.outputs, `${spec.id} output`);
  requireUnique(spec.runtime.contextInputs, `${spec.id} context input`);
  requireUnique(spec.runtime.effects, `${spec.id} effect`);
  spec.runtime.contextInputs.forEach((id) => requireWireId(id, `${spec.id} context input`));
  spec.runtime.effects.forEach((id) => requireWireId(id, `${spec.id} effect`));
  if (spec.runtime.durability === "durable" && spec.runtime.stateOwner === "none") {
    throw new Error(`LegoSpec '${spec.id}' cannot make unowned state durable`);
  }
  return spec;
}

export interface ProductLegoMount<
  Id extends string = string,
  Spec extends LegoSpec = LegoSpec,
> {
  readonly id: Id;
  readonly lego: Spec;
  readonly config: Readonly<Record<string, string>>;
}

export function mount<const Id extends string, const Spec extends LegoSpec>(
  id: Id,
  lego: Spec,
  config: Readonly<Record<string, string>> = {},
): ProductLegoMount<Id, Spec> {
  return { id, lego, config };
}

export type InputRefsForContract<Mounts extends readonly ProductLegoMount[], Contract extends string> =
  Mounts[number] extends infer Mount
    ? Mount extends ProductLegoMount
      ? Mount["lego"]["inputs"][number] extends infer Input
        ? Input extends LegoPort
          ? Input["contract"] extends Contract ? `${Mount["id"]}.${Input["id"]}` : never
          : never
        : never
      : never
    : never;

export interface ProductPortConnection<From extends string = string, To extends string = string> {
  readonly from: From;
  readonly to: To;
}

export type ProductInputPortRef<Mounts extends readonly ProductLegoMount[]> =
  Mounts[number] extends infer Mount
    ? Mount extends ProductLegoMount
      ? Mount["lego"]["inputs"][number] extends infer Input
        ? Input extends LegoPort ? `${Mount["id"]}.${Input["id"]}` : never
        : never
      : never
    : never;

export type ProductOutputPortRef<Mounts extends readonly ProductLegoMount[]> =
  Mounts[number] extends infer Mount
    ? Mount extends ProductLegoMount
      ? Mount["lego"]["outputs"][number] extends infer Output
        ? Output extends LegoPort ? `${Mount["id"]}.${Output["id"]}` : never
        : never
      : never
    : never;

export type CompatibleConnection<Mounts extends readonly ProductLegoMount[]> =
  Mounts[number] extends infer Mount
    ? Mount extends ProductLegoMount
      ? Mount["lego"]["outputs"][number] extends infer Output
        ? Output extends LegoPort
          ? ProductPortConnection<
              `${Mount["id"]}.${Output["id"]}`,
              InputRefsForContract<Mounts, Output["contract"]>
            >
          : never
        : never
      : never
    : never;

export interface ProductLegoConfig<Mounts extends readonly ProductLegoMount[] = readonly ProductLegoMount[]> {
  readonly id: string;
  readonly contracts: readonly LegoContract[];
  readonly configs: readonly LegoConfigRef[];
  readonly mounts: Mounts;
  readonly wiring: readonly CompatibleConnection<Mounts>[];
}

/** Validate reusable LegoSpecs and the product's port-to-port composition. */
export function defineProductLegoConfig<
  const Mounts extends readonly ProductLegoMount[],
>(product: Omit<ProductLegoConfig<Mounts>, "wiring"> & {
  readonly wiring: readonly CompatibleConnection<NoInfer<Mounts>>[];
}): ProductLegoConfig<Mounts> {
  return validateProductLegoConfig(product);
}

/**
 * Validate one product graph while allowing a higher-level ProductSpec to own
 * its UI boundary. External inputs are produced by actions; external outputs
 * are consumed by state/value presentation. The lower-level helper keeps its
 * strict closed-graph default by passing neither set.
 */
export function validateProductLegoConfig<
  const Mounts extends readonly ProductLegoMount[],
>(product: Omit<ProductLegoConfig<Mounts>, "wiring"> & {
  readonly wiring: readonly CompatibleConnection<NoInfer<Mounts>>[];
}, externalInputs: ReadonlySet<string> = new Set(), externalOutputs: ReadonlySet<string> = new Set()): ProductLegoConfig<Mounts> {
  requireWireId(product.id, "product Lego config");
  requireUnique(product.contracts.map(({ id }) => id), "contract");
  requireUnique(product.configs.map(({ id }) => id), "config");
  requireUnique(product.mounts.map(({ id }) => id), "mount");

  const contracts = new Set(product.contracts.map(({ id }) => id));
  const configs = new Set(product.configs.map(({ id }) => id));
  const inputs = new Map<string, string>();
  const outputs = new Map<string, string>();
  for (const contract of product.contracts) validateContract(contract);
  for (const config of product.configs) requireWireId(config.id, "config");
  for (const item of product.mounts) {
    requireWireId(item.id, "mount");
    for (const [name, id] of Object.entries(item.config)) {
      requireIdentifier(name, `config key in '${item.id}'`);
      if (!configs.has(id)) throw new Error(`mount '${item.id}' uses unknown config '${id}'`);
    }
    for (const input of item.lego.inputs) addPort(inputs, item.id, input, contracts);
    for (const output of item.lego.outputs) addPort(outputs, item.id, output, contracts);
  }

  const connectedInputs = new Set<string>();
  const connectedOutputs = new Set<string>();
  const graph = new Map(product.mounts.map(({ id }) => [id, new Set<string>()]));
  const wiring = product.wiring as readonly ProductPortConnection[];
  for (const connection of wiring) {
    const output = outputs.get(connection.from);
    const input = inputs.get(connection.to);
    if (output === undefined) throw new Error(`unknown output port '${connection.from}'`);
    if (input === undefined) throw new Error(`unknown input port '${connection.to}'`);
    if (output !== input) throw new Error(`incompatible ports '${connection.from}' and '${connection.to}'`);
    if (connectedInputs.has(connection.to)) throw new Error(`input port '${connection.to}' is connected twice`);
    connectedInputs.add(connection.to);
    connectedOutputs.add(connection.from);
    graph.get(ownerOf(product.mounts, connection.from, "outputs"))
      ?.add(ownerOf(product.mounts, connection.to, "inputs"));
  }
  for (const ref of externalInputs) {
    if (!inputs.has(ref)) throw new Error(`unknown external input port '${ref}'`);
    if (connectedInputs.has(ref)) throw new Error(`input port '${ref}' has both wiring and an external producer`);
    connectedInputs.add(ref);
  }
  for (const ref of externalOutputs) {
    if (!outputs.has(ref)) throw new Error(`unknown external output port '${ref}'`);
    connectedOutputs.add(ref);
  }
  requireAllConnected(inputs, connectedInputs, "input");
  requireAllConnected(outputs, connectedOutputs, "output");
  requireAcyclic(graph);
  return product;
}

function validateContract(contract: LegoContract): void {
  requireWireId(contract.id, "contract");
  if (contract.fields.length === 0) throw new Error(`contract '${contract.id}' has no fields`);
  requireUnique(contract.fields.map(({ name }) => name), `field in '${contract.id}'`);
  for (const item of contract.fields) {
    requireIdentifier(item.name, `field in '${contract.id}'`);
    if (typeof item.value !== "string") requireWireId(item.value.ref, `value ref in '${contract.id}'`);
    if (item.unit !== undefined) requireWireId(item.unit, `unit in '${contract.id}'`);
  }
}

function validatePorts(ports: readonly LegoPort[], owner: string): void {
  requireUnique(ports.map(({ id }) => id), owner);
  ports.forEach(({ id, contract }) => {
    requireIdentifier(id, owner);
    requireWireId(contract, `${owner} contract`);
  });
}

function addPort(
  target: Map<string, string>,
  mountId: string,
  item: LegoPort,
  contracts: ReadonlySet<string>,
): void {
  if (!contracts.has(item.contract)) throw new Error(`mount '${mountId}' uses unknown contract '${item.contract}'`);
  target.set(`${mountId}.${item.id}`, item.contract);
}

function requireAllConnected(
  ports: ReadonlyMap<string, string>,
  connected: ReadonlySet<string>,
  direction: string,
): void {
  const orphan = [...ports.keys()].filter((ref) => !connected.has(ref));
  if (orphan.length > 0) throw new Error(`orphan ${direction} port '${orphan.join("', '")}'`);
}

function ownerOf(
  mounts: readonly ProductLegoMount[],
  ref: string,
  direction: "inputs" | "outputs",
): string {
  const owner = mounts.find((item) =>
    item.lego[direction].some((itemPort) => `${item.id}.${itemPort.id}` === ref));
  if (owner === undefined) throw new Error(`port '${ref}' has no mount`);
  return owner.id;
}

function requireAcyclic(graph: ReadonlyMap<string, ReadonlySet<string>>): void {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): void => {
    if (visiting.has(id)) throw new Error(`Lego wiring cycle reaches '${id}'`);
    if (visited.has(id)) return;
    visiting.add(id);
    graph.get(id)?.forEach(visit);
    visiting.delete(id);
    visited.add(id);
  };
  graph.forEach((_, id) => visit(id));
}

function requireIdentifier(value: string, owner: string): void {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(value)) throw new Error(`${owner} has invalid identifier '${value}'`);
}

function requireWireId(value: string, owner: string): void {
  if (!/^[a-z][a-z0-9.-]*$/u.test(value)) throw new Error(`${owner} has invalid wire id '${value}'`);
}

function requireUnique(values: readonly string[], owner: string): void {
  if (new Set(values).size !== values.length) throw new Error(`duplicate ${owner}`);
}
