/** Test-only package condition. Normal ProductSpec imports never load this module. */
export * from "./index.js";

import { appendFileSync } from "node:fs";
import { join } from "node:path";
import { decide as baseDecide, type Decision, type DecisionAxes, type DecisionColumns,
  type DecisionPoint, type DecisionTable } from "./decision-table-model.js";
import { step as baseStep, type Machine, type MachineStep } from "./machine-model.js";

const traceDir = process.env.V1D_STUDIO_TRACE_DIR;
if (!traceDir) throw new Error("ProductSpec studio-trace condition requires V1D_STUDIO_TRACE_DIR from v1d-studio record");
const traceFile = join(traceDir, `node-${process.pid}.jsonl`);

function record(event: Readonly<Record<string, unknown>>): void {
  appendFileSync(traceFile, `${JSON.stringify(event)}\n`);
}

/** WHAT: Tracks calls through declared port names in a focused test. WHY: Keeps port event identities out of binding tests. */
export function bindPortImplementations<Ports extends object>(ports: Ports): Ports {
  return new Proxy(ports, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (typeof property !== "string" || !Object.hasOwn(target, property) || typeof value !== "function") return value;
      return (...args: unknown[]) => {
        const result = Reflect.apply(value, target, args);
        record({ kind: "port", portRef: property });
        return result;
      };
    },
  });
}

/** WHAT: Tracks the cell chosen by a real test decision. WHY: Keeps trace identities and files out of product tests. */
export function decide<Axes extends DecisionAxes, Columns extends DecisionColumns>(
  table: DecisionTable<Axes, Columns>, at: DecisionPoint<Axes>,
): Decision<Axes, Columns> {
  const result = baseDecide(table, at);
  record({ kind: "decision", facetId: table.id, cellId: result.cell, facts: result.at, values: result.values });
  return result;
}

/** WHAT: Tracks the cell or stay chosen by a real test machine step. WHY: Keeps process events bound to the declared machine. */
export function step<State extends string, Input extends string, Guard extends string>(
  machine: Machine<State, Input, Guard>, state: State, input: Input, guardsHeld: ReadonlySet<Guard>,
): MachineStep<State> {
  const result = baseStep(machine, state, input, guardsHeld);
  record({ kind: "transition", facetId: machine.id, cellId: result.cellId, from: state, to: result.to,
    input, guards: Object.fromEntries(machine.guards.map(guard => [guard, guardsHeld.has(guard)])) });
  return result;
}
