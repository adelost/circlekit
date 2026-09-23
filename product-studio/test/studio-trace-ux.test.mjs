import test from 'node:test';
import assert from 'node:assert/strict';
import * as studio from '../public/studio-tools.js';
import * as graph from '../public/graph.js';

const escape = value => String(value);
const machine = {id:'jump.session',kind:'machine',compiled:{states:['READY','FLYING'],initial:'READY',rests:['READY'],cells:[{id:'exit',from:'READY',to:'FLYING',on:'Exit'}]}};
const table = {id:'jump.policy',kind:'decision-table',compiled:{cells:[{id:'allow',region:{ready:'YES'},values:{action:'GO'}},{id:'hold',region:{ready:'NO'},values:{action:'WAIT'}}]}};
const project = (facet, trace = null) => ({facets:[facet],trace,product:null,graph:{nodes:[]},catalogAvailable:false,sources:[],architecture:{entities:[]}});
const trace = {sessionId:'test',eventCount:2,provenance:'test-run',complete:true,notice:'Test run.',truncation:{droppedBefore:0,gaps:[]},clock:{domain:'virtual'}};
const frame = logic => ({current:{sequence:1,kind:'transition',atMs:1,entityKey:'facet:machine:jump.session',logic},events:[],causalPath:[],nextOffset:null,total:2,logicCheck:{kind:'consistent',message:'Matches'}});

test('SKYVW recording cycle follows the longest simple path from STOPPED', () => {
  const recording={id:'recording.session',kind:'machine',compiled:{initial:'STOPPED',rests:['STOPPED','ARMED'],states:['STOPPED','ARMED','BUFFERING','RECORDING'],cells:[
    {id:'start-armed',from:'STOPPED',to:'ARMED',on:'Start'},
    {id:'start-now',from:'STOPPED',to:'RECORDING',on:'Record'},
    {id:'gps-height',from:'ARMED',to:'BUFFERING',on:'AltitudeObserved'},
    {id:'recording-height-buffering',from:'BUFFERING',to:'RECORDING',on:'AltitudeObserved'},
    {id:'stop-recording',from:'RECORDING',to:'STOPPED',on:'Stop'},
  ]}};
  const {nodes,edges}=graph.machineGraph(recording);
  const positions=graph.machineFlowLayout(nodes,edges,recording.compiled.initial,4);
  assert.deepEqual(recording.compiled.states.map(state=>positions.get(state).x),[60,340,620,900]);
});

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

test('short traces keep paging and filter fields out of the primary view', () => {
  const html=studio.traceView(project(machine,{...trace,eventCount:6}),
    {traceCursor:5,traceFrame:frame({facetId:'jump.session',cellId:'exit',from:'READY',to:'FLYING'})},escape);
  assert.doesNotMatch(html,/data-action="trace-page-prev"/);
  assert.doesNotMatch(html,/data-action="trace-page-next"/);
  assert.match(html,/<details class="view-menu"><summary>Filter/);
  assert.doesNotMatch(html,/<details class="view-menu" open/);
});

test('long traces retain paging and the optional filter', () => {
  const html=studio.traceView(project(machine,{...trace,eventCount:202}),
    {traceCursor:201,traceFrame:frame({facetId:'jump.session',cellId:'exit',from:'READY',to:'FLYING'})},escape);
  assert.match(html,/data-action="trace-page-prev"/);
  assert.match(html,/<details class="view-menu"><summary>Filter/);
});

test('paging starts after the 200-event page boundary', () => {
  const state={traceCursor:1,traceFrame:frame({facetId:'jump.session',cellId:'exit',from:'READY',to:'FLYING'})};
  assert.doesNotMatch(studio.traceView(project(machine,{...trace,eventCount:200}),state,escape),/data-action="trace-page-prev"/);
  assert.match(studio.traceView(project(machine,{...trace,eventCount:201}),state,escape),/data-action="trace-page-prev"/);
});

test('a port trace without a facet shows its system graph, current owner and declared prior binding', () => {
  const account='node::account', list='node::list-presentation', jump='node::jump-presentation';
  const records='port::account.records', listRecords='port::list-presentation.records', jumpModel='port::jump-presentation.model', jumpInput='port::jump.model';
  const binding={id:'records-binding',kind:'binding',from:records,to:listRecords,source:account,target:list};
  const p={...project(machine,trace),facets:[],product:{},graph:{nodes:[{id:'account'},{id:'list-presentation'},{id:'jump-presentation'}]},
    architecture:{entities:[{key:account,kind:'node',id:'account'},{key:list,kind:'node',id:'list-presentation'},
      {key:jump,kind:'node',id:'jump-presentation'},{key:records,kind:'port',owner:account},
      {key:listRecords,kind:'port',owner:list},{key:jumpModel,kind:'port',owner:jump},{key:jumpInput,kind:'port',owner:jump}],edges:[]},
    canvas:{nodes:[{id:account},{id:list},{id:jump}],edges:[binding,{id:'jump-binding',kind:'binding',from:jumpModel,to:jumpInput,source:jump,target:jump}]}};
  const events=[{eventIndex:0,kind:'port',entityKey:records},{eventIndex:1,kind:'port',entityKey:listRecords},
    {eventIndex:2,kind:'port',entityKey:jumpModel}];
  const current={sequence:3,kind:'port',entityKey:jumpModel,atMs:3,summary:'Presentation'};
  const state={traceCursor:2,traceFrame:{cursor:2,current,events,causalPath:[],nextOffset:null,total:3}};
  const html=studio.traceView(p,state,escape);
  const marks=studio.traceArchitectureMarks(p,state.traceFrame,events);
  assert.match(html,/id="graph"[^>]*data-managed="graph"/);
  assert(html.indexOf('id="graph"')<html.indexOf('Recorded event lanes'));
  assert.equal(marks.currentTo,jump);
  assert.deepEqual([...marks.pastNodes],[account,list]);
  assert.deepEqual([...marks.pastEdges],['records-binding']);
  assert.equal(marks.currentEdge,'jump-binding');
});

test('an unknown port step names the missing declaration instead of leaving a blank graph', () => {
  const p={...project(machine,trace),facets:[],product:{},graph:{nodes:[{id:'account'}]},architecture:{entities:[],edges:[]}};
  const html=studio.traceView(p,{traceCursor:0,traceFrame:{cursor:0,current:{sequence:1,kind:'port',entityKey:'port::missing',atMs:0},events:[],causalPath:[],nextOffset:null,total:1}},escape);
  assert.match(html,/No declared port or owner/);
  assert.doesNotMatch(html,/id="graph"/);
});

test('decision trace marks its exact saved cell in the existing regions table', () => {
  const html=studio.traceView(project(table,trace),{traceCursor:1,traceFrame:frame({facetId:'jump.policy',cellId:'hold'})},escape);
  assert.match(html, /data-cell="hold"[^>]*aria-current="step"/);
  assert.doesNotMatch(html, /data-cell="allow"[^>]*aria-current="step"/);
});

test('decision regions and values read as labelled chips, not raw object JSON', () => {
  const html=studio.decisionRegionTable({compiled:{cells:[{id:'compact',region:{need:'COMPACT'},values:{action:'HOLD'}}]}},escape);
  assert.match(html,/need <strong>COMPACT<\/strong>/);
  assert.match(html,/action <strong>HOLD<\/strong>/);
  assert.doesNotMatch(html,/\{&quot;action&quot;|\{"action"/);
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

test('an older transition outside the displayed page still contributes to the trail', () => {
  const older={kind:'transition',eventIndex:201,logic:{facetId:'jump.session',cellId:'exit',from:'READY',to:'FLYING'}};
  const frame={cursor:205,current:{logic:{facetId:'jump.session',from:'FLYING',to:'FLYING'}},events:[]};
  const marks=studio.traceGraphMarks(machine,frame,[older]);
  assert.deepEqual([...marks.pastEdges],['exit']);
  assert.deepEqual([...marks.pastNodes],['READY','FLYING']);
});

test('unselected inspector summarizes loaded convergence evidence', () => {
  const p={...project(machine,trace),convergence:{verdict:'Converged',label:'Converged',counts:{laws:{passed:3,failed:0,skipped:0},contracts:{validated:2,total:2}}}};
  const html=studio.projectSummary(p,escape);
  assert.match(html,/Converged/);
  assert.match(html,/3 laws/);
  assert.match(html,/2 trace steps/);
  assert.match(html,/WHAT\/WHY 2\/2/);
});
