import { validateContract, type LegoContract, type LegoField, type LegoFiniteValueDeclaration } from './node-model.js';
import type { ContractPayload } from './contract-payload.js';
import type { ProductPortRegistry } from './port-graph-model.js';
import { declaredSite } from './source-site.js';

const numeric = (field:LegoField) => field.value==='number'||field.value==='integer';

/** WHAT: Checks portable field laws. WHY: Keeps each bound inside its contract and opaque values off the wire. */
export function validateContractLaws(contract:LegoContract):void {
  const fields=new Map(contract.fields.map(field=>[field.name,field]));
  for(const field of contract.fields){
    if(contract.boundary==='wire'&&typeof field.value!=='string'
      && (!('finite' in field.value)||field.value.finite!==true))
      throw new Error(`wire contract '${contract.id}' field '${field.name}' has opaque value ref '${field.value.ref}'`);
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

/** WHAT: Checks and narrows a declared payload. WHY: Keeps TypeScript promises aligned with runtime checks. */
export function assertContractPayload<const Contract extends LegoContract,
  const Values extends readonly LegoFiniteValueDeclaration[] = readonly []>(
  contract:Contract,payload:unknown,finiteDeclarations:Values=[] as unknown as Values,
):asserts payload is ContractPayload<Contract,Values> {
  validateContract(contract);
  if(contract.kind==='event'&&contract.fields.length===0&&payload===undefined)return;
  if(!payload||typeof payload!=='object'||Array.isArray(payload))
    throw new Error(`contract '${contract.id}' requires a record payload`);
  const value=payload as Record<string,unknown>,declared=new Set(contract.fields.map(field=>field.name));
  for(const name of Object.keys(value))if(!declared.has(name))
    throw new Error(`contract '${contract.id}' has undeclared field '${name}'`);
  for(const field of contract.fields){
    if(!Object.hasOwn(value,field.name))throw new Error(`contract '${contract.id}' is missing field '${field.name}'`);
    const item=value[field.name];
    if(typeof field.value!=='string'){
      if('finite' in field.value&&field.value.finite===true){
        const ref=field.value.ref;
        const declarations=finiteDeclarations.filter(declaration=>declaration.id===ref);
        if(declarations.length!==1||declarations[0]!.values.length===0)
          throw new Error(`finite '${field.value.ref}' needs exactly one nonempty value declaration`);
        if(item===null&&field.nullable)continue;
        if(typeof item!=='string'||!declarations[0]!.values.includes(item))
          throw new Error(`contract '${contract.id}' field '${field.name}' must belong to finite '${field.value.ref}'`);
      }else if(item===null&&!field.nullable){
        throw new Error(`contract '${contract.id}' field '${field.name}' must be nonnullable`);
      }
      continue;
    }
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

/** What an observed port is checked against: its compiled contract and the finite declarations it names. */
export interface PortContracts {
  readonly contracts:ReadonlyMap<string,LegoContract>;
  readonly finiteValues:readonly LegoFiniteValueDeclaration[];
}

/**
 * The compiled graph, not a second handwritten map, names each port's contract. Pass the finite
 * declarations its fields name (a product's `finiteValues`, plus its libraries'); a missing one is
 * refused here, never reported later as a broken payload.
 */
export function portContracts(registry:ProductPortRegistry,
  finiteValues:readonly LegoFiniteValueDeclaration[]=[]):PortContracts {
  const declarations=new Map<string,LegoFiniteValueDeclaration>();
  for(const declaration of finiteValues){
    const known=declarations.get(declaration.id);
    if(known!==undefined&&known!==declaration)throw new Error(`finite '${declaration.id}' is passed to portContracts twice`);
    declarations.set(declaration.id,declaration);
  }
  const contracts=new Map(registry.contracts.map(contract=>[contract.id,contract]));
  for(const contract of contracts.values())for(const field of contract.fields){
    if(typeof field.value==='string'||!('finite' in field.value)||field.value.finite!==true)continue;
    if(!declarations.has(field.value.ref))throw new Error(`port contract '${contract.id}' field '${field.name}' `
      +`names finite '${field.value.ref}' without its declaration; pass it to portContracts`);
  }
  return {
    contracts:new Map([...registry.nodePorts,...registry.componentPorts].map(entry=>{
      const contract=contracts.get(entry.contractRef);
      if(!contract)throw new Error(`port '${entry.ref}' has no compiled contract '${entry.contractRef}'`);
      return [entry.ref,contract];
    })),
    finiteValues:[...declarations.values()],
  };
}

export function assertPortPayload(ref:string,value:unknown,ports?:PortContracts):void {
  if(!ports)return;
  const contract=ports.contracts.get(ref);
  if(!contract)throw new Error(`port '${ref}' has no declared contract in this observation`);
  assertContractPayload(contract,value,ports.finiteValues);
}
