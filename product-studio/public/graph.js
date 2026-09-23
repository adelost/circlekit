const NS = 'http://www.w3.org/2000/svg';
const node = (tag, attrs = {}, text) => { const n = document.createElementNS(NS, tag); for (const [k,v] of Object.entries(attrs)) n.setAttribute(k,v); if (text !== undefined) n.textContent = text; return n; };
const bounded = v => Number.isFinite(v) && Math.abs(v) <= 1_000_000;
const pointOK = p => p && bounded(p.x) && bounded(p.y);
const scale = n => Math.min(4, Math.max(.15, n));
let serial = 0;

/** Model layout is a view projection. Selection never reruns layout or resets the camera. */
export function drawGraph(host, { nodes, edges, key, legacyKey, selected, active, onSelect }) {
  const storageKey = 'studio-camera-v1:' + key;
  let stored = {};
  try { const read = JSON.parse(localStorage.getItem(storageKey) || '{}'); if (read.version === 1) stored = read; } catch { /* Local state is not authoritative. */ }
  // The inspected object must not disappear just because it follows the render budget.
  if (!stored.positions && legacyKey) { try { const legacy=JSON.parse(localStorage.getItem('studio-layout:'+legacyKey)||'{}');
    stored.positions=Object.fromEntries(Object.entries(legacy).filter(([id,p])=>pointOK(p))); } catch { /* Invalid old layout is ignored, never treated as model data. */ } }
  const ordered = [...nodes.filter(n => n.id === selected), ...nodes.filter(n => n.id !== selected)];
  const shown = ordered.slice(0,160), ids = new Set(shown.map(n => n.id));
  const links = edges.filter(e => ids.has(e.source) && ids.has(e.target)).slice(0,600);
  const positions = new Map(shown.map((n,i) => [n.id, pointOK(stored.positions?.[n.id]) ? stored.positions[n.id] : {x:60+(i%3)*280,y:80+Math.floor(i/3)*145}]));
  let transform = pointOK(stored.viewport) && Number.isFinite(stored.viewport.scale) ? {...stored.viewport,scale:scale(stored.viewport.scale)} : {x:0,y:0,scale:1};
  const svg = node('svg',{class:'graph-svg',viewBox:'0 0 1000 550',role:'group','aria-label':'Declared graph. Arrow keys move a focused node; Enter inspects it.'});
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
    g.append(node('title',{},String(n.label??n.id)),node('rect',{width:215,height:78,rx:12}),node('circle',{cx:17,cy:23,r:4,class:'node-dot'}),
      node('text',{x:31,y:29,class:'node-title'},String(n.label??n.id).slice(0,24)),node('text',{x:17,y:54,class:'node-subtitle'},String(n.subtitle??n.kind??'node').slice(0,32)),
      node('circle',{cx:0,cy:39,r:4,class:'socket'}),node('circle',{cx:215,cy:39,r:4,class:'socket'}));
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
    if(e.source===e.target){d=`M${a.x+175} ${a.y} C${a.x+250} ${a.y-75} ${a.x+30} ${a.y-75} ${a.x+50} ${a.y}`;x=a.x+115;y=a.y-45;}
    else if(b.x>a.x){const x1=a.x+215,x2=b.x,y1=a.y+39,y2=b.y+39;d=`M${x1} ${y1} C${(x1+x2)/2} ${y1} ${(x1+x2)/2} ${y2} ${x2} ${y2}`;x=(x1+x2)/2;y=(y1+y2)/2-10;}
    else{const top=Math.min(a.y,b.y)-bend;d=`M${a.x+108} ${a.y} C${a.x+108} ${top-50} ${b.x+108} ${top-50} ${b.x+108} ${b.y}`;x=(a.x+b.x)/2+108;y=top-15;}
    path.setAttribute('d',d);label.setAttribute('x',x);label.setAttribute('y',y);
  }
  function draw() {raf=null;if(destroyed)return;for(const id of dirtyNodes){const p=positions.get(id);nodeItems.get(id).setAttribute('transform',`translate(${p.x} ${p.y})`);}for(const i of dirtyEdges)edgePath(edgeItems[i]);dirtyNodes.clear();dirtyEdges.clear();}
  function queue(id) {dirtyNodes.add(id);for(const i of incident.get(id)??[])dirtyEdges.add(i);if(raf===null)raf=requestAnimationFrame(draw);}
  function all() {for(const n of shown)queue(n.id);}
  function apply() {viewport.setAttribute('transform',`translate(${transform.x} ${transform.y}) scale(${transform.scale})`);}
  function saveNow() {if(destroyed)return;try{localStorage.setItem(storageKey,JSON.stringify({version:1,positions:Object.fromEntries(positions),viewport:transform}));}catch{/* Quota/private mode cannot block navigation. */}}
  function save() {clearTimeout(saveTimer);saveTimer=setTimeout(saveNow,150);}
  function zoom(by, anchor={x:500,y:275}) {const old=transform.scale,next=scale(old*by);transform={x:anchor.x-(anchor.x-transform.x)*next/old,y:anchor.y-(anchor.y-transform.y)*next/old,scale:next};apply();save();}
  let pan=null;
  svg.onwheel=e=>{e.preventDefault();zoom(e.deltaY<0?1.1:1/1.1,clientPoint(e,false));};
  svg.onpointerdown=e=>{if(e.target!==svg||e.button!==0)return;pan={point:clientPoint(e,false),base:{...transform}};svg.setPointerCapture(e.pointerId);};
  svg.onpointermove=e=>{if(!pan)return;const p=clientPoint(e,false);transform.x=pan.base.x+p.x-pan.point.x;transform.y=pan.base.y+p.y-pan.point.y;apply();};
  svg.onpointerup=svg.onpointercancel=()=>{pan=null;save();};
  function fit() {const ps=[...positions.values()];if(!ps.length)return;const left=Math.min(...ps.map(p=>p.x))-40,top=Math.min(...ps.map(p=>p.y))-60;
    const width=Math.max(...ps.map(p=>p.x+215))-left+40,height=Math.max(...ps.map(p=>p.y+78))-top+40,s=scale(Math.min(1000/width,550/height));
    transform={x:(1000-width*s)/2-left*s,y:(550-height*s)/2-top*s,scale:s};apply();save();}
  function arrange() { // Deterministic view layout only, never an asserted event order.
    const incoming=new Map(shown.map(n=>[n.id,0]));for(const e of links)if(e.source!==e.target)incoming.set(e.target,incoming.get(e.target)+1);
    const rank=new Map(), queue=shown.filter(n=>incoming.get(n.id)===0).map(n=>n.id);if(!queue.length&&shown.length)queue.push(shown[0].id);
    queue.forEach(id=>rank.set(id,0));for(let i=0;i<queue.length;i++)for(const e of links.filter(e=>e.source===queue[i]))if(!rank.has(e.target)){rank.set(e.target,(rank.get(e.source)??0)+1);queue.push(e.target);}
    const rows=new Map();for(const n of shown){const r=rank.get(n.id)??0,row=rows.get(r)??0;rows.set(r,row+1);positions.set(n.id,{x:60+r*290,y:80+row*150});}all();fit();}
  function select(next, running) {for(const [id,g]of nodeItems){g.classList.toggle('selected',id===next);g.classList.toggle('active',id===running);}for(const {e,g}of edgeItems)g.classList.toggle('selected',e.id===next);}
  host.replaceChildren(svg);all();apply();select(selected,active);
  return {reset:fit,zoom,arrange,select,has:id=>nodeItems.has(id)||links.some(e=>e.id===id),shown:shown.length,total:nodes.length,viewport:()=>({...transform}),
    destroy(){saveNow();destroyed=true;clearTimeout(saveTimer);if(raf!==null)cancelAnimationFrame(raf);}};
}
