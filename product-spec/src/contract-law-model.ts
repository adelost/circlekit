import { requireWireId, validateContract, type LegoContract, type LegoField, type LegoFiniteValueDeclaration,
  type LegoFiniteValueRef, type LegoPrimitive, type LegoValueRef } from './node-model.js';
import type { ContractPayload } from './contract-payload.js';
import type { ProductPortRegistry } from './port-graph-model.js';
import { declaredSite } from './source-site.js';

/** A field holding one record of another wire contract, checked by that contract. Only a wire contract carries one. */
export interface LegoContractRef<Contract extends LegoContract = LegoContract> extends LegoValueRef {
  readonly contract: Contract;
}

/** WHAT: Nests one wire contract in another. WHY: A receipt names the record it echoes instead of copying its fields. */
export function contractRef<const Contract extends LegoContract>(contract:Contract):LegoContractRef<Contract> {
  return {ref:contract.id,contract};
}

/** What a list holds: a primitive, a member of one finite declaration, or a record of one wire contract. */
export type LegoListElement = LegoPrimitive | LegoFiniteValueRef | LegoContractRef;

/** A field holding a list of one element kind; a distinct list holds no element twice. Only a wire contract carries one. */
export interface LegoListRef<Element extends LegoListElement = LegoListElement> extends LegoValueRef {
  readonly list: Element;
  readonly distinct: boolean;
}

/** WHAT: Declares a list field. WHY: Ids, scopes and chat turns are checked element by element, never as a free array. */
export function listOf<const Element extends LegoListElement>(element:Element,
  options:{readonly distinct?:boolean}={}):LegoListRef<Element> {
  if(!isListElement(element))throw new Error(`listOf needs a primitive, a finiteValueRef or a contractRef, not ${refName(element)}`);
  const ref=`list.${typeof element==='string'?element:element.ref}`;
  requireWireId(ref,'list ref');
  return {ref,list:element,distinct:options.distinct===true};
}

type FieldValue = LegoField['value'];
const PRIMITIVES:readonly unknown[]=['boolean','integer','number','string'];
const isRecord = (value:unknown):value is Record<string,unknown> =>
  typeof value==='object'&&value!==null&&!Array.isArray(value);
const isFiniteRef = (value:FieldValue):value is LegoFiniteValueRef =>
  typeof value!=='string'&&'finite' in value&&value.finite===true;
const isContractRef = (value:FieldValue):value is LegoContractRef =>
  typeof value!=='string'&&'contract' in value&&isRecord(value.contract);
const isListRef = (value:FieldValue):value is LegoListRef => typeof value!=='string'&&'list' in value;
const isListElement = (value:unknown):value is LegoListElement => typeof value==='string'?PRIMITIVES.includes(value)
  :isRecord(value)&&(isFiniteRef(value as unknown as LegoValueRef)||isContractRef(value as unknown as LegoValueRef));
const refName = (value:unknown):string => typeof value==='string'?`'${value}'`:`'${(value as LegoValueRef)?.ref}'`;
const numeric = (field:LegoField) => field.value==='number'||field.value==='integer';
/** The record a field nests, directly or as the element of its list. */
const nestedOf = (value:FieldValue):LegoContract|undefined => isContractRef(value)?value.contract
  :isListRef(value)&&isContractRef(value.list)?value.list.contract:undefined;

/** WHAT: A contract's identity. WHY: One id names one schema, so every field fact takes part in the comparison. */
export function contractFingerprint(contract:LegoContract):string {
  return JSON.stringify({
    kind:contract.kind,
    boundary:contract.boundary,
    unknownFields:contract.unknownFields??'refuse',
    fields:contract.fields.map(item=>({
      name:item.name,
      value:valueFingerprint(item.value),
      unit:item.unit??null,
      nullable:item.nullable,
      optional:item.optional===true,
      clockDomain:item.clockDomain,
      min:item.min??null,max:item.max??null,gteField:item.gteField??null,
    })),
    navigation:contract.navigation??null,
  });
}

const valueFingerprint = (value:FieldValue):unknown => typeof value==='string'?value
  :isListRef(value)?{list:valueFingerprint(value.list),distinct:value.distinct}
    :isContractRef(value)?{contract:contractFingerprint(value.contract)}:{ref:value.ref,finite:isFiniteRef(value)};

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
    if(field.optional===true&&contract.boundary!=='wire')
      throw new Error(`${where} is optional, which only a wire contract carries: use boundary 'wire'`);
    if(isListRef(value)&&contract.boundary!=='wire')
      throw new Error(`${where} is a list, which only a wire contract carries: use boundary 'wire'`);
    if(isContractRef(value)&&contract.boundary!=='wire')
      throw new Error(`${where} nests contract '${value.contract.id}', which only a wire contract carries: use boundary 'wire'`);
    if(isListRef(value)&&!isListElement(value.list))
      throw new Error(`${where} lists ${refName(value.list)}, which is not a primitive, a finite value or a wire contract`);
    if(contract.boundary==='wire'&&typeof value!=='string'&&!isFiniteRef(value)&&!isContractRef(value)&&!isListRef(value))
      throw new Error(`wire contract '${contract.id}' field '${field.name}' has opaque value ref '${value.ref}'`);
    const nested=nestedOf(value);
    if(nested!==undefined){
      if(nested.boundary!=='wire')throw new Error(`${where} nests '${nested.id}', which is not a wire contract`);
      validateContract(nested);
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
  for(const field of contract.fields){
    const nested=nestedOf(field.value);
    if(nested!==undefined)refuseNesting(nested,[...path,contract.id]);
  }
}

/**
 * A payload that breaks its contract: a bad request or response, never a programming error. `contractId` is the
 * contract that was read and `field` the dotted path from its root (`history[2].role`; '' for the payload itself).
 * A fault in the declaration or the call, such as a finite declaration left out, stays a plain Error.
 */
export class ContractPayloadError extends Error {
  override readonly name='ContractPayloadError';
  constructor(readonly contractId:string,readonly field:string,message:string){super(message);}
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
  const read={members:finiteMembers(contract,finiteDeclarations),root:contract.id};
  return payloadOf(contract,payload,read,'') as ContractPayload<Contract,Values>;
}

interface PayloadRead {
  /** Members of every finite declaration the contract names, nested contracts included. */
  readonly members:ReadonlyMap<string,readonly string[]>;
  /** The contract the read started from, which every ContractPayloadError names. */
  readonly root:string;
}

/** Where a value sits: `local` as its own contract's messages name it, `path` from the root of the read. */
interface Place {readonly local:string;readonly path:string}
const below = (path:string,name:string) => path===''?name:`${path}.${name}`;

/** The one payload check: every declared key read in order, then the sibling laws on the checked values. */
function payloadOf(contract:LegoContract,payload:unknown,read:PayloadRead,path:string):unknown {
  const fail=(at:string,message:string)=>new ContractPayloadError(read.root,at,message);
  if(contract.kind==='event'&&contract.fields.length===0&&payload===undefined)return undefined;
  if(!isRecord(payload))throw fail(path,`contract '${contract.id}' requires a record payload`);
  const declared=new Set(contract.fields.map(field=>field.name));
  if(contract.unknownFields!=='ignore')for(const name of Object.keys(payload))if(!declared.has(name))
    throw fail(below(path,name),`contract '${contract.id}' has undeclared field '${name}'`);
  const present=contract.fields.filter(field=>field.optional!==true||Object.hasOwn(payload,field.name));
  const copy=Object.fromEntries(present.map(field=>{
    const at=below(path,field.name);
    if(!Object.hasOwn(payload,field.name))throw fail(at,`contract '${contract.id}' is missing field '${field.name}'`);
    const item=payload[field.name];
    return [field.name,item===null&&field.nullable?null:valueOf(contract,field,field.value,item,{local:field.name,path:at},read)];
  }));
  for(const field of contract.fields){
    const item=copy[field.name],other=field.gteField===undefined?null:copy[field.gteField];
    if(typeof item==='number'&&typeof other==='number'&&item<other)
      throw fail(below(path,field.name),`contract '${contract.id}' field '${field.name}'=${item} must be >= '${field.gteField}'=${other} ${field.unit??''} [${declaredSite(field)??'source unknown'}]`.trim());
  }
  return copy;
}

/** One value of one kind: a primitive, a finite member, a nested record, or a list of one of those. */
function valueOf(contract:LegoContract,field:LegoField,kind:FieldValue,item:unknown,place:Place,read:PayloadRead):unknown {
  const where=`contract '${contract.id}' field '${place.local}'`;
  const fail=(message:string)=>new ContractPayloadError(read.root,place.path,message);
  if(typeof kind==='string'){
    const problem=primitiveProblem(field,kind,item);
    if(problem!==undefined)throw fail(`${where}${problem}`);
    return item;
  }
  if(isContractRef(kind)){
    if(!isRecord(item))throw fail(`${where} must be a '${kind.contract.id}' record`);
    return payloadOf(kind.contract,item,read,place.path);
  }
  if(isListRef(kind)){
    if(!Array.isArray(item))throw fail(`${where} must be a list`);
    const seen=new Set<unknown>();
    return Array.from(item,(element,index)=>{
      const at={local:`${place.local}[${index}]`,path:`${place.path}[${index}]`};
      const checked=valueOf(contract,field,kind.list,element,at,read);
      const key=isRecord(checked)?JSON.stringify(checked):checked;
      if(kind.distinct&&seen.has(key))
        throw fail(`${where} repeats ${typeof checked==='string'?`'${checked}'`:JSON.stringify(checked)}`);
      seen.add(key);
      return checked;
    });
  }
  const members=isFiniteRef(kind)?read.members.get(kind.ref):undefined;
  if(members===undefined){
    if(item===null)throw fail(`${where} must be nonnullable`);
    return item;
  }
  if(typeof item!=='string'||!members.includes(item))throw fail(`${where} must belong to finite '${kind.ref}'`);
  return item;
}

/** Every finite declaration the contract names needs exactly one nonempty declaration, before any value is read. */
function finiteMembers(contract:LegoContract,finite:readonly LegoFiniteValueDeclaration[],
  members=new Map<string,readonly string[]>()):ReadonlyMap<string,readonly string[]> {
  for(const {value} of contract.fields){
    const element=isListRef(value)?value.list:value,nested=nestedOf(value);
    if(nested!==undefined)finiteMembers(nested,finite,members);
    if(!isFiniteRef(element)||members.has(element.ref))continue;
    const declarations=finite.filter(declaration=>declaration.id===element.ref);
    if(declarations.length!==1||declarations[0]!.values.length===0)
      throw new Error(`finite '${element.ref}' needs exactly one nonempty value declaration`);
    members.set(element.ref,declarations[0]!.values);
  }
  return members;
}

/** What is wrong with a primitive value, as the tail of its message, or undefined when nothing is. */
function primitiveProblem(field:LegoField,kind:LegoPrimitive,item:unknown):string|undefined {
  const valid=kind==='number'?typeof item==='number'&&Number.isFinite(item)
    :kind==='integer'?typeof item==='number'&&Number.isSafeInteger(item)
    :kind==='boolean'?typeof item==='boolean'
    :typeof item==='string';
  if(!valid)return ` must be ${kind}`;
  if(typeof item==='number'&&(field.min!==undefined&&item<field.min||field.max!==undefined&&item>field.max))
    return `=${item} violates ${field.min??'-∞'}..${field.max??'∞'} ${field.unit??''} [${declaredSite(field)??'source unknown'}]`.trim();
  return undefined;
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
