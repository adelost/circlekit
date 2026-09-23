import test from 'node:test';
import assert from 'node:assert/strict';
import * as studio from '../public/studio-tools.js';

const escape = value => String(value);
const machine = {id:'jump.session',kind:'machine',compiled:{states:['READY','FLYING'],initial:'READY',rests:['READY'],cells:[{id:'exit',from:'READY',to:'FLYING',on:'Exit'}]}};
const table = {id:'jump.policy',kind:'decision-table',compiled:{cells:[{id:'allow',region:{ready:'YES'},values:{action:'GO'}},{id:'hold',region:{ready:'NO'},values:{action:'WAIT'}}]}};
const project = (facet, trace = null) => ({facets:[facet],trace,product:null,graph:{nodes:[]},catalogAvailable:false,sources:[],architecture:{entities:[]}});
const trace = {sessionId:'test',eventCount:2,provenance:'test-run',complete:true,notice:'Test run.',truncation:{droppedBefore:0,gaps:[]},clock:{domain:'virtual'}};
const frame = logic => ({current:{sequence:1,kind:'transition',atMs:1,entityKey:'facet:machine:jump.session',logic},events:[],causalPath:[],nextOffset:null,total:2,logicCheck:{kind:'consistent',message:'Matches'}});

test('a loaded trace opens at its last step, otherwise the first facet or full graph opens', () => {
  assert.equal(studio.initialProjectView(project(machine,{...trace,eventCount:2})), 'Trace');
  assert.equal(studio.initialProjectView(project(table)), 'Logic');
  assert.equal(studio.initialProjectView({...project(machine),facets:[],product:{},graph:{nodes:[{id:'owner'}]}}), 'System');
  assert.notEqual(studio.initialProjectView({...project(machine),facets:[]}), 'System');
});

test('machine trace presents the shared graph before the event list', () => {
  const html=studio.traceView(project(machine,trace),{traceCursor:1,traceFrame:frame({facetId:'jump.session',cellId:'exit',from:'READY',to:'FLYING'})},escape);
  assert.match(html, /id="graph"[^>]*data-managed="graph"/);
  assert(html.indexOf('id="graph"') < html.indexOf('Recorded event lanes'));
});

test('decision trace marks its exact saved cell in the existing regions table', () => {
  const html=studio.traceView(project(table,trace),{traceCursor:1,traceFrame:frame({facetId:'jump.policy',cellId:'hold'})},escape);
  assert.match(html, /data-cell="hold"[^>]*aria-current="step"/);
  assert.doesNotMatch(html, /data-cell="allow"[^>]*aria-current="step"/);
});

test('trace marks only recorded earlier states and transition IDs', () => {
  const marks=studio.traceGraphMarks(machine,{
    current:{logic:{facetId:'jump.session',cellId:'exit',from:'READY',to:'FLYING'}},
    events:[{kind:'transition',eventIndex:0,logic:{facetId:'jump.session',cellId:'exit',from:'READY',to:'FLYING'}}],
    cursor:1,
  });
  assert.deepEqual([...marks.pastNodes],['READY','FLYING']);
  assert.deepEqual([...marks.pastEdges],['exit']);
  assert.equal(marks.currentEdge,'exit');
  assert.equal(marks.currentFrom,'READY');
  assert.equal(marks.currentTo,'FLYING');
});

test('a recorded stay highlights its state without inventing a cell edge', () => {
  const marks=studio.traceGraphMarks(machine,{cursor:1,events:[],current:{logic:{facetId:'jump.session',from:'FLYING',to:'FLYING'}}});
  assert.equal(marks.currentFrom,'FLYING');
  assert.equal(marks.currentTo,'FLYING');
  assert.equal(marks.currentEdge,null);
});

test('unselected inspector summarizes loaded convergence evidence', () => {
  const p={...project(machine,trace),convergence:{verdict:'Converged',label:'Converged',counts:{laws:{passed:3,failed:0,skipped:0},contracts:{validated:2,total:2}}}};
  const html=studio.projectSummary(p,escape);
  assert.match(html,/Converged/);
  assert.match(html,/3 laws/);
  assert.match(html,/2 trace steps/);
  assert.match(html,/WHAT\/WHY 2\/2/);
});
