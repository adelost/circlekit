// Synthetic scheduling policy. This is not the private video editor's code.
import { choice, defineDecisionTable, on } from '@v1d/product-spec';
export const pipelinePolicy = defineDecisionTable({
  id: 'example.pipeline',
  axes: { job: ['QUEUED', 'RUNNING', 'DONE'], device: ['READY', 'BUSY'], stage: ['START', 'WORK'] },
  columns: { display: choice(['READY', 'WAIT', 'RUN', 'DONE']) },
  cells: [
    on('queued-ready', { job: 'QUEUED', device: 'READY' }, { display: 'READY' }),
    on('queued-wait', { job: 'QUEUED', device: 'BUSY' }, { display: 'WAIT' }),
    on('running', { job: 'RUNNING' }, { display: 'RUN' }),
    on('done', { job: 'DONE' }, { display: 'DONE' }),
  ],
});
