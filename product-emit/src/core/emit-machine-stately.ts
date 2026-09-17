import { defineMachine, type Machine, type MachineCell } from "@v1d/product-spec";

export interface MachineStatelyOptions {
  /** Repo-relative path of the declaration, named in the header. */
  readonly sourceFile: string;
}

/**
 * A machine as a Stately Studio source: a small `createMachine({ id, initial, states })` with, per state, its inputs
 * and their transitions in the cells' declared order, so a first-match machine reads the same. A guard is its name;
 * `requires` becomes `and([...])` and each `forbids` a `not(...)`. There are no functions and no context: the facts
 * behind a guard stay the caller's, and Studio's simulator lets a person pick them. Export only, never read back.
 * A machine that breaks a law is refused before anything is written.
 */
export function emitMachineStately(machine: Machine, options: MachineStatelyOptions): string {
  defineMachine({ ...machine } as Parameters<typeof defineMachine>[0]);
  const helpers = new Set<string>();
  const guardOf = (cell: Required<MachineCell>): string | undefined => {
    const parts = [...cell.requires.map(quote), ...cell.forbids.map((guard) => `not(${quote(guard)})`)];
    if (cell.forbids.length > 0) helpers.add("not");
    if (parts.length <= 1) return parts[0];
    helpers.add("and");
    return `and([${parts.join(", ")}])`;
  };
  const states = machine.states.map((state) => {
    const inputs = [...new Set(machine.cells.filter(({ from }) => from === state).map(({ on }) => on))];
    if (inputs.length === 0) return `    ${key(state)}: {},`;
    const on = inputs.map((input) => {
      const transitions = machine.cells.filter(({ from, on: cellInput }) => from === state && cellInput === input).map((cell) => {
        const guard = guardOf(cell);
        return `{ ${guard === undefined ? "" : `guard: ${guard}, `}target: ${quote(cell.to)} }`;
      });
      return `        ${key(input)}: [${transitions.join(", ")}],`;
    });
    return [`    ${key(state)}: {`, "      on: {", ...on, "      },", "    },"].join("\n");
  });
  const imports = ["createMachine", ...helpers].sort();
  return [
    "// GENERATED FILE. DO NOT EDIT.",
    `// GENERATED FROM ${options.sourceFile}`,
    `// Machine ${machine.id} for Stately Studio: ordering ${machine.ordering}, otherwise ${machine.otherwise}. Guards are names; the caller supplies the facts.`,
    `import { ${imports.join(", ")} } from "xstate";`,
    "",
    "export const machine = createMachine({",
    `  id: ${quote(machine.id)},`,
    `  initial: ${quote(machine.initial)},`,
    "  states: {",
    ...states,
    "  },",
    "});",
    "",
  ].join("\n");
}

function quote(value: string): string {
  return JSON.stringify(value);
}

function key(name: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/u.test(name) ? name : quote(name);
}
