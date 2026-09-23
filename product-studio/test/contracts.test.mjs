import test from 'node:test';
import assert from 'node:assert/strict';
import { architectureOf, entityKey } from '../lib/architecture.mjs';
import { indexSource, locateEntities } from '../lib/provenance.mjs';
import { createInspectionBundle } from '../lib/inspection.mjs';
import { digest } from '../lib/util.mjs';

const source = `import { service } from '@v1d/product-spec';

/**
 * WHAT: Routes recording commands and publishes the active session.
 * WHY: Keeps recorder effects separate from flight sensing and presentation.
 */
export const recording = service({
  id: 'recording.runtime',
  inputs: [],
  outputs: [],
  runtime: {
    stateOwner: 'instance',
    lifetime: 'process',
    durability: 'durable',
    clockDomain: 'wall',
    contextInputs: [],
    effects: ['recording.write'],
  },
});
`;

const product = {
  id: 'demo',
  kind: 'product-spec-ir',
  schemaVersion: 9,
  nodeTypes: [{
    id: 'recording.runtime',
    kind: 'service',
    inputs: [],
    outputs: [],
    runtime: {
      stateOwner: 'instance',
      lifetime: 'process',
      durability: 'durable',
      clockDomain: 'wall',
      contextInputs: [],
      effects: ['recording.write'],
    },
  }],
  nodes: [],
  componentTypes: [],
  components: [],
  artifacts: [],
  portRegistry: { nodePorts: [], componentPorts: [], bindings: [] },
};

test('WHAT WHY is extracted from the exact service declaration', () => {
  const indexed = indexSource(source, 'recording.ts');
  const candidate = indexed.candidates.find(row => row.id === 'recording.runtime');
  assert.equal(candidate.constructor, 'service');
  assert.deepEqual(candidate.contract, {
    what: 'Routes recording commands and publishes the active session.',
    why: 'Keeps recorder effects separate from flight sensing and presentation.',
    complete: true,
  });
});

test('service contract is associated without entering ProductIr', () => {
  const architecture = architectureOf(product);
  const located = locateEntities(architecture, [{ path: 'recording.ts', text: source }]);
  const contract = located.contracts.find(row => row.entityKey === entityKey('node-type', 'recording.runtime'));
  assert.equal(contract.what, 'Routes recording commands and publishes the active session.');
  assert.equal('contract' in product.nodeTypes[0], false);
  assert.equal(located.diagnostics.some(row => row.rule === 'contract.service-missing'), false);
});

test('missing service contract is visible but does not invent prose', () => {
  const bare = source.replace(/\/\*\*[\s\S]*?\*\/\n/, '');
  const located = locateEntities(architectureOf(product), [{ path: 'recording.ts', text: bare }]);
  assert.equal(located.contracts.length, 0);
  assert.equal(located.diagnostics.some(row => row.rule === 'contract.service-missing'), true);
});

test('documentation changes envelope identity but not compiled model identity', () => {
  const common = {
    productId: 'demo',
    compiler: { name: '@v1d/product-spec', version: '0.3.65' },
    product,
    sources: [{ file: 'recording.ts', digest: digest(source) }],
  };
  const a = createInspectionBundle({
    ...common,
    contracts: [{
      entityKey: entityKey('node-type', 'recording.runtime'),
      what: 'Routes commands.',
      why: 'Keeps effects separate.',
      file: 'recording.ts',
      sourceDigest: digest(source),
    }],
  });
  const b = createInspectionBundle({
    ...common,
    contracts: [{
      entityKey: entityKey('node-type', 'recording.runtime'),
      what: 'Routes recording commands.',
      why: 'Keeps effects separate.',
      file: 'recording.ts',
      sourceDigest: digest(source),
    }],
  });
  assert.equal(a.modelDigest, b.modelDigest);
  assert.notEqual(a.bundleDigest, b.bundleDigest);
});

test('BDD metadata stays documentation until exact test results exist elsewhere', () => {
  const bundle = createInspectionBundle({
    productId: 'demo',
    compiler: { name: '@v1d/product-spec', version: '0.3.65' },
    product,
    testContracts: [{
      id: 'recording.starts',
      level: 'host',
      entityKeys: [entityKey('node-type', 'recording.runtime')],
      given: 'recording is armed',
      when: 'the start command arrives',
      then: 'one active session is published',
    }],
  });
  assert.equal(bundle.testContracts[0].level, 'host');
  assert.equal(Object.hasOwn(bundle.testContracts[0], 'pass'), false);
});
