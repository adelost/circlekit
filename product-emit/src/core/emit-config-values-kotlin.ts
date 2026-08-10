import { kotlinIdentifier, kotlinStringLiteral } from "./kotlin-syntax.js";
import type {
  LegoConfigField,
  LegoConfigInput,
  LegoConfigRef,
  ProductIr,
} from "@v1d/product-spec";
import type { KotlinEmissionOptions } from "./emission-options.js";

/**
 * One generic projection from ProductSpec `config.values` to typed native
 * constants. The declared LegoConfigInput schema is the whole contract: field
 * order, name and primitive come from the declaration, never from the order
 * the product happened to write its values in.
 *
 * This emitter deliberately knows NOTHING about the native class graph. It
 * emits flat typed constants; assembling them into whatever nested runtime
 * config a platform wants is the hand-written binding layer's job. A generator
 * that models native constructors is how per-domain special emitters get
 * born, and they drift the moment the native side is refactored.
 */
export interface ConfigProjection {
  readonly input: LegoConfigInput;
  readonly config: LegoConfigRef;
}

/**
 * Derive every projectable config from the product graph. A config is
 * projectable when the node type that consumes it declares fields for it;
 * the pairing comes from `node.config`, so no emitter names a config id.
 *
 * An id-only config declares no fields and carries no values: it selects a
 * native implementation rather than describing one, so there is nothing to
 * project. The shared package has already rejected any mismatch between the
 * two by the time this runs.
 */
export function projectConfigValues(
  product: Pick<ProductIr, "configs" | "nodeTypes" | "nodes">,
): readonly ConfigProjection[] {
  const projections = new Map<string, ConfigProjection>();
  const configs = new Map(product.configs.map((config) => [config.id, config]));
  const nodeTypes = new Map(product.nodeTypes.map((node) => [node.id, node]));
  for (const node of product.nodes) {
    const type = nodeTypes.get(node.nodeTypeRef);
    if (type === undefined) throw new Error(`node '${node.id}' uses missing type '${node.nodeTypeRef}'`);
    const inputs = new Map((type.configInputs ?? []).map((input) => [input.id, input]));
    for (const [inputName, configId] of Object.entries(node.config)) {
      const input = inputs.get(inputName);
      if (input === undefined) throw new Error(`node '${node.id}' uses undeclared config input '${inputName}'`);
      const config = configs.get(configId);
      if (config === undefined) throw new Error(`node '${node.id}' uses missing config '${configId}'`);
      if (input.fields.length === 0) continue;
      projections.set(config.id, { input, config });
    }
  }
  return [...projections.values()];
}

export function emitConfigValuesKotlin(
  projections: readonly ConfigProjection[],
  options: KotlinEmissionOptions,
): string {
  if (projections.length === 0) throw new Error("config value projection has no configs");
  const ordered = [...projections].sort((a, b) => a.config.id.localeCompare(b.config.id));
  return `// GENERATED FILE. DO NOT EDIT.
// GENERATED FROM ProductSpec config values
// Product declaration SHA-256: ${options.sourceSha}
package ${options.packageName}

/** Portable ProductSpec config values. Native structure is assembled by the
 *  hand-written binding layer, never here. */
internal object Generated${options.symbolPrefix}ConfigValues {
${ordered.map(emitConfigObject).join("\n\n")}
}
`;
}

function emitConfigObject({ input, config }: ConfigProjection): string {
  return `    /** ${config.id} */
    object ${kotlinIdentifier(config.id)} {
${input.fields.map((field) => emitConstant(field, config)).join("\n")}
    }`;
}

function emitConstant(field: LegoConfigField, config: LegoConfigRef): string {
  // Every declared field carries a value of its declared type, proven by
  // ProductSpec graph compilation before native emission.
  const value = config.values![field.name]!;
  const unit = field.unit === undefined ? "" : ` // ${field.unit}`;
  return `        const val ${field.name}: ${kotlinType(field.value)} = ${literal(field, value)}${unit}`;
}

function kotlinType(primitive: LegoConfigField["value"]): string {
  switch (primitive) {
    case "boolean": return "Boolean";
    case "integer": return "Long";
    case "number": return "Float";
    case "string": return "String";
  }
}

/** The declared primitive decides the Kotlin literal. Which primitive a value
 *  actually is was settled upstream, so this only has to spell it. */
function literal(field: LegoConfigField, value: boolean | number | string): string {
  switch (field.value) {
    case "boolean": return `${value}`;
    case "string": return kotlinStringLiteral(value as string);
    case "integer": return `${value}L`;
    case "number": return `${value}f`;
  }
}
