const NS = 'http://www.w3.org/2000/svg';
const node = (tag, attrs = {}, text) => { const n = document.createElementNS(NS, tag); for (const [k,v] of Object.entries(attrs)) n.setAttribute(k,v); if (text !== undefined) n.textContent = text; return n; };
const bounded = v => Number.isFinite(v) && Math.abs(v) <= 1_000_000;
const pointOK = p => p && bounded(p.x) && bounded(p.y);
const scale = n => Math.min(4, Math.max(.15, n));
function titleLines(value) {
  let rest=String(value);const lines=[];
  while(rest.length>22) {
    const head=rest.slice(0,22);
    const separator=Math.max(...['.','-','/','_',' '].map(mark=>head.lastIndexOf(mark)));
    const width=separator>=9?separator+1:22;
    lines.push(rest.slice(0,width));rest=rest.slice(width);
  }
  lines.push(rest);return lines;
}
const cardHeight = value => Math.max(78, titleLines(value).length * 16 + 48);
let serial = 0;

export function machineGraph(facet) {
  const machine=facet.compiled;
  return {
    nodes:machine.states.map(id=>({id,label:id,kind:'state',subtitle:machine.rests.includes(id)?'Rest state · may wait':'Deadline exit required'})),
    edges:machine.cells.map(cell=>({id:cell.id,source:cell.from,target:cell.to,label:cell.on})),
  };
}

export function machineFlowLayout(nodes,edges,initial,columns=3) {
  const ids=new Set(nodes.map(node=>node.id)),start=ids.has(initial)?initial:nodes[0]?.id;
  const next=new Map(nodes.map(node=>[node.id,[]]));
  for(const edge of edges)if(ids.has(edge.source)&&ids.has(edge.target)&&edge.source!==edge.target)next.get(edge.source).push(edge.target);
  for(const [id,targets] of next)next.set(id,[...new Set(targets)].sort());
  // Simple-path search is bounded because layout may not freeze the viewer on a dense machine.
  const ranks=new Map(),seen=new Set(start?[start]:[]);let visits=0;
  function walk(id,depth) {
    if(++visits>20000)return;
    ranks.set(id,Math.max(ranks.get(id)??0,depth));
    for(const target of next.get(id))if(!seen.has(target)){seen.add(target);walk(target,depth+1);seen.delete(target);}
  }
  if(start)walk(start,0);
  let last=Math.max(0,...ranks.values());
  for(const node of nodes)if(!ranks.has(node.id))ranks.set(node.id,++last);
  const slots=new Map(),rowSizes=new Map();
  for(const node of nodes){const rank=ranks.get(node.id),row=Math.floor(rank/columns),slot=slots.get(rank)??0;slots.set(rank,slot+1);rowSizes.set(row,Math.max(rowSizes.get(row)??0,slot+1));}
  const rowTop=new Map();let top=80;
  for(let row=0;row<=Math.floor(last/columns);row++){rowTop.set(row,top);top+=128*(rowSizes.get(row)??1);}
  slots.clear();
  return new Map(nodes.map(node=>{const rank=ranks.get(node.id),row=Math.floor(rank/columns),slot=slots.get(rank)??0;slots.set(rank,slot+1);
    return [node.id,{x:60+(rank%columns)*280,y:rowTop.get(row)+slot*128,rank}];}));
}

/** Model layout is a view projection. Selection never reruns layout or resets the camera. */
export function drawGraph(host, { nodes, edges, key, legacyKey, selected, active, trace, focusIds=null, onSelect, initial=null, columns=3, viewWidth=1000, viewHeight=550 }) {
  const storageKey = 'studio-camera-v1:' + key;
  let stored = {};
  try { const read = JSON.parse(localStorage.getItem(storageKey) || '{}'); if (read.version === 1) stored = read; } catch { /* Local state is not authoritative. */ }
  // The inspected object must not disappear just because it follows the render budget.
  if (!stored.positions && legacyKey) { try { const legacy=JSON.parse(localStorage.getItem('studio-layout:'+legacyKey)||'{}');
    stored.positions=Object.fromEntries(Object.entries(legacy).filter(([id,p])=>pointOK(p))); } catch { /* Invalid old layout is ignored, never treated as model data. */ } }
  const ordered = [...nodes.filter(n => n.id === selected), ...nodes.filter(n => n.id !== selected)];
  const shown = ordered.slice(0,160), ids = new Set(shown.map(n => n.id));
  const links = edges.filter(e => ids.has(e.source) && ids.has(e.target)).slice(0,600);
  const heights = new Map(shown.map(n => [n.id,cardHeight(n.label??n.id)]));
  const rowHeights=[];
  shown.forEach((n,i)=>{const row=Math.floor(i/columns);rowHeights[row]=Math.max(rowHeights[row]??0,heights.get(n.id));});
  const rowTops=[80];rowHeights.forEach((height,row)=>{rowTops[row+1]=rowTops[row]+height+50;});
  const flow=initial?machineFlowLayout(nodes,edges,initial,columns):null;
  const positions = new Map(shown.map((n,i) => [n.id, pointOK(stored.positions?.[n.id]) ? stored.positions[n.id] : flow?.get(n.id)??{x:60+(i%columns)*280,y:rowTops[Math.floor(i/columns)]}]));
  const rank=id=>flow?.get(id)?.rank;
  const canvasWidth=flow?Math.max(viewWidth,...shown.map(n=>flow.get(n.id).x+275)):viewWidth;
  const canvasHeight=flow?Math.max(viewHeight,...shown.map(n=>flow.get(n.id).y+heights.get(n.id)+140)):viewHeight;
  let transform = pointOK(stored.viewport) && Number.isFinite(stored.viewport.scale) ? {...stored.viewport,scale:scale(stored.viewport.scale)} : {x:0,y:0,scale:1};
  const svg = node('svg',{class:'graph-svg',viewBox:`0 0 ${canvasWidth} ${canvasHeight}`,role:'group','aria-label':'Declared graph. Arrow keys move a focused node; Enter inspects it.'});
  const arrow = 'studio-arrow-'+(++serial), defs=node('defs'), marker=node('marker',{id:arrow,viewBox:'0 0 10 10',refX:9,refY:5,markerWidth:6,markerHeight:6,orient:'auto-start-reverse'});
  marker.append(node('path',{d:'M0 0 L10 5 L0 10 z',fill:'currentColor'})); defs.append(marker); svg.append(defs);
  const viewport=node('g'), edgeLayer=node('g'), nodeLayer=node('g'); viewport.append(edgeLayer,nodeLayer); svg.append(viewport);
  const edgeItems=[], nodeItems=new Map(), incident=new Map(); let raf=null, saveTimer=null, destroyed=false;
  const dirtyNodes=new Set(), dirtyEdges=new Set();
  links.forEach((e,i)=>{
    const g=node('g',{class:`graph-edge ${e.purpose||'data'}`,tabindex:0,role:'button','aria-label':`${e.label??e.id}: ${e.source} to ${e.target}`});
    const path=node('path',{'marker-end':`url(#${arrow})`}), label=node('text',{class:'edge-label','text-anchor':'middle'},String(e.label??'').slice(0,40));
    g.append(node('title',{},`${e.source} → ${e.target}\n${e.label??e.id}`),path,label);edgeLayer.append(g);
    edgeItems.push({e,g,path,label,index:i});
    for(const id of [e.source,e.target]){if(!incident.has(id))incident.set(id,new Set());incident.get(id).add(i);}
    g.onclick=()=>onSelect('edge',e.id);g.onkeydown=event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();onSelect('edge',e.id);}};
  });
  function clientPoint(e, inViewport=true) { return new DOMPoint(e.clientX,e.clientY).matrixTransform((inViewport?viewport:svg).getScreenCTM().inverse()); }
  shown.forEach(n=>{
    const g=node('g',{class:`graph-node ${n.kind??'service'}`,tabindex:0,role:'button','aria-label':`${n.label??n.id}, ${n.kind??'node'}`});
    const height=heights.get(n.id),title=node('text',{x:31,y:29,class:'node-title'});
    titleLines(n.label??n.id).forEach((line,index)=>title.append(node('tspan',{x:31,dy:index?16:0},line)));
    g.append(node('title',{},String(n.label??n.id)+(n.description?'\n'+n.description:'')),node('rect',{width:215,height,rx:12}),node('circle',{cx:17,cy:23,r:4,class:'node-dot'}),
      title,node('text',{x:17,y:height-16,class:'node-subtitle'},String(n.subtitle??n.kind??'node').slice(0,32)),
      node('circle',{cx:0,cy:height/2,r:4,class:'socket'}),node('circle',{cx:215,cy:height/2,r:4,class:'socket'}));
    nodeLayer.append(g);nodeItems.set(n.id,g);let drag=null;
    g.onpointerdown=e=>{if(e.button!==0)return;e.stopPropagation();drag={start:clientPoint(e),base:{...positions.get(n.id)},moved:false};g.setPointerCapture(e.pointerId);};
    g.onpointermove=e=>{if(!drag)return;const p=clientPoint(e),dx=p.x-drag.start.x,dy=p.y-drag.start.y;if(Math.abs(dx)+Math.abs(dy)>4)drag.moved=true;positions.set(n.id,{x:drag.base.x+dx,y:drag.base.y+dy});queue(n.id);};
    g.onpointerup=()=>{if(!drag)return;const moved=drag.moved;drag=null;if(moved)save();else onSelect('node',n.id);};
    g.onpointercancel=()=>{drag=null;save();};
    g.onkeydown=e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();onSelect('node',n.id);return;}
      const delta={ArrowLeft:[-10,0],ArrowRight:[10,0],ArrowUp:[0,-10],ArrowDown:[0,10]}[e.key];
      if(delta){e.preventDefault();const p=positions.get(n.id);positions.set(n.id,{x:p.x+delta[0],y:p.y+delta[1]});queue(n.id);save();}};
  });
  function edgePath(item) {
    const {e,path,label,index}=item,a=positions.get(e.source),b=positions.get(e.target),bend=25+(index%3)*12;let d,x,y;
    if(flow&&rank(e.target)<=rank(e.source)){
      const bottom=Math.max(...shown.map(n=>positions.get(n.id).y+heights.get(n.id)))+bend;
      d=`M${a.x+108} ${a.y+heights.get(e.source)} C${a.x+108} ${bottom+50} ${b.x+108} ${bottom+50} ${b.x+108} ${b.y+heights.get(e.target)}`;
      x=(a.x+b.x)/2+108;y=bottom+20;
    }
    else if(e.source===e.target){d=`M${a.x+175} ${a.y} C${a.x+250} ${a.y-75} ${a.x+30} ${a.y-75} ${a.x+50} ${a.y}`;x=a.x+115;y=a.y-45;}
    else if(b.x>a.x){const x1=a.x+215,x2=b.x,y1=a.y+heights.get(e.source)/2,y2=b.y+heights.get(e.target)/2;d=`M${x1} ${y1} C${(x1+x2)/2} ${y1} ${(x1+x2)/2} ${y2} ${x2} ${y2}`;x=(x1+x2)/2;y=(y1+y2)/2-10;}
    else if(flow){const x1=a.x+108,x2=b.x+108,y1=a.y+heights.get(e.source),y2=b.y;d=`M${x1} ${y1} C${x1} ${y1+40} ${x2} ${y2-40} ${x2} ${y2}`;x=(x1+x2)/2;y=(y1+y2)/2;}
    else{const top=Math.min(a.y,b.y)-bend;d=`M${a.x+108} ${a.y} C${a.x+108} ${top-50} ${b.x+108} ${top-50} ${b.x+108} ${b.y}`;x=(a.x+b.x)/2+108;y=top-15;}
    path.setAttribute('d',d);label.setAttribute('x',x);label.setAttribute('y',y);
  }
  function draw() {raf=null;if(destroyed)return;for(const id of dirtyNodes){const p=positions.get(id);nodeItems.get(id).setAttribute('transform',`translate(${p.x} ${p.y})`);}for(const i of dirtyEdges)edgePath(edgeItems[i]);dirtyNodes.clear();dirtyEdges.clear();}
  function queue(id) {dirtyNodes.add(id);for(const i of incident.get(id)??[])dirtyEdges.add(i);if(raf===null)raf=requestAnimationFrame(draw);}
  function all() {for(const n of shown)queue(n.id);}
  function apply() {viewport.setAttribute('transform',`translate(${transform.x} ${transform.y}) scale(${transform.scale})`);}
  function saveNow() {if(destroyed)return;try{localStorage.setItem(storageKey,JSON.stringify({version:1,positions:Object.fromEntries(positions),viewport:transform}));}catch{/* Quota/private mode cannot block navigation. */}}
  function save() {clearTimeout(saveTimer);saveTimer=setTimeout(saveNow,150);}
  function zoom(by, anchor={x:canvasWidth/2,y:canvasHeight/2}) {const old=transform.scale,next=scale(old*by);transform={x:anchor.x-(anchor.x-transform.x)*next/old,y:anchor.y-(anchor.y-transform.y)*next/old,scale:next};apply();save();}
  let pan=null;
  svg.onwheel=e=>{e.preventDefault();zoom(e.deltaY<0?1.1:1/1.1,clientPoint(e,false));};
  svg.onpointerdown=e=>{if(e.target!==svg||e.button!==0)return;pan={point:clientPoint(e,false),base:{...transform}};svg.setPointerCapture(e.pointerId);};
  svg.onpointermove=e=>{if(!pan)return;const p=clientPoint(e,false);transform.x=pan.base.x+p.x-pan.point.x;transform.y=pan.base.y+p.y-pan.point.y;apply();};
  svg.onpointerup=svg.onpointercancel=()=>{pan=null;save();};
  function fit(ids=null) {const ps=[...positions.entries()].filter(([id])=>!ids||ids.includes(id));if(!ps.length)return;const left=Math.min(...ps.map(([,p])=>p.x))-40,top=Math.min(...ps.map(([,p])=>p.y))-60;
    const width=Math.max(...ps.map(([,p])=>p.x+215))-left+40,height=Math.max(...ps.map(([id,p])=>p.y+heights.get(id)))-top+40,s=scale(Math.min(ids?1.35:4,canvasWidth/width,canvasHeight/height));
    transform={x:(canvasWidth-width*s)/2-left*s,y:(canvasHeight-height*s)/2-top*s,scale:s};apply();save();}
  function arrange() { // Deterministic view layout only, never an asserted event order.
    if(flow){for(const [id,position] of flow)if(positions.has(id))positions.set(id,{...position});all();fit();return;}
    const incoming=new Map(shown.map(n=>[n.id,0]));for(const e of links)if(e.source!==e.target)incoming.set(e.target,incoming.get(e.target)+1);
    const rank=new Map(), queue=shown.filter(n=>incoming.get(n.id)===0).map(n=>n.id);if(!queue.length&&shown.length)queue.push(shown[0].id);
    queue.forEach(id=>rank.set(id,0));for(let i=0;i<queue.length;i++)for(const e of links.filter(e=>e.source===queue[i]))if(!rank.has(e.target)){rank.set(e.target,(rank.get(e.source)??0)+1);queue.push(e.target);}
    const rows=new Map();for(const n of shown){const r=rank.get(n.id)??0,y=rows.get(r)??80;rows.set(r,y+heights.get(n.id)+50);positions.set(n.id,{x:60+r*290,y});}all();fit();}
  function select(next, running, trace=null) {
    for(const [id,g]of nodeItems){
      g.classList.toggle('selected',id===next);g.classList.toggle('active',id===running);
      g.classList.toggle('trace-past',!!trace?.pastNodes.has(id));
      g.classList.toggle('trace-from',id===trace?.currentFrom);
      g.classList.toggle('trace-to',id===trace?.currentTo);
      g.classList.toggle('trace-evaluated',id===trace?.currentTo&&trace?.currentPhase==='evaluated');
      g.classList.toggle('trace-applied',id===trace?.currentTo&&trace?.currentPhase==='applied');
      if(id===trace?.currentTo)g.setAttribute('aria-current','step');else g.removeAttribute('aria-current');
    }
    for(const {e,g}of edgeItems){
      g.classList.toggle('selected',e.id===next);
      g.classList.toggle('trace-past',!!trace?.pastEdges.has(e.id));
      g.classList.toggle('trace-current',e.id===trace?.currentEdge);
      g.classList.toggle('trace-evaluated',e.id===trace?.currentEdge&&trace?.currentPhase==='evaluated');
      g.classList.toggle('trace-applied',e.id===trace?.currentEdge&&trace?.currentPhase==='applied');
      if(e.id===trace?.currentEdge)g.setAttribute('aria-current','step');else g.removeAttribute('aria-current');
    }
  }
  host.replaceChildren(svg);all();apply();select(selected,active,trace);
  if(focusIds?.length&&!pointOK(stored.viewport))fit(focusIds);
  return {reset:fit,zoom,arrange,select,has:id=>nodeItems.has(id)||links.some(e=>e.id===id),shown:shown.length,total:nodes.length,viewport:()=>({...transform}),
    destroy(){saveNow();destroyed=true;clearTimeout(saveTimer);if(raf!==null)cancelAnimationFrame(raf);}};
}
