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
 * One generated object that builds each declared lane once, on Android: a dedicated lane is a HandlerThread named
 * after it, a shared lane a single-thread executor whose thread carries its name, and the UI lane is the main looper.
 * Each lane has `require()`, which throws in a debug build when called off the lane and does nothing in release, and a
 * fulfilment line saying what Android built for it. Nothing is started until a rider first uses its lane.
 */
export function emitLanesKotlin<Declared extends Readonly<Record<string, LaneDeclaration>>>(
  lanes: Lanes<Declared>,
  options: LanesKotlinOptions,
): string {
  defineLanes(lanes);
  const generated = `Generated${options.symbolPrefix}`;
  const lane = `${generated}Lane`;
  const members = Object.entries(lanes.lanes).map(([name, declared]) => {
    const thread = `${options.threadNamePrefix}${name}`;
    const kind = declared.isolation === "dedicated" ? "Dedicated" : "Shared";
    return `    /** ${declared.reason} Rides: ${laneRiders(lanes, name).join(", ")}. ${fulfilment(declared.isolation, thread)} */
    val ${name} = ${lane}.${kind}(${kotlinStringLiteral(name)}, ${kotlinStringLiteral(thread)})`;
  });
  const uiRiders = laneRiders(lanes, UI_LANE);
  const all = [...Object.keys(lanes.lanes), UI_LANE].join(", ");
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

/** One declared lane: where its riders run, and what Android built for it. */
internal sealed class ${lane}(val name: String, val threadName: String, val fulfilment: String) {
    /** Throws in a debug build when called anywhere but on this lane; does nothing in release. */
    abstract fun require()

    protected fun offLane(): String = "$name lane work ran on thread '\${Thread.currentThread().name}', not '$threadName'"

    /** One rider owns it: a HandlerThread named after the lane, started the first time a rider uses it. */
    class Dedicated(name: String, threadName: String) :
        ${lane}(name, threadName, "android: HandlerThread($threadName), fulfilment: full") {
        private val thread: HandlerThread by lazy { HandlerThread(threadName).apply { start() } }
        val looper: Looper get() = thread.looper
        val handler: Handler by lazy { Handler(looper) }

        override fun require() {
            if (laneChecks) check(Looper.myLooper() == looper) { offLane() }
        }
    }

    /** Several riders take turns on it: a single-thread executor whose thread carries the lane's name. */
    class Shared(name: String, threadName: String) :
        ${lane}(name, threadName, "android: single-thread executor($threadName), fulfilment: full") {
        val executor: ExecutorService by lazy {
            Executors.newSingleThreadExecutor { runnable -> Thread(runnable, threadName).apply { isDaemon = true } }
        }

        override fun require() {
            if (laneChecks) check(Thread.currentThread().name == threadName) { offLane() }
        }
    }

    /** The platform's UI lane: Android's main looper. A stream never rides it. */
    class Ui : ${lane}(${kotlinStringLiteral(UI_LANE)}, "main", "android: main looper, fulfilment: full") {
        override fun require() {
            if (laneChecks) check(Looper.myLooper() == Looper.getMainLooper()) { offLane() }
        }
    }
}

/** Every declared lane, built once. */
internal object ${generated}Lanes {
${members.join("\n\n")}

    /** The main looper. Rides: ${uiRiders.length === 0 ? "nothing declared" : uiRiders.join(", ")}. android: main looper, fulfilment: full */
    val ${UI_LANE} = ${lane}.Ui()

    val all: List<${lane}> = listOf(${all})
}
`;
}

function fulfilment(isolation: "dedicated" | "shared", thread: string): string {
  return isolation === "dedicated"
    ? `android: HandlerThread(${thread}), fulfilment: full`
    : `android: single-thread executor(${thread}), fulfilment: full`;
}
