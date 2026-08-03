export type LegoPrimitive = "boolean" | "integer" | "number" | "string";
export type LegoRole = "source" | "adapter" | "selector" | "policy" | "consumer";
export type LegoStateOwner = "none" | "instance" | "external";
export type LegoLifetime = "call" | "operation" | "instance" | "process";
export type LegoDurability = "transient" | "durable";
export type LegoClockDomain = "none" | "monotonic" | "wall";

export interface LegoValueRef { readonly ref: string }
export interface LegoFiniteValueRef<Id extends string = string> extends LegoValueRef {
  readonly finite: true;
  readonly ref: Id;
}
export interface LegoFiniteValueDeclaration<
  Id extends string = string,
  Value extends string = string,
> {
  readonly id: Id;
  readonly values: readonly Value[];
}
export type FiniteValueOf<Declaration extends LegoFiniteValueDeclaration> =
  Declaration["values"][number];
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

export function finiteValueRef<const Id extends string>(ref: Id): LegoFiniteValueRef<Id> {
  requireWireId(ref, "finite value ref");
  return { ref, finite: true };
}

export function finiteValues<const Id extends string, const Value extends string>(
  id: Id,
  values: readonly Value[],
): LegoFiniteValueDeclaration<Id, Value> {
  requireWireId(id, "finite value declaration");
  if (values.length === 0) throw new Error(`finite value declaration '${id}' has no values`);
  requireUnique(values, `value in finite declaration '${id}'`);
  values.forEach((value) => requireWireId(value, `value in finite declaration '${id}'`));
  return { id, values };
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

export type LegoConfigValue = boolean | number | string;

export interface LegoConfigField {
  readonly name: string;
  readonly value: LegoPrimitive;
  readonly unit?: string;
  readonly min?: number;
  readonly positive?: boolean;
  readonly gteField?: string;
}

export interface LegoConfigFieldOptions extends Pick<LegoFieldOptions, "unit"> {
  readonly min?: number;
  readonly positive?: boolean;
  readonly gteField?: string;
}

export function configField(
  name: string,
  value: LegoPrimitive,
  options: LegoConfigFieldOptions = {},
): LegoConfigField {
  return {
    name,
    value,
    ...(options.unit === undefined ? {} : { unit: options.unit }),
    ...(options.min === undefined ? {} : { min: options.min }),
    ...(options.positive === undefined ? {} : { positive: options.positive }),
    ...(options.gteField === undefined ? {} : { gteField: options.gteField }),
  };
}

export interface LegoConfigInput<Id extends string = string> {
  readonly id: Id;
  readonly fields: readonly LegoConfigField[];
}

export function configInput<const Id extends string>(
  id: Id,
  fields: readonly LegoConfigField[] = [],
): LegoConfigInput<Id> {
  return { id, fields };
}

export interface LegoConfigRef {
  readonly id: string;
  readonly values?: Readonly<Record<string, LegoConfigValue>>;
}

export interface LegoPort<Id extends string = string, Contract extends LegoContract = LegoContract> {
  readonly id: Id;
  readonly contract: Contract;
}

export function port<const Id extends string, const Contract extends LegoContract>(
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
  readonly configInputs?: readonly LegoConfigInput[];
  readonly runtime: LegoRuntimeSpec;
}

export function defineLegoSpec<const T extends LegoSpec>(spec: T): T {
  requireWireId(spec.id, "LegoSpec");
  validatePorts(spec.inputs, `${spec.id} input`);
  validatePorts(spec.outputs, `${spec.id} output`);
  validateConfigInputs(spec.configInputs ?? [], spec.id);
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

export type InputRefsForContract<Mounts extends readonly ProductLegoMount[], ContractId extends string> =
  Mounts[number] extends infer Mount
    ? Mount extends ProductLegoMount
      ? Mount["lego"]["inputs"][number] extends infer Input
        ? Input extends LegoPort
          ? Input["contract"]["id"] extends ContractId ? `${Mount["id"]}.${Input["id"]}` : never
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
              InputRefsForContract<Mounts, Output["contract"]["id"]>
            >
          : never
        : never
      : never
    : never;

export interface ProductLegoDeclaration<Mounts extends readonly ProductLegoMount[] = readonly ProductLegoMount[]> {
  readonly id: string;
  readonly configs: readonly LegoConfigRef[];
  readonly mounts: Mounts;
  readonly wiring: readonly CompatibleConnection<Mounts>[];
}

export interface ProductLegoConfig<Mounts extends readonly ProductLegoMount[] = readonly ProductLegoMount[]>
  extends ProductLegoDeclaration<Mounts> {
  /** Derived from mounted LegoSpec ports; products never repeat contract schemas. */
  readonly contracts: readonly LegoContract[];
}

/** Validate reusable LegoSpecs and the product's port-to-port composition. */
export function defineProductLegoConfig<
  const Mounts extends readonly ProductLegoMount[],
>(product: Omit<ProductLegoDeclaration<Mounts>, "wiring"> & {
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
>(product: Omit<ProductLegoDeclaration<Mounts>, "wiring"> & {
  readonly wiring: readonly CompatibleConnection<NoInfer<Mounts>>[];
}, externalInputs: ReadonlySet<string> = new Set(), externalOutputs: ReadonlySet<string> = new Set()): ProductLegoConfig<Mounts> {
  requireWireId(product.id, "product Lego config");
  requireUnique(product.configs.map(({ id }) => id), "config");
  requireUnique(product.mounts.map(({ id }) => id), "mount");

  const contracts = new Map<string, LegoContract>();
  const configs = new Map(product.configs.map((config) => [config.id, config]));
  const usedConfigs = new Set<string>();
  const inputs = new Map<string, string>();
  const outputs = new Map<string, string>();
  for (const config of product.configs) {
    requireWireId(config.id, "config");
    for (const name of Object.keys(config.values ?? {})) {
      requireIdentifier(name, `field in config '${config.id}'`);
    }
  }
  for (const item of product.mounts) {
    requireWireId(item.id, "mount");
    const configInputs = new Map((item.lego.configInputs ?? []).map((input) => [input.id, input]));
    for (const [name, id] of Object.entries(item.config)) {
      requireIdentifier(name, `config key in '${item.id}'`);
      const input = configInputs.get(name);
      if (input === undefined) throw new Error(`mount '${item.id}' uses undeclared config input '${name}'`);
      const config = configs.get(id);
      if (config === undefined) throw new Error(`mount '${item.id}' uses unknown config '${id}'`);
      validateConfigValues(item.id, input, config);
      usedConfigs.add(id);
    }
    for (const input of configInputs.values()) {
      if (!(input.id in item.config)) throw new Error(`mount '${item.id}' is missing config input '${input.id}'`);
    }
    for (const input of item.lego.inputs) {
      registerContract(contracts, input.contract);
      addPort(inputs, item.id, input);
    }
    for (const output of item.lego.outputs) {
      registerContract(contracts, output.contract);
      addPort(outputs, item.id, output);
    }
  }
  const orphanConfigs = [...configs.keys()].filter((id) => !usedConfigs.has(id));
  if (orphanConfigs.length > 0) throw new Error(`orphan config '${orphanConfigs.join("', '")}'`);

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
  return { ...product, contracts: [...contracts.values()] };
}

function validateConfigInputs(inputs: readonly LegoConfigInput[], owner: string): void {
  requireUnique(inputs.map(({ id }) => id), `${owner} config input`);
  for (const input of inputs) {
    requireIdentifier(input.id, `${owner} config input`);
    requireUnique(input.fields.map(({ name }) => name), `field in ${owner} config input '${input.id}'`);
    const fields = new Map(input.fields.map((item) => [item.name, item]));
    for (const item of input.fields) {
      requireIdentifier(item.name, `field in ${owner} config input '${input.id}'`);
      if (item.unit !== undefined) requireWireId(item.unit, `unit in ${owner} config input '${input.id}'`);
      const numeric = item.value === "integer" || item.value === "number";
      if ((item.min !== undefined || item.positive !== undefined || item.gteField !== undefined) && !numeric) {
        throw new Error(`constraints on ${owner} config field '${item.name}' require a numeric type`);
      }
      if (item.min !== undefined && !Number.isFinite(item.min)) {
        throw new Error(`minimum on ${owner} config field '${item.name}' must be finite`);
      }
      if (item.positive !== undefined && item.positive !== true) {
        throw new Error(`positive constraint on ${owner} config field '${item.name}' must be true or omitted`);
      }
      if (item.gteField !== undefined) {
        requireIdentifier(item.gteField, `gteField on ${owner} config field '${item.name}'`);
        const compared = fields.get(item.gteField);
        if (compared === undefined || (compared.value !== "integer" && compared.value !== "number")) {
          throw new Error(`gteField on ${owner} config field '${item.name}' must reference a numeric sibling`);
        }
        if (item.gteField === item.name) {
          throw new Error(`gteField on ${owner} config field '${item.name}' cannot reference itself`);
        }
      }
    }
  }
}

function validateConfigValues(
  mountId: string,
  input: LegoConfigInput,
  config: LegoConfigRef,
): void {
  const values = config.values ?? {};
  const fields = new Map(input.fields.map((item) => [item.name, item]));
  const missing = [...fields.keys()].filter((name) => !(name in values));
  const extra = Object.keys(values).filter((name) => !fields.has(name));
  if (missing.length > 0) {
    throw new Error(`config '${config.id}' for mount '${mountId}' is missing field '${missing.join("', '")}'`);
  }
  if (extra.length > 0) {
    throw new Error(`config '${config.id}' for mount '${mountId}' has undeclared field '${extra.join("', '")}'`);
  }
  for (const [name, item] of fields) {
    const value = values[name];
    const valid = item.value === "boolean" ? typeof value === "boolean"
      : item.value === "string" ? typeof value === "string"
      : item.value === "integer" ? typeof value === "number" && Number.isSafeInteger(value)
      : typeof value === "number" && Number.isFinite(value);
    if (!valid) throw new Error(`config '${config.id}' field '${name}' must be ${item.value}`);
    if (typeof value !== "number") continue;
    if (item.min !== undefined && value < item.min) {
      throw new Error(`config '${config.id}' field '${name}' must be at least ${item.min}`);
    }
    if (item.positive === true && value <= 0) {
      throw new Error(`config '${config.id}' field '${name}' must be positive`);
    }
    if (item.gteField !== undefined && value < (values[item.gteField] as number)) {
      throw new Error(`config '${config.id}' field '${name}' must be at least field '${item.gteField}'`);
    }
  }
}

function validateContract(contract: LegoContract): void {
  requireWireId(contract.id, "contract");
  if (contract.fields.length === 0 && contract.kind !== "event") {
    throw new Error(`contract '${contract.id}' has no fields`);
  }
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
    validateContract(contract);
  });
}

function addPort(
  target: Map<string, string>,
  mountId: string,
  item: LegoPort,
): void {
  target.set(`${mountId}.${item.id}`, item.contract.id);
}

function registerContract(target: Map<string, LegoContract>, contract: LegoContract): void {
  const existing = target.get(contract.id);
  if (existing !== undefined && contractFingerprint(existing) !== contractFingerprint(contract)) {
    throw new Error(`contract '${contract.id}' has conflicting schemas`);
  }
  if (existing === undefined) target.set(contract.id, contract);
}

function contractFingerprint(contract: LegoContract): string {
  return JSON.stringify({
    kind: contract.kind,
    fields: contract.fields.map((item) => ({
      name: item.name,
      value: typeof item.value === "string" ? item.value : {
        ref: item.value.ref,
        finite: "finite" in item.value && item.value.finite === true,
      },
      unit: item.unit ?? null,
      nullable: item.nullable,
      clockDomain: item.clockDomain,
    })),
  });
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
