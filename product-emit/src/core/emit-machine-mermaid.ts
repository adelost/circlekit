import { defineMachine, type Machine, type MachineCell } from "@v1d/product-spec";

/**
 * A machine as a Mermaid `stateDiagram-v2`: the initial state, then one arrow per cell in declared order, labelled with
 * its input and guards as `on [requires, !forbids]`. A cell with no guards is labelled with its input alone. The same
 * cells the Kotlin carries, so the picture cannot show a move the code does not have. A machine that breaks a law is
 * refused before anything is drawn.
 */
export function emitMachineMermaid(machine: Machine): string {
  defineMachine({ ...machine } as Parameters<typeof defineMachine>[0]);
  const arrows = machine.cells.map((cell) => `    ${cell.from} --> ${cell.to} : ${arrowLabel(cell)}`);
  return [
    "stateDiagram-v2",
    `    %% machine ${machine.id}: ordering ${machine.ordering}, otherwise ${machine.otherwise}`,
    `    [*] --> ${machine.initial}`,
    ...arrows,
    "",
  ].join("\n");
}

function arrowLabel(cell: Required<MachineCell>): string {
  const guards = [...cell.requires, ...cell.forbids.map((guard) => `!${guard}`)];
  return guards.length === 0 ? cell.on : `${cell.on} [${guards.join(", ")}]`;
}
