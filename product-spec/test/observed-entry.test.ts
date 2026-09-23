import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';

test('the explicit Node condition observes ordinary package calls without product edits',()=>{
  const code=`import {defineMachine,step} from '@v1d/product-spec';
    import {installObservationSink} from '@v1d/product-spec/observation';
    const rows=[];const dispose=installObservationSink(row=>rows.push(row));
    const machine=defineMachine({id:'door',states:['CLOSED','OPEN'],initial:'CLOSED',inputs:['Open'],guards:[],
      cells:[{id:'open',from:'CLOSED',on:'Open',to:'OPEN'}],rests:['CLOSED','OPEN'],deadlines:[],ordering:'exclusive',otherwise:'stay'});
    step(machine,'CLOSED','Open',new Set());dispose();process.stdout.write(JSON.stringify(rows));`;
  const output=execFileSync(process.execPath,['--conditions=v1d-observe','--input-type=module','-e',code],
    {cwd:new URL('../',import.meta.url),encoding:'utf8'});
  const events=JSON.parse(output);
  assert.equal(events.length,1);
  assert.deepEqual(events[0],{kind:'transition',phase:'evaluated',facetId:'door',cellId:'open',
    from:'CLOSED',to:'OPEN',input:'Open',guards:{}});
});
