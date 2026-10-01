import { requireWireId, validateContract, type LegoContract, type LegoField, type LegoFiniteValueDeclaration,
  type LegoFiniteValueRef, type LegoPrimitive, type LegoValueRef } from './node-model.js';
import type { ContractPayload } from './contract-payload.js';
import type { ProductPortRegistry } from './port-graph-model.js';
import { declaredSite } from './source-site.js';

/** A field holding distinct members of one finite declaration, in no order. Only a wire contract carries one. */
export interface LegoFiniteSetRef<Id extends string = string> extends LegoValueRef {
  readonly ref: Id;
  readonly finiteSet: true;
}

/** WHAT: Declares a finite set field. WHY: Scopes are checked member by member, never as a free string array. */
export function finiteSetRef<const Id extends string>(ref:Id):LegoFiniteSetRef<Id> {
  requireWireId(ref,'finite set ref');
  return {ref,finiteSet:true};
}

type FieldValue = LegoField['value'];
const isFiniteRef = (value:FieldValue):value is LegoFiniteValueRef =>
  typeof value!=='string'&&'finite' in value&&value.finite===true;
const isFiniteSetRef = (value:FieldValue):value is LegoFiniteSetRef =>
  typeof value!=='string'&&'finiteSet' in value&&value.finiteSet===true;
const numeric = (field:LegoField) => field.value==='number'||field.value==='integer';

/** WHAT: A contract's identity. WHY: One id names one schema, so every field fact takes part in the comparison. */
export function contractFingerprint(contract:LegoContract):string {
  return JSON.stringify({
    kind:contract.kind,
    boundary:contract.boundary,
    fields:contract.fields.map(item=>({
      name:item.name,
      value:typeof item.value==='string'?item.value
        :{ref:item.value.ref,finite:isFiniteRef(item.value),finiteSet:isFiniteSetRef(item.value)},
      unit:item.unit??null,
      nullable:item.nullable,
      clockDomain:item.clockDomain,
      min:item.min??null,max:item.max??null,gteField:item.gteField??null,
    })),
    navigation:contract.navigation??null,
  });
}

/** WHAT: Checks portable field laws. WHY: Keeps each bound inside its contract and opaque values off the wire. */
export function validateContractLaws(contract:LegoContract):void {
  const fields=new Map(contract.fields.map(field=>[field.name,field]));
  for(const field of contract.fields){
    if(isFiniteSetRef(field.value)&&contract.boundary!=='wire')
      throw new Error(`contract '${contract.id}' field '${field.name}' is a finite set, which only a wire contract carries: use boundary 'wire'`);
    if(contract.boundary==='wire'&&typeof field.value!=='string'&&!isFiniteRef(field.value)&&!isFiniteSetRef(field.value))
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
  payloadOf(contract,payload,finiteDeclarations);
}

/** The one payload check: every declared field read in order, then the sibling laws on the checked values. */
function payloadOf(contract:LegoContract,payload:unknown,finite:readonly LegoFiniteValueDeclaration[]):unknown {
  if(contract.kind==='event'&&contract.fields.length===0&&payload===undefined)return undefined;
  if(!payload||typeof payload!=='object'||Array.isArray(payload))
    throw new Error(`contract '${contract.id}' requires a record payload`);
  const value=payload as Record<string,unknown>,declared=new Set(contract.fields.map(field=>field.name));
  for(const name of Object.keys(value))if(!declared.has(name))
    throw new Error(`contract '${contract.id}' has undeclared field '${name}'`);
  const read=Object.fromEntries(contract.fields.map(field=>[field.name,fieldOf(contract,field,value,finite)]));
  for(const field of contract.fields){
    const item=read[field.name],other=field.gteField===undefined?null:read[field.gteField];
    if(typeof item==='number'&&typeof other==='number'&&item<other)
      throw new Error(`contract '${contract.id}' field '${field.name}'=${item} must be >= '${field.gteField}'=${other} ${field.unit??''} [${declaredSite(field)??'source unknown'}]`.trim());
  }
  return read;
}

function fieldOf(contract:LegoContract,field:LegoField,value:Record<string,unknown>,
  finite:readonly LegoFiniteValueDeclaration[]):unknown {
  if(!Object.hasOwn(value,field.name))throw new Error(`contract '${contract.id}' is missing field '${field.name}'`);
  const item=value[field.name],kind=field.value;
  const members=isFiniteRef(kind)||isFiniteSetRef(kind)?finiteMembers(kind.ref,finite):undefined;
  if(item===null&&field.nullable)return null;
  if(typeof kind==='string')return primitiveOf(contract,field,kind,item);
  const where=`contract '${contract.id}' field '${field.name}'`;
  if(members===undefined){
    if(item===null)throw new Error(`${where} must be nonnullable`);
    return item;
  }
  const member=(candidate:unknown):string=>{
    if(typeof candidate!=='string'||!members.includes(candidate))throw new Error(`${where} must belong to finite '${kind.ref}'`);
    return candidate;
  };
  if(!isFiniteSetRef(kind))return member(item);
  if(!Array.isArray(item))throw new Error(`${where} must be a set of finite '${kind.ref}'`);
  const seen=new Set<string>();
  for(const candidate of item){
    if(seen.has(member(candidate)))throw new Error(`${where} repeats '${candidate}'`);
    seen.add(candidate);
  }
  return [...item];
}

function finiteMembers(ref:string,finite:readonly LegoFiniteValueDeclaration[]):readonly string[] {
  const declarations=finite.filter(declaration=>declaration.id===ref);
  if(declarations.length!==1||declarations[0]!.values.length===0)
    throw new Error(`finite '${ref}' needs exactly one nonempty value declaration`);
  return declarations[0]!.values;
}

function primitiveOf(contract:LegoContract,field:LegoField,kind:LegoPrimitive,item:unknown):unknown {
  const valid=kind==='number'?typeof item==='number'&&Number.isFinite(item)
    :kind==='integer'?typeof item==='number'&&Number.isSafeInteger(item)
    :kind==='boolean'?typeof item==='boolean'
    :typeof item==='string';
  if(!valid)throw new Error(`contract '${contract.id}' field '${field.name}' must be ${kind}`);
  if(typeof item==='number'&&(field.min!==undefined&&item<field.min||field.max!==undefined&&item>field.max))
    throw new Error(`contract '${contract.id}' field '${field.name}'=${item} violates ${field.min??'-∞'}..${field.max??'∞'} ${field.unit??''} [${declaredSite(field)??'source unknown'}]`.trim());
  return item;
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
