import { defineLanes, laneRiders, UI_LANE, type LaneDeclaration, type Lanes } from "@v1d/product-spec";
import type { SourcedKotlinEmissionOptions } from "./emission-options.js";
import { kotlinStringLiteral } from "./kotlin-syntax.js";

export interface LanesKotlinOptions extends SourcedKotlinEmissionOptions {
  /** Every lane's thread is named this plus the lane, e.g. `acme-` and `pressure` make `acme-pressure`. */
  readonly threadNamePrefix: string;
  /** A Kotlin Boolean expression that is true in a debug build, where `require()` throws off its lane. */
  readonly debugExpression: string;
}

/**
 * One generated object that builds each declared lane on Android: a dedicated lane is a HandlerThread named after it,
 * a shared lane a single-thread executor whose thread carries its name, and the UI lane is the main looper. A lane that
 * lives for the process is built on first use; a lane that lives with its owner is opened by that owner and closed with
 * it. A rider registers with the handle the lane hands out (its Handler, looper or executor), so the binding is by
 * construction, and `require()` only checks it: it throws off the lane when the product's debug expression is true and
 * does nothing otherwise. `fulfilment()` says, per lane, what Android built and how fully: every lane here is full.
 */
export function emitLanesKotlin<Declared extends Readonly<Record<string, LaneDeclaration>>>(
  lanes: Lanes<Declared>,
  options: LanesKotlinOptions,
): string {
  defineLanes(lanes);
  const generated = `Generated${options.symbolPrefix}`;
  const lane = `${generated}Lane`;
  const declared = Object.entries(lanes.lanes) as [string, LaneDeclaration][];
  const members = declared.map(([name, declaration]) => {
    const thread = `${options.threadNamePrefix}${name}`;
    const riders = laneRiders(lanes, name).join(", ");
    const owner = declaration.isolation === "dedicated" ? ` Owner: ${declaration.owner}.` : "";
    const doc = `    /** ${declaration.reason}${owner} Rides: ${riders}. ${fulfilmentLine(name, declaration, thread)} */`;
    if (declaration.isolation === "shared") {
      return `${doc}\n    val ${name} = ${lane}.Shared(${kotlinStringLiteral(name)}, ${kotlinStringLiteral(thread)})`;
    }
    if (declaration.lifetime === "owner") {
      const opener = `open${name.charAt(0).toUpperCase()}${name.slice(1)}`;
      return `${doc}\n    /** Opened by its owner and closed with it; an owner that restarts opens a new lane. */\n`
        + `    fun ${opener}(): ${lane}.Dedicated = ${lane}.Dedicated(${kotlinStringLiteral(name)}, ${kotlinStringLiteral(thread)}, closable = true)`;
    }
    return `${doc}\n    val ${name} = ${lane}.Dedicated(${kotlinStringLiteral(name)}, ${kotlinStringLiteral(thread)}, closable = false)`;
  });
  const processLanes = declared.filter(([, declaration]) => declaration.isolation === "shared" || declaration.lifetime === "process")
    .map(([name]) => name);
  const fulfilmentLines = declared.map(([name, declaration]) =>
    `        ${kotlinStringLiteral(fulfilmentLine(name, declaration, `${options.threadNamePrefix}${name}`))},`).join("\n");
  const uiRiders = laneRiders(lanes, UI_LANE);
  return `// GENERATED FILE. DO NOT EDIT.
// GENERATED FROM ${options.sourceFile}
// Generator SHA-256: ${options.sourceSha}
package ${options.packageName}

import android.os.Handler
import android.os.HandlerThread
import android.os.Looper
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/** Debug builds refuse lane work off its lane; release builds never pay for the check. */
private val laneChecks: Boolean get() = ${options.debugExpression}

/** How fully Android could build a declared lane: degraded keeps its meaning on a shared resource, unsupported cannot. */
internal enum class ${generated}LaneFulfilment { FULL, DEGRADED, UNSUPPORTED }

/** One declared lane: where its riders run, and what Android built for it. */
internal sealed class ${lane}(val name: String, val threadName: String) {
    abstract val fulfilment: ${generated}LaneFulfilment

    /** Throws in a debug build when called anywhere but on this lane; does nothing in release. */
    abstract fun require()

    protected fun offLane(): String = "$name lane work ran on thread '\${Thread.currentThread().name}', not '$threadName'"

    /** One owner's work: a HandlerThread named after the lane, started the first time a rider uses it. */
    class Dedicated(name: String, threadName: String, private val closable: Boolean) : ${lane}(name, threadName) {
        override val fulfilment = ${generated}LaneFulfilment.FULL
        private val thread: HandlerThread by lazy { HandlerThread(threadName).apply { start() } }
        val looper: Looper get() = thread.looper
        val handler: Handler by lazy { Handler(looper) }

        override fun require() {
            if (laneChecks) check(Looper.myLooper() == looper) { offLane() }
        }

        /** Ends a lane that lives with its owner; a process lane is never closed. */
        fun close() {
            check(closable) { "$name lane lives for the process and is never closed" }
            thread.quitSafely()
        }
    }

    /** Unrelated riders take turns on it: a single-thread executor whose thread carries the lane's name. */
    class Shared(name: String, threadName: String) : ${lane}(name, threadName) {
        override val fulfilment = ${generated}LaneFulfilment.FULL
        val executor: ExecutorService by lazy {
            Executors.newSingleThreadExecutor { runnable -> Thread(runnable, threadName).apply { isDaemon = true } }
        }

        override fun require() {
            if (laneChecks) check(Thread.currentThread().name == threadName) { offLane() }
        }
    }

    /** The platform's UI lane: Android's main looper. A stream never rides it. */
    class Ui : ${lane}(${kotlinStringLiteral(UI_LANE)}, "main") {
        override val fulfilment = ${generated}LaneFulfilment.FULL

        override fun require() {
            if (laneChecks) check(Looper.myLooper() == Looper.getMainLooper()) { offLane() }
        }
    }
}

/** Every declared lane: process lanes built once on first use, owner lanes opened by their owner. */
internal object ${generated}Lanes {
${members.join("\n\n")}

    /** The main looper. Rides: ${uiRiders.length === 0 ? "nothing declared" : uiRiders.join(", ")}. */
    val ${UI_LANE} = ${lane}.Ui()

    /** The lanes built once for the process. */
    val all: List<${lane}> = listOf(${[...processLanes, UI_LANE].join(", ")})

    /** Per declared lane: its isolation and ordering, what Android builds for it, and how fully. */
    fun fulfilment(): List<String> = listOf(
${fulfilmentLines}
    )
}
`;
}

function fulfilmentLine(name: string, lane: LaneDeclaration, thread: string): string {
  const mechanism = lane.isolation === "dedicated" ? `HandlerThread(${thread})` : `single-thread executor(${thread})`;
  return `${name}: ${lane.isolation} ${lane.ordering} -> ${mechanism}, fulfilment full`;
}
