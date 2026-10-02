import type { ProductIr } from "@v1d/product-spec";
import {
  eventsImplementationName,
  projectActionModel,
  type ActionGroup,
  type ActionKotlinType,
  type ActionModel,
  type ActionModelOptions,
  type ComponentEventsModel,
} from "./action-handler-model.js";
import type { SourcedKotlinEmissionOptions } from "./emission-options.js";
import { KOTLIN_HARD_KEYWORDS, kotlinEnumToken, kotlinPropertyName, kotlinStringLiteral } from "./kotlin-syntax.js";

/**
 * How an emitted event reaches its handler. `port-runtime`: through the product's port runtime, which offers
 * `bindInput(port, scope, sink)` and `componentEvent(port, scope).emit(value)` over one token per port ref in
 * `portsObject`, named `kotlinEnumToken(ref)`. `direct`: the facade calls the handler interfaces it is built with.
 */
export type ActionTransport =
  | {
    readonly kind: "port-runtime";
    readonly runtimeType: string;
    readonly portsObject: string;
    /** Default `kotlinx.coroutines.CoroutineScope`. */
    readonly scopeType?: string;
  }
  | { readonly kind: "direct" };

export interface ActionHandlersKotlinOptions extends SourcedKotlinEmissionOptions, ActionModelOptions {
  readonly transport: ActionTransport;
  readonly visibility: "internal" | "public";
}

/** One emitted file, `Generated<P>Actions<N>`; write every one, the boundaries are not API. */
export interface ActionHandlersKotlinFile {
  readonly name: string;
  readonly content: string;
}

/** A generated file stays below 500 lines; the index maps are cut so one always fits a file with its header. */
const MAX_FILE_LINES = 499;
const INDEX_ENTRIES_PER_MAP = 400;

interface Block {
  readonly label: string;
  readonly fix: string;
  readonly text: string;
}

interface Context {
  readonly symbolPrefix: string;
  readonly visibility: string;
  readonly transport: ActionTransport;
}

/**
 * One handler interface per action group (a `fun interface` when it has one method) and one events facade per
 * component instance, with the transport's binder and facade implementation, plus `Generated<P>ActionIndex`.
 * Types are written as given, so the product passes them fully qualified unless they share `packageName`.
 */
export function emitActionHandlersKotlin(
  ir: Pick<ProductIr, "portRegistry">,
  options: ActionHandlersKotlinOptions,
): readonly ActionHandlersKotlinFile[] {
  const model = projectActionModel(ir, options);
  const context: Context = {
    symbolPrefix: options.symbolPrefix,
    visibility: options.visibility === "internal" ? "internal " : "",
    transport: options.transport,
  };
  return shard(`Generated${options.symbolPrefix}Actions`, header(options), [
    ...model.groups.map((group) => ({ label: `action group '${group.ownerId}'`, fix: "split the node", text: groupBlock(group, context) })),
    ...model.components.map((component) =>
      ({ label: `component events '${component.componentId}'`, fix: "split the component", text: componentBlock(component, model, context) })),
    ...indexBlocks(model, context),
  ]);
}

function groupBlock(group: ActionGroup, context: Context): string {
  const declaration = `/** ${groupSummary(group)}: one method per declared action. */
${context.visibility}${group.members.length === 1 ? "fun " : ""}interface ${group.typeName} {
${group.members.map(({ method, type }) => `    fun ${method}(${parameter(type)})${returns(type)}`).join("\n")}
}`;
  if (context.transport.kind !== "port-runtime") return declaration;
  const { runtimeType, portsObject } = context.transport;
  return `${declaration}

${context.visibility}fun ${runtimeType}.bindActions(
    scope: ${scopeType(context.transport)},
    handlers: ${group.typeName},
): List<AutoCloseable> = listOf(
${group.members.map(({ method, inputRef, type }) =>
    `    bindInput(${portsObject}.${kotlinEnumToken(inputRef)}, scope) { handlers.${method}(${type.value === "Unit" ? "" : "it"}) },`).join("\n")}
)`;
}

/** A node group names its node; a source group names the owner and the sinks it is bound to. */
function groupSummary(group: ActionGroup): string {
  if (group.kind === "node") return `The event inputs of ${code(group.ownerId)}`;
  const sinks = [...new Set(group.members.map(({ inputRef }) => ownerOf(inputRef)))].sort();
  return `${code(group.ownerId)} events bound to ${sinks.map(code).join(", ")}`;
}

function componentBlock(component: ComponentEventsModel, model: ActionModel, context: Context): string {
  return `/** What ${code(component.componentId)} can emit: one method per declared output. */
${context.visibility}interface ${component.typeName} {
${component.members.map(({ method, type }) => `    fun ${method}(${parameter(type)})${returns(type)}`).join("\n")}
}

${context.transport.kind === "port-runtime" ? portEvents(component, context.transport, context.visibility) : directEvents(component, model, context.visibility)}`;
}

function portEvents(
  component: ComponentEventsModel,
  transport: Extract<ActionTransport, { kind: "port-runtime" }>,
  visibility: string,
): string {
  return `${visibility}class ${eventsImplementationName(component, "Port")}(
    ports: ${transport.runtimeType},
    scope: ${scopeType(transport)},
) : ${component.typeName} {
${component.members.map(({ method, outputRef, type }) =>
    `    private val ${method}Port = ports.componentEvent(${transport.portsObject}.${kotlinEnumToken(outputRef)}, scope)
    override fun ${method}(${parameter(type)})${returns(type)} = ${method}Port.emit(${type.value === "Unit" ? "Unit" : "event"})`).join("\n")}
}`;
}

/** Takes one handler per target group, named by the group's owner, and calls the group method each output feeds. */
function directEvents(component: ComponentEventsModel, model: ActionModel, visibility: string): string {
  const targets = model.groups.filter(({ typeName }) => component.members.some(({ groupTypeName }) => groupTypeName === typeName));
  const parameters = new Map(targets.map((group) => [group.typeName, kotlinPropertyName(group.ownerId)] as const));
  const names = [...parameters.values()];
  const clash = names.find((name, index) => names.indexOf(name) !== index || KOTLIN_HARD_KEYWORDS.has(name) || name === "event");
  if (clash !== undefined) {
    throw new Error(`direct events of '${component.componentId}' cannot name a handler parameter '${clash}' (a Kotlin keyword, the event parameter, or two owners of that name); rename an owner`);
  }
  const groupMethod = (inputRef: string, groupTypeName: string) =>
    targets.find(({ typeName }) => typeName === groupTypeName)!.members.find((member) => member.inputRef === inputRef)!.method;
  return `${visibility}class ${eventsImplementationName(component, "Direct")}(
${targets.map(({ typeName }) => `    private val ${parameters.get(typeName)}: ${typeName},`).join("\n")}
) : ${component.typeName} {
${component.members.map(({ method, inputRef, groupTypeName, type }) =>
    `    override fun ${method}(${parameter(type)})${returns(type)} = ${parameters.get(groupTypeName)}.${groupMethod(inputRef, groupTypeName)}(${type.value === "Unit" ? "" : "event"})`).join("\n")}
}`;
}

/** Which method handles each action input and which facade method emits each output, as `Type.method`. */
function indexBlocks(model: ActionModel, context: Context): readonly Block[] {
  const prefix = `Generated${context.symbolPrefix}ActionIndex`;
  const maps = (kind: string, entries: readonly (readonly [string, string])[]) => chunks(entries).map((chunk, index) => ({
    name: `${prefix}${kind}${index}`,
    text: `${context.visibility}val ${prefix}${kind}${index}: Map<String, String> = mapOf(
${chunk.map(([ref, call]) => `    ${kotlinStringLiteral(ref)} to ${kotlinStringLiteral(call)},`).join("\n")}
)`,
  }));
  const handlers = maps("Handlers", sortedEntries(model.groups.flatMap((group) =>
    group.members.map(({ inputRef, method }) => [inputRef, `${group.typeName}.${method}`] as const))));
  const events = maps("Events", sortedEntries(model.components.flatMap((component) =>
    component.members.map(({ outputRef, method }) => [outputRef, `${component.typeName}.${method}`] as const))));
  const union = (parts: readonly { readonly name: string }[]) => parts.length === 0 ? "emptyMap()" : `buildMap {
${parts.map(({ name }) => `        putAll(${name})`).join("\n")}
    }`;
  const index = `/** Each action input's handler and each component output's facade method, as \`Type.method\`. */
${context.visibility}object ${prefix} {
    val handlerByInput: Map<String, String> = ${union(handlers)}
    val eventByOutput: Map<String, String> = ${union(events)}
}`;
  return [...handlers, ...events, { name: prefix, text: index }].map(({ name, text }) =>
    ({ label: `action index '${name}'`, fix: "split the index", text }));
}

/** Packs whole blocks into files below 500 lines, in order; a block that cannot fit one file alone is refused. */
function shard(baseName: string, fileHeader: string, blocks: readonly Block[]): readonly ActionHandlersKotlinFile[] {
  const render = (texts: readonly string[]) => `${fileHeader}\n${texts.join("\n\n")}\n`;
  const oversized = blocks.map((block) => ({ block, lines: lineCount(render([block.text])) }))
    .filter(({ lines }) => lines > MAX_FILE_LINES)
    .map(({ block, lines }) => `${block.label} alone is ${lines} lines; ${block.fix}`);
  if (oversized.length > 0) throw new Error(`action handlers refused (${oversized.length}):\n  ${oversized.sort().join("\n  ")}`);
  const files: string[][] = [];
  let pending: string[] = [];
  for (const { text } of blocks) {
    if (pending.length > 0 && lineCount(render([...pending, text])) > MAX_FILE_LINES) {
      files.push(pending);
      pending = [];
    }
    pending.push(text);
  }
  if (pending.length > 0) files.push(pending);
  return files.map((texts, index) => ({ name: `${baseName}${index}`, content: render(texts) }));
}

function header(options: SourcedKotlinEmissionOptions): string {
  return `// GENERATED FILE. DO NOT EDIT.
// GENERATED FROM ${options.sourceFile}
// Product declarations SHA-256: ${options.sourceSha}
package ${options.packageName}
`;
}

const parameter = (type: ActionKotlinType) => (type.value === "Unit" ? "" : `event: ${type.value}`);
const returns = (type: ActionKotlinType) => (type.result === "Unit" ? "" : `: ${type.result}`);
const scopeType = (transport: Extract<ActionTransport, { kind: "port-runtime" }>) =>
  transport.scopeType ?? "kotlinx.coroutines.CoroutineScope";
const ownerOf = (ref: string) => ref.slice(0, ref.lastIndexOf("."));
const code = (id: string) => `\`${id}\``;
const lineCount = (content: string) => content.trimEnd().split("\n").length;
const sortedEntries = (entries: readonly (readonly [string, string])[]) =>
  [...entries].sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));

function chunks<T>(items: readonly T[]): readonly (readonly T[])[] {
  const result: T[][] = [];
  for (let start = 0; start < items.length; start += INDEX_ENTRIES_PER_MAP) result.push(items.slice(start, start + INDEX_ENTRIES_PER_MAP));
  return result;
}
