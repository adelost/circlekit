import test from 'node:test';
import assert from 'node:assert/strict';
import { createInspectionBundle } from '../lib/inspection.mjs';
import { graphProduct } from '../lib/graph-data.mjs';
import { decodeArtifact, graphOf } from '../lib/model.mjs';

const compiled={
  nodeTypes:[{id:'source.type',kind:'service'}],
  nodes:[{id:'source',nodeTypeRef:'source.type',config:{},bindings:{}}],
  configs:[],
  componentTypes:[{id:'sink.type'}],
  components:[{id:'sink',componentTypeRef:'sink.type',bindings:{inputs:{},events:{}}}],
  portRegistry:{
    nodePorts:[{ref:'source.out',ownerId:'source'}],
    componentPorts:[{ref:'sink.in',ownerId:'sink'}],
    bindings:[{from:'source.out',to:'sink.in',purpose:'data'}],
  },
};

test('compiled graph stays explicitly narrower than ProductIr and remains inspectable',()=>{
  const product=graphProduct(compiled,'web-logbook');
  assert.equal(product.kind,'product-spec-graph');
  assert.equal(product.scopeNotice.includes('Full ProductIr'),true);
  const bundle=createInspectionBundle({productId:'web-logbook',compiler:{name:'@v1d/product-spec',version:'0.3.52'},product});
  const decoded=decodeArtifact(JSON.stringify(bundle));
  assert.equal(decoded.product.kind,'product-spec-graph');
  const graph=graphOf(decoded.product);
  assert.equal(graph.nodes.length,2);assert.equal(graph.edges.length,1);
  assert.equal(decoded.compatibility.inspect,true);assert.equal(decoded.compatibility.simulate,false);
});

test('compiled graph refuses bindings to invented ports',()=>{
  assert.throws(()=>graphProduct({...compiled,portRegistry:{...compiled.portRegistry,bindings:[{from:'source.out',to:'missing'}]}},'bad'));
});
