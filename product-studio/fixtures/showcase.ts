// Three unmodified case records excerpted from CircleKit 464f432,
// showcase-product/src/catalog.ts. Not the complete catalog or a native renderer.
export const showcaseCases = [
  {
    id: 'atom.icon-action', openPort: 'atomIconAction', section: 'atoms', title: 'ACTIONS', iconId: 'watch',
    purpose: 'Shared demo toggle, static looks and disabled actions.',
    scenarios: [
      { id: 'idle', label: 'INACTIVE LOOK', description: 'Static appearance; no command runs' },
      { id: 'active', label: 'ACTIVE LOOK', description: 'Static active appearance; no command runs' },
      { id: 'immediate', label: 'TAP TO TOGGLE', description: 'The icons respond immediately' },
      { id: 'deliberate', label: 'HOLD TO TOGGLE', description: 'Progress confirms an intentional press' },
      { id: 'disabled', label: 'UNAVAILABLE', description: 'The icons cannot be activated' },
    ],
  },
  {
    id: 'control.action-row', openPort: 'controlActionRow', section: 'controls', title: 'ACTION ROW', iconId: 'touchdown-run',
    purpose: 'Local action counts. Nothing is sent or deleted.',
    scenarios: [
      { id: 'immediate', label: 'TAP ACTION', description: 'A tap increments the action count' },
      { id: 'deliberate', label: 'HOLD ACTION', description: 'A completed hold increments the count' },
      { id: 'both', label: 'THE TWO KINDS', description: 'One of each, to press against the other: the tap draws no wait' },
      { id: 'confirm', label: 'CONFIRM ACTION', description: 'A longer hold protects a destructive action' },
      { id: 'recoverable', label: 'RECOVER ACCESS', description: 'A simulated permission can be enabled' },
      { id: 'blocked', label: 'MISSING TARGET', description: 'Show the reason without a false action' },
      { id: 'failure', label: 'FAILURE + RETRY', description: 'A failed action can be retried in place' },
    ],
  },
  {
    id: 'control.choice-row', openPort: 'controlChoiceRow', section: 'controls', title: 'CHOICES', iconId: 'grid',
    purpose: 'Try selection marks and local demo choices.',
    scenarios: [
      { id: 'off', label: 'START OFF', description: 'Switch a two-state setting on' },
      { id: 'on', label: 'START ON', description: 'Switch a two-state setting off' },
      { id: 'two', label: 'TWO UNITS', description: 'Choose metres or feet' },
      { id: 'first', label: 'FIRST CHOICE', description: 'Seven choices, starting at the beginning' },
      { id: 'middle', label: 'MIDDLE CHOICE', description: 'Seven choices, starting in the middle' },
      { id: 'last', label: 'LAST CHOICE', description: 'Seven choices, starting at the end' },
    ],
  },
] as const;
