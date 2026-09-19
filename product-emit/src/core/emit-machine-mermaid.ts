import { defineMachine, type Machine, type MachineCell } from "@v1d/product-spec";

/**
 * A machine as a Mermaid `stateDiagram-v2`: the initial state, then one arrow per cell in declared order, labelled with
 * its input and guards as `on [requires, !forbids]`. A cell with no guards is labelled with its input alone. The same
 * cells the Kotlin carries, so the picture cannot show a move the code does not have. Every rest carries a note, so a
 * state without one is a state law 7 made a deadline leave. A machine that breaks a law is refused before anything is
 * drawn.
 */
export function emitMachineMermaid(machine: Machine): string {
  defineMachine({ ...machine } as Parameters<typeof defineMachine>[0]);
  const arrows = machine.cells.map((cell) => `    ${cell.from} --> ${cell.to} : ${arrowLabel(cell)}`);
  const legend = machine.rests.length === 0 ? [] : ["    %% a state noted rest may stay forever; a deadline input leaves every other state"];
  const rests = machine.rests.map((state) => `    note right of ${state} : rest`);
  return [
    "stateDiagram-v2",
    `    %% machine ${machine.id}: ordering ${machine.ordering}, otherwise ${machine.otherwise}`,
    ...legend,
    `    [*] --> ${machine.initial}`,
    ...arrows,
    ...rests,
    "",
  ].join("\n");
}

function arrowLabel(cell: Required<MachineCell>): string {
  const guards = [...cell.requires, ...cell.forbids.map((guard) => `!${guard}`)];
  return guards.length === 0 ? cell.on : `${cell.on} [${guards.join(", ")}]`;
}
