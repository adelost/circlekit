import { defineMachine, type Machine } from "@v1d/product-spec";
import type { SourcedKotlinEmissionOptions } from "./emission-options.js";
import { kotlinStringLiteral } from "./kotlin-syntax.js";
import { emitStudioTraceSinkKotlin } from "./emit-studio-trace-kotlin.js";

/** WHAT: Names the generated machine and its optional debug trace boundary. WHY: Keeps release execution separate from test evidence. */
export interface MachineKotlinOptions extends SourcedKotlinEmissionOptions {
  /** The machine in its symbols: `RecordingSession` makes `Generated<Product>RecordingSessionMachine`. */
  readonly machineName: string;
  /** Test-run recording is opt-in at generation; the normal emitted machine remains unchanged. */
  readonly traceSink?: string;
  /** A build constant false in release, so tracing has no production execution path. */
  readonly traceBuildGuard?: string;
}

/**
 * The file `Generated<Product><Machine>Machine.kt` has its states and guards as enums, every cell as
 * data in declared order (from, the input's class name, to, requires, forbids), its rests and deadlines, and
 * `declaredNext(stage, inputName, guards)`, which answers as product-spec's `step()` does. The caller works out which guards hold, as it does for
 * `step()`; nothing here runs a predicate. A machine that breaks a law is refused before any Kotlin is written.
 * WHAT: Builds a machine as Kotlin with named states, guards and cells.
 * WHY: Keeps native transitions aligned with one validated declaration.
 */
export function emitMachineKotlin(machine: Machine, options: MachineKotlinOptions): string {
  defineMachine({ ...machine } as Parameters<typeof defineMachine>[0]);
  if (options.traceSink && !options.traceBuildGuard) throw new Error("a traced Kotlin machine needs a release-false build guard");
  const name = `Generated${options.symbolPrefix}${options.machineName}`;
  const state = `${name}State`;
  const guard = `${name}Guard`;
  const cell = `${name}Cell`;
  const strings = (values: readonly string[]) => `listOf(${values.map(kotlinStringLiteral).join(", ")})`;
  const guardSet = (guards: readonly string[]) => `setOf(${guards.map((value) => `${guard}.${value}`).join(", ")})`;
  const cells = machine.cells.map((declared) =>
    `        ${cell}(${kotlinStringLiteral(declared.id)}, ${state}.${declared.from}, ${kotlinStringLiteral(declared.on)}, `
    + `${state}.${declared.to}, ${guardSet(declared.requires)}, ${guardSet(declared.forbids)}),`).join("\n");
  const noCell = machine.otherwise === "stay"
    ? ""
    : `        check(cell != null || inputName in updates || inputName in ignored) {\n`
      + `            "machine ${machine.id} refuses $inputName in $stage: no cell matches the guards held"\n`
      + `        }\n`;
  return `// GENERATED FILE. DO NOT EDIT.
// GENERATED FROM ${options.sourceFile}
// Generator SHA-256: ${options.sourceSha}
package ${options.packageName}

/** The states of machine ${machine.id}. */
internal enum class ${state} { ${machine.states.join(", ")} }

/** The facts a cell of machine ${machine.id} may require or forbid; the caller works out which hold. */
internal enum class ${guard} { ${machine.guards.join(", ")} }

/** One declared move: from a state on an input, named by its class, to a state, under the guards it requires and forbids. */
internal data class ${cell}(
    val id: String,
    val from: ${state},
    val on: String,
    val to: ${state},
    val requires: Set<${guard}>,
    val forbids: Set<${guard}>,
)

/** Machine ${machine.id}: ordering ${machine.ordering}, otherwise ${machine.otherwise}. */
internal object ${name}Machine {
    val initial = ${state}.${machine.initial}

    val inputs: List<String> = ${strings(machine.inputs)}

    /** Inputs that only update fields and never move the state. */
    val updates: List<String> = ${strings(machine.updates.map(({ on }) => on))}

    /** Inputs the machine takes no notice of. */
    val ignored: List<String> = ${strings(machine.ignored)}

    /** States where staying forever is correct. */
    val rests: List<String> = ${strings(machine.rests)}

    /** Inputs the caller raises from a clock; law 7 gave one of them a cell out of every state that is not a rest. */
    val deadlines: List<String> = ${strings(machine.deadlines)}

    val cells: List<${cell}> = listOf(
${cells}
    )

    /**
     * The first cell, in declared order, from [stage] on [inputName] whose requires all hold in [guards] and whose
     * forbids none hold. Null when there is none: the state stays${machine.otherwise === "refuse" ? ", except that an input which may move it is refused" : ""}.
     */
    fun declaredNext(stage: ${state}, inputName: String, guards: Set<${guard}>): ${cell}? {
        require(inputName in inputs) { "machine ${machine.id} has no input $inputName" }
        val cell = cells.firstOrNull { it.from == stage && it.on == inputName && guards.containsAll(it.requires) && it.forbids.none { held -> held in guards } }
${noCell}${options.traceSink ? `        if (${options.traceBuildGuard} && ${options.traceSink}.enabled) ${options.traceSink}.transition(${kotlinStringLiteral(machine.id)},
            cell?.id, stage.name, cell?.to?.name ?: stage.name, inputName,
            ${guard}.entries.associate { it.name to (it in guards) })
` : ""}        return cell
    }
}
${options.traceSink ? `\n${emitStudioTraceSinkKotlin(options.traceSink)}` : ""}`;
}
