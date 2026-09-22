import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareInspection } from '../lib/exporter.mjs';
import { digest } from '../lib/util.mjs';

test('authoring export documents the exact source snapshot that was compiled', async () => {
  const sourceFiles=['src/service.ts'];
  const snapshot=[{relative:'src/service.ts',text:`import { service } from '@v1d/product-spec';
/** WHAT: Routes commands to the owner. WHY: Keeps effects outside presentation. */
export const owner = service({id:'example.owner',inputs:[],outputs:[],runtime:{stateOwner:'none',lifetime:'call',durability:'transient',clockDomain:'none',contextInputs:[],effects:[]}});
`}];
  const bundle=await prepareInspection({
    root:process.cwd(),productId:'snapshot-test',compiler:{name:'@v1d/product-spec',version:'0.3.65'},
    sourceFiles,sourceSnapshot:snapshot,evaluateContract:()=>[],
  });
  assert.equal(bundle.sources[0].digest,digest(snapshot[0].text));
  assert.equal(bundle.contracts[0].id,'example.owner');
  assert.equal(bundle.contracts[0].contract.status,'validated');
});

test('authoring export refuses a source snapshot that does not match the selected file list', async () => {
  await assert.rejects(
    prepareInspection({
      root:process.cwd(),productId:'snapshot-test',compiler:{name:'@v1d/product-spec',version:'0.3.65'},
      sourceFiles:['src/service.ts'],sourceSnapshot:[{relative:'src/other.ts',text:''}],
    }),
    error=>error.code==='export.snapshot',
  );
});
