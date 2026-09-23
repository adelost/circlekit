import type { LegoContract, LegoField } from './node-model.js';
import type { ProductPortRegistry } from './port-graph-model.js';
import { declaredSite } from './source-site.js';

const numeric = (field:LegoField) => field.value==='number'||field.value==='integer';

/** A portable field law is closed over the contract's own numeric fields. */
export function validateContractLaws(contract:LegoContract):void {
  const fields=new Map(contract.fields.map(field=>[field.name,field]));
  for(const field of contract.fields){
    const bounded=field.min!==undefined||field.max!==undefined||field.gteField!==undefined;
    if(bounded&&!numeric(field))throw new Error(`contract '${contract.id}' law on nonnumeric field '${field.name}'`);
    if(field.min!==undefined&&!Number.isFinite(field.min)||field.max!==undefined&&!Number.isFinite(field.max)
      ||field.min!==undefined&&field.max!==undefined&&field.min>field.max)
      throw new Error(`contract '${contract.id}' field '${field.name}' has invalid numeric bounds`);
    if(field.gteField!==undefined){
      const other=fields.get(field.gteField);
      if(!other||other===field||!numeric(other)||other.unit!==field.unit)
        throw new Error(`contract '${contract.id}' field '${field.name}' needs numeric sibling '${field.gteField}' in the same unit`);
    }
  }
}

/** Checks a value where a declared port returns it, never by guessing from the value's shape. */
export function assertContractPayload(contract:LegoContract,payload:unknown):void {
  validateContractLaws(contract);
  if(contract.kind==='event'&&contract.fields.length===0&&payload===undefined)return;
  if(!payload||typeof payload!=='object'||Array.isArray(payload))
    throw new Error(`contract '${contract.id}' requires a record payload`);
  const value=payload as Record<string,unknown>,declared=new Set(contract.fields.map(field=>field.name));
  for(const name of Object.keys(value))if(!declared.has(name))
    throw new Error(`contract '${contract.id}' has undeclared field '${name}'`);
  for(const field of contract.fields){
    const item=value[field.name];
    if(item===null&&field.nullable)continue;
    const valid=field.value==='number'?typeof item==='number'&&Number.isFinite(item)
      :field.value==='integer'?typeof item==='number'&&Number.isSafeInteger(item)
      :field.value==='boolean'?typeof item==='boolean'
      :typeof item==='string';
    if(!valid)throw new Error(`contract '${contract.id}' field '${field.name}' must be ${typeof field.value==='string'?field.value:'declared value'}`);
    if(typeof item!=='number')continue;
    if(field.min!==undefined&&item<field.min||field.max!==undefined&&item>field.max)
      throw new Error(`contract '${contract.id}' field '${field.name}'=${item} violates ${field.min??'-∞'}..${field.max??'∞'} ${field.unit??''} [${declaredSite(field)??'source unknown'}]`.trim());
    if(field.gteField!==undefined&&item<(value[field.gteField] as number))
      throw new Error(`contract '${contract.id}' field '${field.name}'=${item} must be >= '${field.gteField}'=${value[field.gteField]} ${field.unit??''} [${declaredSite(field)??'source unknown'}]`.trim());
  }
}

/** The compiled graph, not a second handwritten map, names each port's contract. */
export function portContracts(registry:ProductPortRegistry):ReadonlyMap<string,LegoContract> {
  const contracts=new Map(registry.contracts.map(contract=>[contract.id,contract]));
  return new Map([...registry.nodePorts,...registry.componentPorts].map(entry=>{
    const contract=contracts.get(entry.contractRef);
    if(!contract)throw new Error(`port '${entry.ref}' has no compiled contract '${entry.contractRef}'`);
    return [entry.ref,contract];
  }));
}

export function assertPortPayload(ref:string,value:unknown,contracts?:ReadonlyMap<string,LegoContract>):void {
  if(!contracts)return;
  const contract=contracts.get(ref);
  if(!contract)throw new Error(`port '${ref}' has no declared contract in this observation`);
  assertContractPayload(contract,value);
}
