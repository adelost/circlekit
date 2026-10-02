import assert from "node:assert/strict";
import test from "node:test";
import {
  emitActionHandlersKotlin,
  emitContractTypesKotlin,
  kotlinEnumToken,
  projectActionModel,
  type ActionHandlersKotlinOptions,
  type ActionModelOptions,
} from "../src/core/index.js";
import { field, port, type LegoContract } from "@v1d/product-spec";
import {
  acmeActionOptions, acmeForwardedPick, acmeParts, acmePickType, acmeRename, acmeReset, compileAcme, noParts, serviceNode, serviceType,
  withFeed, type AcmeParts,
} from "./action-acme.js";
import { compileKotlin, kotlinCompilerSkip } from "./kotlin-toolchain.js";

const acme = compileAcme();
const emission = { packageName: "dev.acme.actions", sourceFile: "test/action-acme.ts", sourceSha: "fixture" };
const direct: ActionHandlersKotlinOptions = { ...acmeActionOptions, ...emission, visibility: "public", transport: { kind: "direct" } };
const ported: ActionHandlersKotlinOptions = { ...acmeActionOptions, ...emission, visibility: "internal",
  transport: { kind: "port-runtime", runtimeType: "AcmePortRuntime", portsObject: "AcmePorts", scopeType: "AcmeScope" } };
const text = (options: ActionHandlersKotlinOptions, parts?: AcmeParts) =>
  emitActionHandlersKotlin(parts === undefined ? acme : compileAcme(parts), options).map(({ content }) => content).join("\n");
const refusal = (parts: AcmeParts, options: Partial<ActionModelOptions>) => () =>
  projectActionModel(compileAcme(parts), { ...acmeActionOptions, ...options });
const lines = (pattern: RegExp, source: string) => new Set([...source.matchAll(pattern)].map((match) => match[1]!));

test("each action input lands in its node's group, or for a sink in the group of the owner that feeds it, relays included", () => {
  const model = projectActionModel(acme, acmeActionOptions);
  assert.deepEqual(new Map(model.groups.map(({ typeName, members }) => [typeName, new Set(members.map(({ method }) => method))])), new Map([
    ["GeneratedAcmeAcmeCounterInputs", new Set(["reset", "rename"])],
    ["GeneratedAcmeAcmePanelActions", new Set(["pick"])],
    ["GeneratedAcmeAcmeStateActions", new Set(["forwardedPick"])],
  ]));
});

test("a port's type is its types entry, else Unit for no fields, else the contract's data class for primitive fields", () => {
  const model = projectActionModel(acme, acmeActionOptions);
  const types = new Map(model.groups.flatMap(({ members }) => members.map(({ inputRef, type }) => [inputRef, type])));
  assert.deepEqual(types.get("acme.counter.reset"), { value: "Unit", result: "Unit" });
  assert.deepEqual(types.get("acme.counter.rename"), { value: "GeneratedAcmeRename", result: "Unit" });
  assert.deepEqual(types.get("acme.surface.pick"), acmePickType);
});

test("the model lists each contract whose type it derived as a data class, and none it was given", () => {
  assert.deepEqual(new Set(projectActionModel(acme, acmeActionOptions).derivedContracts.map(({ id }) => id)), new Set(["acme.rename"]));
  const typed = { ...acmeActionOptions.types, "acme.panel.rename": { value: "Rename", result: "Unit" }, "acme.counter.rename": { value: "Rename", result: "Unit" } };
  assert.deepEqual(projectActionModel(acme, { ...acmeActionOptions, types: typed }).derivedContracts, []);
});

test("each component instance gets one events facade, one method per bound output, naming the group that handles it", () => {
  const model = projectActionModel(acme, acmeActionOptions);
  assert.deepEqual(new Map(model.components.map(({ typeName, members }) =>
    [typeName, new Set(members.map(({ method, groupTypeName }) => `${method} -> ${groupTypeName}`))])), new Map([
    ["GeneratedAcmeAcmePanelEvents", new Set(["reset -> GeneratedAcmeAcmeCounterInputs",
      "rename -> GeneratedAcmeAcmeCounterInputs", "pick -> GeneratedAcmeAcmePanelActions"])],
  ]));
});

/** `acme.state.forwardedPick` also feeds a second sink input, `statePick2`: one output, two inputs in one group. */
const twinRelay: AcmeParts = { ...acmeParts,
  nodeTypes: acmeParts.nodeTypes.map((type) => type.id !== "acme.surface" ? type
    : serviceType("acme.surface", [...type.inputs, port("statePick2", acmeForwardedPick)])),
  nodes: acmeParts.nodes.map((node) => node.id !== "acme.surface" ? node
    : serviceNode("acme.surface", { ...node.bindings, statePick2: "acme.state.forwardedPick" })) };
const objectMembers = ["hashCode", "notify", "notifyAll", "toString", "wait"] as const;

const refusals: readonly (readonly [string, () => unknown, readonly string[]])[] = [
  ["a port with neither a types entry nor primitive fields", refusal(acmeParts, { types: { "acme.surface.statePick": acmePickType } }), [
    "action port 'acme.panel.pick' (contract 'acme.pick') has no Kotlin type: pass it in types, or declare its fields primitive",
    "action port 'acme.surface.pick' (contract 'acme.pick') has no Kotlin type: pass it in types, or declare its fields primitive",
  ]],
  ["an event typed apart from its input", refusal(acmeParts, { types: { ...acmeActionOptions.types,
    "acme.surface.pick": { value: "AcmePick", result: "Unit" } } }), [
    "component event 'acme.panel.pick' carries AcmePick -> Boolean but its input 'acme.surface.pick' takes AcmePick -> Unit; give both one type",
  ]],
  ["a sink that is no compiled node with inputs", refusal(acmeParts, { sinks: ["acme.surface", "acme.nowhere", "acme.panel"] }), [
    "sink 'acme.nowhere' is not a compiled node with inputs",
    "sink 'acme.panel' is not a compiled node with inputs",
  ]],
  ["a forwarded input a component feeds", refusal(acmeParts, { forwardedInputs: ["acme.surface.statePick", "acme.counter.reset"] }), [
    "forwarded input 'acme.counter.reset' is not an event input fed by a node output",
  ]],
  ["a method named by a Kotlin keyword", refusal(withFeed(acmeParts, "acme.knob", "acme.dial", [["object", "object", acmeReset]]), {}), [
    "action method 'object' is a Kotlin keyword; rename port 'acme.dial.object'",
    "action method 'object' is a Kotlin keyword; rename port 'acme.knob.object'",
  ]],
  ["two owners with one Kotlin name", refusal(withFeed(acmeParts, "acme.knob", "acme-counter", [["nudge", "nudge", acmeReset]]), {}), [
    "two action types are named 'GeneratedAcmeAcmeCounterInputs': event inputs of 'acme-counter', event inputs of 'acme.counter'",
  ]],
  ["a types entry no action reads", refusal(acmeParts, { types: { ...acmeActionOptions.types, "acme.counter.missing": acmePickType } }), [
    "types names 'acme.counter.missing', which no action binds; delete it",
  ]],
  ["one output feeding two inputs of one group", refusal(twinRelay, { forwardedInputs: ["acme.surface.statePick", "acme.surface.statePick2"],
    types: { ...acmeActionOptions.types, "acme.surface.statePick2": acmePickType } }), [
    "action method 'forwardedPick' of 'GeneratedAcmeAcmeStateActions' would handle both 'acme.surface.statePick' and 'acme.surface.statePick2'; feed each from its own output",
  ]],
  ["a method named by a member of every Kotlin object",
    refusal(withFeed(acmeParts, "acme.knob", "acme.dial", objectMembers.map((name) => [name, name, acmeReset] as const)), {}),
    objectMembers.flatMap((name) => ["acme.dial", "acme.knob"].map((owner) =>
      `action method '${name}' is a member of every Kotlin object; rename port '${owner}.${name}'`))],
  ["a method named by underscores only", refusal(withFeed(acmeParts, "acme.knob", "acme.dial", [["__", "__", acmeReset]]), {}), [
    "action method '__' is reserved in Kotlin; rename port 'acme.dial.__'",
    "action method '__' is reserved in Kotlin; rename port 'acme.knob.__'",
  ]],
];

for (const [name, project, messages] of refusals) {
  test(`refused by name: ${name}`, () => {
    assert.throws(project, (error: unknown) => {
      assert.ok(error instanceof Error);
      const listed = new Set(error.message.split("\n").slice(1).map((line) => line.trim()));
      assert.deepEqual(listed, new Set(messages));
      return true;
    });
  });
}

test("every refusal is collected and thrown once, counted", () => {
  assert.throws(refusal(acmeParts, { sinks: ["acme.surface", "acme.nowhere"], forwardedInputs: ["acme.counter.reset"] }), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.equal(error.message.split("\n")[0], "action handlers refused (3):");
    assert.equal(error.message.split("\n").length, 4);
    return true;
  });
});

test("a one-method group is a fun interface; the binder binds each member's input to its method", () => {
  const kotlin = text(ported);
  assert.match(kotlin, /^internal fun interface GeneratedAcmeAcmePanelActions \{$/mu);
  assert.match(kotlin, /^internal interface GeneratedAcmeAcmeCounterInputs \{$/mu);
  assert.deepEqual(lines(/^ {4}(bindInput\(.*\) \{ handlers\..*\) \},)$/gmu, kotlin), new Set([
    "bindInput(AcmePorts.ACME_COUNTER_RESET, scope) { handlers.reset() },",
    "bindInput(AcmePorts.ACME_COUNTER_RENAME, scope) { handlers.rename(it) },",
    "bindInput(AcmePorts.ACME_SURFACE_PICK, scope) { handlers.pick(it) },",
    "bindInput(AcmePorts.ACME_SURFACE_STATEPICK, scope) { handlers.forwardedPick(it) },",
  ]));
  assert.deepEqual(lines(/^ {4}(override fun .*)$/gmu, kotlin), new Set([
    "override fun pick(event: AcmePick): Boolean = pickPort.emit(event)",
    "override fun rename(event: GeneratedAcmeRename) = renamePort.emit(event)",
    "override fun reset() = resetPort.emit(Unit)",
  ]));
});

test("DirectEvents takes one parameter per target group and calls the method of the input each output feeds", () => {
  const kotlin = text(direct);
  assert.deepEqual(lines(/^ {4}private val (.*),$/gmu, kotlin),
    new Set(["acmeCounter: GeneratedAcmeAcmeCounterInputs", "acmePanel: GeneratedAcmeAcmePanelActions"]));
  assert.deepEqual(lines(/^ {4}(override fun .*)$/gmu, kotlin), new Set([
    "override fun pick(event: AcmePick): Boolean = acmePanel.pick(event)",
    "override fun rename(event: GeneratedAcmeRename) = acmeCounter.rename(event)",
    "override fun reset() = acmeCounter.reset()",
  ]));
  assert.doesNotMatch(kotlin, /internal|bindInput/u);
  const renamed = text(direct, withFeed(acmeParts, "acme.knob", "acme.dial", [["nudge", "step", acmeReset]]));
  assert.ok(renamed.includes("    override fun nudge() = acmeDial.step()\n"));
});

test("the index names each input's handler method and each output's facade method", () => {
  assert.deepEqual(lines(/^ {4}"(.*)",$/gmu, text(ported)), new Set([
    'acme.counter.rename" to "GeneratedAcmeAcmeCounterInputs.rename',
    'acme.counter.reset" to "GeneratedAcmeAcmeCounterInputs.reset',
    'acme.surface.pick" to "GeneratedAcmeAcmePanelActions.pick',
    'acme.surface.statePick" to "GeneratedAcmeAcmeStateActions.forwardedPick',
    'acme.panel.pick" to "GeneratedAcmeAcmePanelEvents.pick',
    'acme.panel.rename" to "GeneratedAcmeAcmePanelEvents.rename',
    'acme.panel.reset" to "GeneratedAcmeAcmePanelEvents.reset',
  ]));
});

test("DirectEvents refuses a handler parameter it cannot name: a Kotlin keyword, the event parameter, or two owners with one name", () => {
  const keyword = withFeed(acmeParts, "acme.knob", "in", [["nudge", "nudge", acmeReset]]);
  assert.throws(() => text(direct, keyword),
    /direct events of 'acme\.knob' cannot name a handler parameter 'in' \(a Kotlin keyword, the event parameter, or two owners of that name\); rename an owner/u);
  assert.throws(() => text(direct, withFeed(acmeParts, "acme.knob", "event", [["nudge", "nudge", acmeRename]])),
    /direct events of 'acme\.knob' cannot name a handler parameter 'event'/u);
  assert.ok(text(ported, keyword).includes("bindInput(AcmePorts.IN_NUDGE, scope) { handlers.nudge() },"));
  const knob = withFeed(acmeParts, "acme.knob", "acme-knob", [["nudge", "nudge", acmeReset], ["poke", "poke", acmeReset]]);
  const twoOwners: AcmeParts = { ...knob,
    nodeTypes: [...knob.nodeTypes.filter(({ id }) => id !== "acme-knob"), serviceType("acme-knob", [port("nudge", acmeReset)]),
      serviceType("acme.bus", [port("poke", acmeReset)])],
    nodes: [...knob.nodes.filter(({ id }) => id !== "acme-knob"), serviceNode("acme-knob", { nudge: "acme.knob.nudge" }),
      serviceNode("acme.bus", { poke: "acme.knob.poke" })],
    components: knob.components.map((component) => component.id !== "acme.knob" ? component
      : { ...component, bindings: { inputs: {}, events: { nudge: "acme-knob.nudge", poke: "acme.bus.poke" } } }) };
  assert.throws(() => text({ ...direct, sinks: ["acme.surface", "acme.bus"] }, twoOwners),
    /direct events of 'acme\.knob' cannot name a handler parameter 'acmeKnob'/u);
});

/** `count` components with ten outputs each, every one feeding its own service's input. */
function wideProduct(count: number, width: number): AcmeParts {
  return Array.from({ length: count }, (_, index) => index).reduce((parts, index) => withFeed(parts, `acme.panel${index}`, `acme.service${index}`,
    Array.from({ length: width }, (_, port) => [`out${port}`, `in${port}`, port % 2 === 0 ? acmeReset : acmeRename] as const)), noParts);
}

const wide: ActionHandlersKotlinOptions = { ...ported, sinks: [], forwardedInputs: [], types: {} };

test("600 actions shard into files under 500 lines that together bind exactly the model's inputs and outputs", () => {
  const parts = wideProduct(60, 10);
  const files = emitActionHandlersKotlin(compileAcme(parts), wide);
  const model = projectActionModel(compileAcme(parts), { symbolPrefix: "Acme" });
  assert.ok(files.length > 1);
  assert.deepEqual(new Set(files.map(({ name }) => name)), new Set(files.map((_, index) => `GeneratedAcmeActions${index}`)));
  for (const { name, content } of files) assert.ok(content.trimEnd().split("\n").length < 500, `${name} is 500 lines or more`);
  const all = files.map(({ content }) => content).join("\n");
  const inputs = model.groups.flatMap(({ members }) => members.map(({ inputRef, method }) => `${kotlinEnumToken(inputRef)} ${method}`));
  const outputs = model.components.flatMap(({ members }) => members.map(({ outputRef }) => kotlinEnumToken(outputRef)));
  assert.equal(new Set(inputs).size, 600);
  assert.deepEqual(new Set([...all.matchAll(/bindInput\(AcmePorts\.(\w+), scope\) \{ handlers\.(\w+)\(/gu)].map(([, token, method]) => `${token} ${method}`)),
    new Set(inputs));
  assert.deepEqual(lines(/componentEvent\(AcmePorts\.(\w+), scope\)/gu, all), new Set(outputs));
  for (const { typeName } of [...model.groups, ...model.components]) {
    assert.equal(all.split(`interface ${typeName} {`).length, 2, `${typeName} is declared once`);
  }
});

test("a group or facade too large for one file is refused by name", () => {
  assert.throws(() => text(wide, wideProduct(1, 300)), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.match(error.message, /^ {2}action group 'acme\.service0' alone is \d+ lines; split the node$/mu);
    assert.match(error.message, /^ {2}component events 'acme\.panel0' alone is \d+ lines; split the component$/mu);
    return true;
  });
});

/** A payload whose field is a Kotlin keyword: its derived class must still compile. */
const acmeToggle: LegoContract = { id: "acme.toggle", kind: "event", boundary: "ui-event", fields: [field("in", "boolean")] };
const contractTypes = (packageName: string) =>
  emitContractTypesKotlin([acmeRename, acmeToggle], { ...emission, symbolPrefix: "Acme", packageName });

/** A product's native owner for `acme.counter`, in the direct package; `reset` can be left out to prove the law. */
const directOwner = (withReset: boolean) => `package dev.acme.direct

class AcmePick(val choice: String)

class AcmeCounter(private val calls: MutableList<String>) : GeneratedAcmeAcmeCounterInputs {
${withReset ? "    override fun reset() { calls += \"reset\" }\n" : ""}    override fun rename(event: GeneratedAcmeRename) { calls += "rename \${event.name}" }
}

fun directCalls(): List<String> {
    val calls = mutableListOf<String>()
    val events: GeneratedAcmeAcmePanelEvents = GeneratedAcmeAcmePanelDirectEvents(
        acmeCounter = AcmeCounter(calls),
        acmePanel = GeneratedAcmeAcmePanelActions { event -> calls += "pick \${event.choice}"; true },
    )
    events.reset()
    events.rename(GeneratedAcmeRename(name = "ada"))
    check(events.pick(AcmePick("LEFT")))
    check(GeneratedAcmeToggle(\`in\` = true).\`in\`)
    return calls
}
`;

/** A port runtime with Skyvw's signatures: an output delivers to the sink bound on the input it feeds. */
const portRuntime = `package dev.acme.ports

class AcmePick(val choice: String)
class AcmeScope
abstract class AcmeInputPort<T : Any, R : Any>(val ref: String)
abstract class AcmeComponentEvent<T : Any, R : Any>(val ref: String)

class AcmePortRuntime(private val edges: Map<String, String>) {
    private val sinks = mutableMapOf<String, (Any) -> Any>()
    fun <T : Any, R : Any> bindInput(port: AcmeInputPort<T, R>, scope: AcmeScope, sink: (T) -> R): AutoCloseable {
        sinks[port.ref] = { value -> @Suppress("UNCHECKED_CAST") sink(value as T) }
        return AutoCloseable { sinks.remove(port.ref) }
    }
    fun <T : Any, R : Any> componentEvent(port: AcmeComponentEvent<T, R>, scope: AcmeScope) = Emitter<T, R>(this, port.ref)
    @Suppress("UNCHECKED_CAST")
    fun <R> deliver(output: String, value: Any): R = sinks.getValue(edges.getValue(output))(value) as R
    class Emitter<T : Any, R : Any>(private val runtime: AcmePortRuntime, private val output: String) {
        fun emit(event: T): R = runtime.deliver(output, event)
    }
}

object AcmePorts {
    object ACME_COUNTER_RESET : AcmeInputPort<Unit, Unit>("acme.counter.reset")
    object ACME_COUNTER_RENAME : AcmeInputPort<GeneratedAcmeRename, Unit>("acme.counter.rename")
    object ACME_SURFACE_PICK : AcmeInputPort<AcmePick, Boolean>("acme.surface.pick")
    object ACME_SURFACE_STATEPICK : AcmeInputPort<AcmePick, Boolean>("acme.surface.statePick")
    object ACME_PANEL_RESET : AcmeComponentEvent<Unit, Unit>("acme.panel.reset")
    object ACME_PANEL_RENAME : AcmeComponentEvent<GeneratedAcmeRename, Unit>("acme.panel.rename")
    object ACME_PANEL_PICK : AcmeComponentEvent<AcmePick, Boolean>("acme.panel.pick")
}

fun portCalls(): List<String> {
    val calls = mutableListOf<String>()
    val scope = AcmeScope()
    val runtime = AcmePortRuntime(mapOf("acme.panel.reset" to "acme.counter.reset",
        "acme.panel.rename" to "acme.counter.rename", "acme.panel.pick" to "acme.surface.pick"))
    runtime.bindActions(scope, object : GeneratedAcmeAcmeCounterInputs {
        override fun reset() { calls += "reset" }
        override fun rename(event: GeneratedAcmeRename) { calls += "rename \${event.name}" }
    })
    runtime.bindActions(scope, GeneratedAcmeAcmePanelActions { event -> calls += "pick \${event.choice}"; true })
    runtime.bindActions(scope, GeneratedAcmeAcmeStateActions { false })
    val events: GeneratedAcmeAcmePanelEvents = GeneratedAcmeAcmePanelPortEvents(runtime, scope)
    events.reset()
    events.rename(GeneratedAcmeRename(name = "ada"))
    check(events.pick(AcmePick("LEFT")))
    return calls
}
`;

const emitted = (options: ActionHandlersKotlinOptions, packageName: string) => Object.fromEntries(
  emitActionHandlersKotlin(acme, { ...options, packageName }).map(({ name, content }) => [`${packageName}.${name}.kt`, content]));

test("kotlinc compiles both transports with native owners, and each output reaches the handler of its input", kotlinCompilerSkip, () => {
  const verdict = compileKotlin({
    ...emitted(direct, "dev.acme.direct"), "direct-types.kt": contractTypes("dev.acme.direct"), "direct-owner.kt": directOwner(true),
    ...emitted(ported, "dev.acme.ports"), "ports-types.kt": contractTypes("dev.acme.ports"), "ports-runtime.kt": portRuntime,
    "main.kt": `fun main() {\n    println(dev.acme.direct.directCalls().joinToString(";"))\n    println(dev.acme.ports.portCalls().joinToString(";"))\n}\n`,
  }, "MainKt");
  assert.ok(verdict.compiled, verdict.compiled ? "" : verdict.diagnostics);
  assert.equal(verdict.stdout, "reset;rename ada;pick LEFT\nreset;rename ada;pick LEFT\n");
});

test("kotlinc refuses a native owner that leaves out one declared action", kotlinCompilerSkip, () => {
  const verdict = compileKotlin({ ...emitted(direct, "dev.acme.direct"), "direct-types.kt": contractTypes("dev.acme.direct"),
    "direct-owner.kt": directOwner(false) });
  assert.equal(verdict.compiled, false);
  if (verdict.compiled) return;
  assert.match(verdict.diagnostics, /does not implement abstract member/u);
  assert.match(verdict.diagnostics, /reset/u);
});
