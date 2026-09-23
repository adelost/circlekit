import {requireIdentifier,requireWireId} from './node-model.js';
import {declarationSite} from './source-site.js';

/** Portable storage behavior. The platform supplies bytes and a codec, never another commit policy. */
export interface StoreServiceSpec {
  readonly id:string;
  readonly backend:'file'|'preferences';
  readonly codec:{readonly id:string;readonly version:number};
  readonly identity:string;
  readonly durability:'fsync-atomic-replace'|'commit';
  readonly failure:'reject'|'best-effort';
  readonly migration:'versioned'|'none';
  readonly effectIds:readonly string[];
}

export type StoreService<Spec extends StoreServiceSpec=StoreServiceSpec>=Spec & {readonly pattern:'store'};

/** A file store never gains a direct-write fallback just because rename failed. */
export function storeService<const Spec extends StoreServiceSpec>(spec:Spec):StoreService<Spec> {
  const name=typeof spec?.id==='string'&&spec.id?spec.id:'<missing-id>';
  const fail=(field:string):never=>{throw new Error(`storeService '${name}' needs ${field} [${declarationSite(storeService)}]`);};
  if(name==='<missing-id>')fail('id');
  try {requireWireId(name,'store id');} catch {fail('id');}
  if(spec.backend!=='file'&&spec.backend!=='preferences')fail('backend');
  if(!spec.codec||typeof spec.codec.id!=='string')fail('codec.id');
  try {requireWireId(spec.codec.id,'store codec');} catch {fail('codec.id');}
  if(!Number.isSafeInteger(spec.codec.version)||spec.codec.version<1)fail('codec.version');
  if(typeof spec.identity!=='string')fail('identity');
  try {requireIdentifier(spec.identity,'store identity');} catch {fail('identity');}
  if(spec.backend==='file'&&spec.durability!=='fsync-atomic-replace'||
      spec.backend==='preferences'&&spec.durability!=='commit')fail('durability');
  if(spec.failure!=='reject'&&spec.failure!=='best-effort')fail('failure');
  if(spec.migration!=='versioned'&&spec.migration!=='none')fail('migration');
  if(!Array.isArray(spec.effectIds)||spec.effectIds.length===0||
      new Set(spec.effectIds).size!==spec.effectIds.length)fail('effectIds');
  for(const effect of spec.effectIds){
    try {requireWireId(effect,'store effect');} catch {fail('effectIds');}
  }
  return Object.freeze({...spec,pattern:'store' as const});
}

/** One storage effect belongs to one store declaration, even when two native callers share its adapter. */
export function storeCatalog<const Specs extends readonly StoreServiceSpec[]>(specs:Specs):
  readonly StoreService<Specs[number]>[] {
  const stores=specs.map(storeService);
  const ids=new Set<string>(),effects=new Map<string,string>();
  for(const store of stores){
    if(ids.has(store.id))throw new Error(`store '${store.id}' is declared twice`);
    ids.add(store.id);
    for(const effect of store.effectIds){
      const previous=effects.get(effect);
      if(previous)throw new Error(`store effect '${effect}' belongs to both '${previous}' and '${store.id}'`);
      effects.set(effect,store.id);
    }
  }
  return Object.freeze(stores);
}
