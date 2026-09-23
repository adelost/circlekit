// Synthetic inspection fixture. The graph data tests the viewer, not a native product.
import { defineDecisionTable, choice, on } from '@v1d/product-spec';
export const policy = defineDecisionTable({
  id: 'processing.admission',
  axes: { input: ['READY', 'MISSING'], permission: ['ALLOWED', 'BLOCKED'] },
  columns: { action: choice(['PROCESS', 'WAIT', 'HOLD']) },
  cells: [
    on('blocked', { permission: 'BLOCKED' }, { action: 'HOLD' }),
    on('missing', { permission: 'ALLOWED', input: 'MISSING' }, { action: 'WAIT' }),
    on('ready', { permission: 'ALLOWED', input: 'READY' }, { action: 'PROCESS' }),
  ],
});
export const owners = [
  { id: 'ingest.reader', nodeTypeRef: 'example.reader' },
  { id: 'processing.transform', nodeTypeRef: 'example.transform' },
  { id: 'presentation.model', nodeTypeRef: 'example.present' },
];
export const components = [{ id: 'screen.preview', componentTypeRef: 'example.preview' }];
export const product = {
  kind: 'product-spec-ir', schemaVersion: 9, id: 'example.pipeline',
  nodeTypes: [{ id: 'example.reader', kind: 'service', runtime: { effects: ['fixture-read'] } }, { id: 'example.transform', kind: 'derive' }, { id: 'example.present', kind: 'present' }],
  nodes: owners, componentTypes: [{ id: 'example.preview' }], components,
  artifacts: [{ id: 'web-preview', entryScreen: 'MAIN', serves: ['wide','compact'] }],
  artifactScopes: [{ artifactRef: 'web-preview', screenRef: 'MAIN', surface: 'wide', includedMounts: [{ mountRef: 'main', componentInstanceRef: 'screen.preview' }], omittedMounts: [] }],
  portRegistry: {
    nodePorts: [
      { ref: 'ingest.reader.frames', ownerId: 'ingest.reader', purpose: 'data', contract: 'example.frames' },
      { ref: 'processing.transform.frames', ownerId: 'processing.transform', purpose: 'data', contract: 'example.frames' },
      { ref: 'processing.transform.result', ownerId: 'processing.transform', purpose: 'data', contract: 'example.result' },
      { ref: 'presentation.model.result', ownerId: 'presentation.model', purpose: 'data', contract: 'example.result' },
      { ref: 'presentation.model.view', ownerId: 'presentation.model', purpose: 'data', contract: 'example.view' },
    ],
    componentPorts: [{ ref: 'screen.preview.model', ownerId: 'screen.preview', purpose: 'data', contract: 'example.view' }],
    bindings: [
      { from:'ingest.reader.frames', to:'processing.transform.frames' },
      { from:'processing.transform.result', to:'presentation.model.result' },
      { from:'presentation.model.view', to:'screen.preview.model' },
    ],
  },
};
