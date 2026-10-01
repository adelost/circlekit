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

/** A field holding one record of another wire contract, checked by that contract. Only a wire contract carries one. */
export interface LegoContractRef<Contract extends LegoContract = LegoContract> extends LegoValueRef {
  readonly contract: Contract;
}

/** WHAT: Nests one wire contract in another. WHY: A receipt names the record it echoes instead of copying its fields. */
export function contractRef<const Contract extends LegoContract>(contract:Contract):LegoContractRef<Contract> {
  return {ref:contract.id,contract};
}

type FieldValue = LegoField['value'];
const isFiniteRef = (value:FieldValue):value is LegoFiniteValueRef =>
  typeof value!=='string'&&'finite' in value&&value.finite===true;
const isFiniteSetRef = (value:FieldValue):value is LegoFiniteSetRef =>
  typeof value!=='string'&&'finiteSet' in value&&value.finiteSet===true;
const isContractRef = (value:FieldValue):value is LegoContractRef =>
  typeof value!=='string'&&'contract' in value&&isRecord(value.contract);
const isRecord = (value:unknown):value is Record<string,unknown> =>
  typeof value==='object'&&value!==null&&!Array.isArray(value);
const numeric = (field:LegoField) => field.value==='number'||field.value==='integer';

/** WHAT: A contract's identity. WHY: One id names one schema, so every field fact takes part in the comparison. */
export function contractFingerprint(contract:LegoContract):string {
  return JSON.stringify({
    kind:contract.kind,
    boundary:contract.boundary,
    unknownFields:contract.unknownFields??'refuse',
    fields:contract.fields.map(item=>({
      name:item.name,
      value:typeof item.value==='string'?item.value
        :{ref:item.value.ref,finite:isFiniteRef(item.value),finiteSet:isFiniteSetRef(item.value),
          contract:isContractRef(item.value)?contractFingerprint(item.value.contract):null},
      unit:item.unit??null,
      nullable:item.nullable,
      optional:item.optional===true,
      clockDomain:item.clockDomain,
      min:item.min??null,max:item.max??null,gteField:item.gteField??null,
    })),
    navigation:contract.navigation??null,
  });
}

/** WHAT: Checks portable field laws. WHY: Keeps each bound inside its contract and opaque values off the wire. */
export function validateContractLaws(contract:LegoContract):void {
  const fields=new Map(contract.fields.map(field=>[field.name,field]));
  const policy:unknown=contract.unknownFields;
  if(policy!==undefined&&policy!=='refuse'&&policy!=='ignore')
    throw new Error(`contract '${contract.id}' unknownFields must be 'refuse' or 'ignore'`);
  if(policy==='ignore'&&contract.boundary!=='wire')
    throw new Error(`contract '${contract.id}' unknownFields 'ignore' is for a wire contract only: remove it or use boundary 'wire'`);
  refuseNesting(contract,[]);
  for(const field of contract.fields){
    const where=`contract '${contract.id}' field '${field.name}'`,value=field.value;
    if(isFiniteSetRef(value)&&contract.boundary!=='wire')
      throw new Error(`${where} is a finite set, which only a wire contract carries: use boundary 'wire'`);
    if(isContractRef(value)&&contract.boundary!=='wire')
      throw new Error(`${where} nests contract '${value.contract.id}', which only a wire contract carries: use boundary 'wire'`);
    if(contract.boundary==='wire'&&typeof value!=='string'&&!isFiniteRef(value)&&!isFiniteSetRef(value)&&!isContractRef(value))
      throw new Error(`wire contract '${contract.id}' field '${field.name}' has opaque value ref '${value.ref}'`);
    if(isContractRef(value)){
      if(value.contract.boundary!=='wire')throw new Error(`${where} nests '${value.contract.id}', which is not a wire contract`);
      validateContract(value.contract);
    }
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

/** WHAT: Refuses a contract that nests itself. WHY: Every read and every emitter would recurse forever. */
function refuseNesting(contract:LegoContract,path:readonly string[]):void {
  const start=path.indexOf(contract.id);
  if(start>=0)throw new Error(`contract '${contract.id}' nests itself: ${[...path.slice(start),contract.id].join(' -> ')}`);
  for(const field of contract.fields)if(isContractRef(field.value))refuseNesting(field.value.contract,[...path,contract.id]);
}

/** WHAT: Checks and narrows a declared payload in place. WHY: The same check as a read, for a value already in hand. */
export function assertContractPayload<const Contract extends LegoContract,
  const Values extends readonly LegoFiniteValueDeclaration[] = readonly []>(
  contract:Contract,payload:unknown,finiteDeclarations:Values=[] as unknown as Values,
):asserts payload is ContractPayload<Contract,Values> {
  readContractPayload(contract,payload,finiteDeclarations);
}

/**
 * WHAT: Reads a wire value as its contract allows and returns the checked copy. A read never invents a key: an absent
 * optional key stays absent, an undeclared key is dropped under unknownFields "ignore" and refused otherwise, and a
 * nested record is read by its own contract. WHY: A server reads a request and a client a response by one rule.
 */
export function readContractPayload<const Contract extends LegoContract,
  const Values extends readonly LegoFiniteValueDeclaration[] = readonly []>(
  contract:Contract,payload:unknown,finiteDeclarations:Values=[] as unknown as Values,
):ContractPayload<Contract,Values> {
  validateContract(contract);
  return payloadOf(contract,payload,{members:finiteMembers(contract,finiteDeclarations)}) as ContractPayload<Contract,Values>;
}

interface PayloadRead {
  /** Members of every finite declaration the contract names, nested contracts included. */
  readonly members:ReadonlyMap<string,readonly string[]>;
}

/** The one payload check: every declared key read in order, then the sibling laws on the checked values. */
function payloadOf(contract:LegoContract,payload:unknown,read:PayloadRead):unknown {
  if(contract.kind==='event'&&contract.fields.length===0&&payload===undefined)return undefined;
  if(!isRecord(payload))throw new Error(`contract '${contract.id}' requires a record payload`);
  const declared=new Set(contract.fields.map(field=>field.name));
  if(contract.unknownFields!=='ignore')for(const name of Object.keys(payload))if(!declared.has(name))
    throw new Error(`contract '${contract.id}' has undeclared field '${name}'`);
  const present=contract.fields.filter(field=>field.optional!==true||Object.hasOwn(payload,field.name));
  const copy=Object.fromEntries(present.map(field=>[field.name,fieldOf(contract,field,payload,read)]));
  for(const field of contract.fields){
    const item=copy[field.name],other=field.gteField===undefined?null:copy[field.gteField];
    if(typeof item==='number'&&typeof other==='number'&&item<other)
      throw new Error(`contract '${contract.id}' field '${field.name}'=${item} must be >= '${field.gteField}'=${other} ${field.unit??''} [${declaredSite(field)??'source unknown'}]`.trim());
  }
  return copy;
}

function fieldOf(contract:LegoContract,field:LegoField,value:Record<string,unknown>,read:PayloadRead):unknown {
  if(!Object.hasOwn(value,field.name))throw new Error(`contract '${contract.id}' is missing field '${field.name}'`);
  const item=value[field.name],kind=field.value;
  if(item===null&&field.nullable)return null;
  if(typeof kind==='string')return primitiveOf(contract,field,kind,item);
  const where=`contract '${contract.id}' field '${field.name}'`;
  if(isContractRef(kind)){
    if(!isRecord(item))throw new Error(`${where} must be a '${kind.contract.id}' record`);
    return payloadOf(kind.contract,item,read);
  }
  const members=read.members.get(kind.ref);
  if(members===undefined||!(isFiniteRef(kind)||isFiniteSetRef(kind))){
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

/** Every finite declaration the contract names needs exactly one nonempty declaration, before any value is read. */
function finiteMembers(contract:LegoContract,finite:readonly LegoFiniteValueDeclaration[],
  members=new Map<string,readonly string[]>()):ReadonlyMap<string,readonly string[]> {
  for(const {value} of contract.fields){
    if(isContractRef(value))finiteMembers(value.contract,finite,members);
    if(!isFiniteRef(value)&&!isFiniteSetRef(value)||members.has(value.ref))continue;
    const declarations=finite.filter(declaration=>declaration.id===value.ref);
    if(declarations.length!==1||declarations[0]!.values.length===0)
      throw new Error(`finite '${value.ref}' needs exactly one nonempty value declaration`);
    members.set(value.ref,declarations[0]!.values);
  }
  return members;
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
