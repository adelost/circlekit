export type LegoPrimitive = "boolean" | "integer" | "number" | "string";
/** The only executable authoring kinds. Graph position is derived, never declared as a second role. */
export type ProductNodeKind = "service" | "derive" | "present";
export type LegoStateOwner = "none" | "instance" | "external";
export type LegoLifetime = "call" | "operation" | "instance" | "process";
export type LegoDurability = "transient" | "durable";
export type LegoClockDomain = "none" | "monotonic" | "wall";
export type LegoBoundaryKind = "presentation" | "ui-event" | "service-internal";

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

export type LegoNavigationContract =
  | { readonly kind: "active-page" }
  | { readonly kind: "guard" }
  | { readonly kind: "route"; readonly effect: "push" };

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

type FiniteProductValue<Axes extends readonly LegoFiniteValueDeclaration[]> =
  Axes extends readonly [infer Head extends LegoFiniteValueDeclaration,
    ...infer Tail extends readonly LegoFiniteValueDeclaration[]]
    ? Tail extends readonly [] ? FiniteValueOf<Head> : `${FiniteValueOf<Head>}.${FiniteProductValue<Tail>}`
    : never;

/** Closed cartesian state ids, generated from literal axes rather than copied by hand. */
export function finiteProduct<
  const Id extends string,
  const Axes extends readonly [LegoFiniteValueDeclaration, LegoFiniteValueDeclaration,
    ...LegoFiniteValueDeclaration[]],
>(id: Id, axes: Axes): LegoFiniteValueDeclaration<Id, FiniteProductValue<Axes>> {
  requireUnique(axes.map(({ id: axisId }) => axisId), `axis in finite product '${id}'`);
  let values: string[] = [""];
  for (const axis of axes) {
    values = values.flatMap((prefix) => axis.values.map((value) => prefix === "" ? value : `${prefix}.${value}`));
  }
  return finiteValues(id, values) as LegoFiniteValueDeclaration<Id, FiniteProductValue<Axes>>;
}

/** Exhaustive case data generated from every member of one closed declaration. */
export function mapFiniteCases<
  const Declaration extends LegoFiniteValueDeclaration,
  const Payload,
>(declaration: Declaration, map: (value: Declaration["values"][number]) => Payload):
  Readonly<{ [Value in Declaration["values"][number]]: Payload }> {
  return Object.fromEntries(declaration.values.map((value) => [value, map(value)])) as
    Readonly<{ [Value in Declaration["values"][number]]: Payload }>;
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
  readonly boundary: LegoBoundaryKind;
  readonly fields: readonly LegoField[];
  /** Optional compiler-owned navigation meaning; it is part of contract identity. */
  readonly navigation?: LegoNavigationContract;
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

export type LegoPortPurpose = "data" | "demand" | "context";

export interface LegoPort<
  Id extends string = string,
  Contract extends LegoContract = LegoContract,
  Purpose extends LegoPortPurpose = LegoPortPurpose,
> {
  readonly id: Id;
  readonly contract: Contract;
  readonly purpose: Purpose;
}

export function port<const Id extends string, const Contract extends LegoContract>(
  id: Id,
  contract: Contract,
): LegoPort<Id, Contract, "data"> {
  return { id, contract, purpose: "data" };
}

/** A control edge which contributes activation but never data dependency. */
export function demandPort<const Id extends string, const Contract extends LegoContract>(
  id: Id,
  contract: Contract,
): LegoPort<Id, Contract, "demand"> {
  if (contract.boundary !== "service-internal" || contract.kind !== "event") {
    throw new Error(`demand port '${id}' must use a service-internal event contract`);
  }
  return { id, contract, purpose: "demand" };
}

/** Optional policy/cadence context which never contributes activation. */
export function contextPort<const Id extends string, const Contract extends LegoContract>(
  id: Id,
  contract: Contract,
): LegoPort<Id, Contract, "context"> {
  if (contract.boundary !== "service-internal" || contract.kind === "event") {
    throw new Error(`context port '${id}' must use a non-event service-internal contract`);
  }
  return { id, contract, purpose: "context" };
}

export interface ProductNodeRuntime {
  readonly stateOwner: LegoStateOwner;
  readonly lifetime: LegoLifetime;
  readonly durability: LegoDurability;
  readonly clockDomain: LegoClockDomain;
  readonly contextInputs: readonly string[];
  readonly effects: readonly string[];
}

export interface ProductNodeType {
  readonly id: string;
  readonly kind: ProductNodeKind;
  readonly inputs: readonly LegoPort[];
  readonly outputs: readonly LegoPort[];
  readonly configInputs?: readonly LegoConfigInput[];
  readonly runtime: ProductNodeRuntime;
}

type ProductNodeDefinition = Omit<ProductNodeType, "kind">;
type EffectfulRuntime<Runtime extends ProductNodeRuntime> = Runtime & {
  readonly effects: readonly [string, ...string[]];
};
type EffectFreeRuntime<Runtime extends ProductNodeRuntime> = Runtime & {
  readonly effects: readonly [];
};

/** Owns external IO, a resource, persistence or platform lifecycle. */
export function service<const T extends ProductNodeDefinition>(
  spec: T & { readonly runtime: EffectfulRuntime<T["runtime"]> },
): T & { readonly kind: "service" } {
  return validateProductNodeType({ ...spec, kind: "service" }) as T & { readonly kind: "service" };
}

/** Effect-free domain computation. It may retain deterministic stream state. */
export function derive<const T extends ProductNodeDefinition>(
  spec: T & { readonly runtime: EffectFreeRuntime<T["runtime"]> },
): T & { readonly kind: "derive" } {
  return validateProductNodeType({ ...spec, kind: "derive" }) as T & { readonly kind: "derive" };
}

/** Final effect-free immutable model feeding one or more components. */
export function present<const T extends ProductNodeDefinition>(
  spec: T & { readonly runtime: EffectFreeRuntime<T["runtime"]> },
): T & { readonly kind: "present" } {
  return validateProductNodeType({ ...spec, kind: "present" }) as T & { readonly kind: "present" };
}

/** Compiler-side validation for already-authored node types. */
export function validateProductNodeType<const T extends ProductNodeType>(spec: T): T {
  requireWireId(spec.id, "ProductNodeType");
  const uiEventOutputs = spec.outputs.filter(({ contract }) => contract.boundary === "ui-event");
  if (uiEventOutputs.length > 0) {
    throw new Error(
      `${spec.kind} '${spec.id}' cannot originate ui-event output '${uiEventOutputs.map(({ id }) => id).join("', '")}'`,
    );
  }
  validatePorts(spec.inputs, `${spec.id} input`);
  validatePorts(spec.outputs, `${spec.id} output`);
  validateConfigInputs(spec.configInputs ?? [], spec.id);
  requireUnique(spec.runtime.contextInputs, `${spec.id} context input`);
  requireUnique(spec.runtime.effects, `${spec.id} effect`);
  spec.runtime.contextInputs.forEach((id) => requireWireId(id, `${spec.id} context input`));
  spec.runtime.effects.forEach((id) => requireWireId(id, `${spec.id} effect`));
  if (spec.kind === "service" && spec.runtime.effects.length === 0) {
    throw new Error(`service '${spec.id}' must declare at least one runtime effect`);
  }
  if (spec.kind !== "service" && spec.runtime.effects.length !== 0) {
    throw new Error(`${spec.kind} '${spec.id}' cannot declare runtime effects`);
  }
  if (spec.kind !== "service") {
    const contextInputs = spec.inputs.filter(({ purpose }) => purpose === "context");
    if (contextInputs.length > 0) {
      throw new Error(
        `${spec.kind} '${spec.id}' cannot consume context input '${contextInputs.map(({ id }) => id).join("', '")}'; ` +
        "context may tune a service but cannot become derived or presented truth",
      );
    }
  }
  if (spec.kind === "present") {
    if (spec.outputs.length === 0) throw new Error(`present '${spec.id}' has no presentation output`);
    const invalid = spec.outputs.filter(({ contract }) =>
      contract.boundary !== "presentation" || contract.kind === "event");
    if (invalid.length > 0) {
      throw new Error(`present '${spec.id}' output '${invalid.map(({ id }) => id).join("', '")}' must use a presentation contract`);
    }
  }
  if (spec.runtime.durability === "durable" && spec.runtime.stateOwner === "none") {
    throw new Error(`ProductNodeType '${spec.id}' cannot make unowned state durable`);
  }
  return spec;
}

export function validateNodeConfig(
  instanceId: string,
  spec: ProductNodeType,
  configBindings: Readonly<Record<string, string>>,
  configs: ReadonlyMap<string, LegoConfigRef>,
): ReadonlySet<string> {
  const used = new Set<string>();
  const inputs = new Map((spec.configInputs ?? []).map((input) => [input.id, input]));
  for (const [name, id] of Object.entries(configBindings)) {
    requireIdentifier(name, `config key in '${instanceId}'`);
    const input = inputs.get(name);
    if (input === undefined) throw new Error(`node '${instanceId}' uses undeclared config input '${name}'`);
    const config = configs.get(id);
    if (config === undefined) throw new Error(`node '${instanceId}' uses unknown config '${id}'`);
    validateConfigValues(instanceId, input, config);
    used.add(id);
  }
  for (const input of inputs.values()) {
    if (!(input.id in configBindings)) throw new Error(`node '${instanceId}' is missing config input '${input.id}'`);
  }
  return used;
}

export function validateConfigCatalog(configs: readonly LegoConfigRef[]): ReadonlyMap<string, LegoConfigRef> {
  requireUnique(configs.map(({ id }) => id), "config");
  const result = new Map<string, LegoConfigRef>();
  for (const config of configs) {
    requireWireId(config.id, "config");
    for (const name of Object.keys(config.values ?? {})) requireIdentifier(name, `field in config '${config.id}'`);
    result.set(config.id, config);
  }
  return result;
}

export function contractFingerprint(contract: LegoContract): string {
  return JSON.stringify({
    kind: contract.kind,
    boundary: contract.boundary,
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
    navigation: contract.navigation ?? null,
  });
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

export function validateContract(contract: LegoContract): void {
  requireWireId(contract.id, "contract");
  if (!["presentation", "ui-event", "service-internal"].includes(contract.boundary)) {
    throw new Error(`contract '${contract.id}' has invalid boundary '${String(contract.boundary)}'`);
  }
  if (contract.fields.length === 0 && contract.kind !== "event") {
    throw new Error(`contract '${contract.id}' has no fields`);
  }
  requireUnique(contract.fields.map(({ name }) => name), `field in '${contract.id}'`);
  for (const item of contract.fields) {
    requireIdentifier(item.name, `field in '${contract.id}'`);
    if (typeof item.value !== "string") requireWireId(item.value.ref, `value ref in '${contract.id}'`);
    if (item.unit !== undefined) requireWireId(item.unit, `unit in '${contract.id}'`);
  }
  if (contract.navigation?.kind === "route") {
    if (contract.kind !== "event" || contract.boundary !== "ui-event") {
      throw new Error(`navigation route contract '${contract.id}' must be a ui-event`);
    }
    const target = contract.fields.filter(({ name }) => name === "target");
    if (target.length !== 1 || typeof target[0]!.value === "string"
      || !("finite" in target[0]!.value) || target[0]!.value.finite !== true) {
      throw new Error(`navigation route contract '${contract.id}' must carry one finite 'target' field`);
    }
  } else if (contract.navigation?.kind === "guard"
    && (contract.kind !== "state" || contract.boundary !== "service-internal")) {
    throw new Error(`navigation guard contract '${contract.id}' must be service-internal state`);
  } else if (contract.navigation?.kind === "active-page"
    && (contract.kind !== "state" || contract.boundary !== "presentation")) {
    throw new Error(`navigation active-page contract '${contract.id}' must be presentation state`);
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

export function registerContract(target: Map<string, LegoContract>, contract: LegoContract): void {
  const existing = target.get(contract.id);
  if (existing !== undefined && contractFingerprint(existing) !== contractFingerprint(contract)) {
    throw new Error(`contract '${contract.id}' has conflicting schemas`);
  }
  if (existing === undefined) target.set(contract.id, contract);
}

export function requireIdentifier(value: string, owner: string): void {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(value)) throw new Error(`${owner} has invalid identifier '${value}'`);
}

export function requireWireId(value: string, owner: string): void {
  if (!/^[a-z][a-z0-9.-]*$/u.test(value)) throw new Error(`${owner} has invalid wire id '${value}'`);
}

export function requireUnique(values: readonly string[], owner: string): void {
  if (new Set(values).size !== values.length) throw new Error(`duplicate ${owner}`);
}
