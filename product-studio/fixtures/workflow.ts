// Synthetic request lifecycle for exercising Studio, not a product implementation.
// The state machine checks transitions. A caller still owns clocks and effects.
import { defineMachine } from '@v1d/product-spec';

export const requestLifecycle = defineMachine({
  id: 'example.request',
  states: ['IDLE', 'PENDING', 'SUCCESS', 'FAILURE'],
  initial: 'IDLE',
  inputs: ['Send', 'Response', 'Deadline', 'Reset', 'Inspect'],
  guards: ['CURRENT_REQUEST', 'RESPONSE_OK', 'EXPIRED'],
  rests: ['IDLE', 'SUCCESS', 'FAILURE'],
  deadlines: ['Deadline'],
  ordering: 'exclusive',
  otherwise: 'stay',
  cells: [
    { id: 'send', from: 'IDLE', on: 'Send', to: 'PENDING' },
    { id: 'reply-success', from: 'PENDING', on: 'Response', to: 'SUCCESS', requires: ['CURRENT_REQUEST', 'RESPONSE_OK'] },
    { id: 'reply-failure', from: 'PENDING', on: 'Response', to: 'FAILURE', requires: ['CURRENT_REQUEST'], forbids: ['RESPONSE_OK'] },
    { id: 'timeout', from: 'PENDING', on: 'Deadline', to: 'FAILURE', requires: ['EXPIRED'] },
    { id: 'reset-success', from: 'SUCCESS', on: 'Reset', to: 'IDLE' },
    { id: 'reset-failure', from: 'FAILURE', on: 'Reset', to: 'IDLE' },
    { id: 'cancel', from: 'PENDING', on: 'Reset', to: 'IDLE' },
  ],
  updates: [{ on: 'Inspect', fields: ['inspections'] }],
});
