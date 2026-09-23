import { decide as baseDecide, type Decision, type DecisionAxes, type DecisionColumns,
  type DecisionPoint, type DecisionTable } from './decision-table-model.js';
import { step as baseStep, type Machine, type MachineStep } from './machine-model.js';
import { assertPortPayload } from './contract-law-model.js';
import type { LegoContract } from './node-model.js';

export type RawObservation =
  | {kind:'port';phase:'returned';portRef:string}
  | {kind:'decision';phase:'evaluated';facetId:string;cellId:string;facts:Record<string,string>;values:Record<string,unknown>}
  | {kind:'transition';phase:'evaluated';facetId:string;cellId:string|null;from:string;to:string;input:string;guards:Record<string,boolean>};

let activeSink:((event:RawObservation)=>void)|null=null;

/** Install once in an explicitly observed development process. No normal package import uses this sink. */
export function installObservationSink(sink:(event:RawObservation)=>void):()=>void {
  if(activeSink!==null)throw new Error('ProductSpec observation already has one process sink');
  activeSink=sink;
  return ()=>{if(activeSink===sink)activeSink=null;};
}

/** A transport-free, opt-in observation seam. Its callback must only enqueue; no network work belongs in a product call. */
export function createObservationScope({onObservation,onFailure}: {
  onObservation:(event:RawObservation)=>void;onFailure?:(error:unknown)=>void;
}) {
  const emit=(event:RawObservation) => {
    try { onObservation(event); }
    catch(error) { try { onFailure?.(error); } catch { /* Even diagnostic failure cannot change application behavior. */ } }
  };
  const validate=(ref:string,value:unknown,contracts?:ReadonlyMap<string,LegoContract>)=>{
    try {assertPortPayload(ref,value,contracts);}
    catch(error) {try {onFailure?.(error);} catch { /* Diagnostics cannot change a product call. */ }}
  };
  return {
    decide<Axes extends DecisionAxes,Columns extends DecisionColumns>(table:DecisionTable<Axes,Columns>,at:DecisionPoint<Axes>):Decision<Axes,Columns> {
      const result=baseDecide(table,at);
      emit({kind:'decision',phase:'evaluated',facetId:table.id,cellId:result.cell,
        facts:result.at as Record<string,string>,values:result.values as Record<string,unknown>});
      return result;
    },
    step<State extends string,Input extends string,Guard extends string>(
      machine:Machine<State,Input,Guard>,state:State,input:Input,guardsHeld:ReadonlySet<Guard>,
    ):MachineStep<State> {
      const result=baseStep(machine,state,input,guardsHeld);
      emit({kind:'transition',phase:'evaluated',facetId:machine.id,cellId:result.cellId,
        from:state,to:result.to,input,guards:Object.fromEntries(machine.guards.map(guard=>[guard,guardsHeld.has(guard)]))});
      return result;
    },
    bindPortImplementations<Ports extends object>(ports:Ports,contracts?:ReadonlyMap<string,LegoContract>):Ports {
      const methods=new Map<string,{source:Function;wrapped:Function}>();
      let proxy:Ports;
      const wrap=(property:string,value:Function):Function=>{
          const cached=methods.get(property);
          if(cached?.source===value)return cached.wrapped;
          const wrapped=function(this:unknown,...args:unknown[]) {
            const result=Reflect.apply(value,this===proxy?ports:this,args);
            if(result instanceof Promise)void result.then(resolved=>validate(property,resolved,contracts),()=>{});
            else validate(property,result,contracts);
            emit({kind:'port',phase:'returned',portRef:property});
            return result;
          };
          methods.set(property,{source:value,wrapped});return wrapped;
      };
      // The proxy target is an extensible facade. A frozen port owner's own method cannot be
      // replaced by a get trap on that owner: JavaScript requires the exact original value.
      const facade=Object.create(Reflect.getPrototypeOf(ports)) as Ports;
      proxy=new Proxy(facade,{
        get(_target,property) {
          const value=Reflect.get(ports,property,ports);
          return typeof property==='string'&&Object.hasOwn(ports,property)&&typeof value==='function'
            ? wrap(property,value):value;
        },
        set(_target,property,value) {return Reflect.set(ports,property,value,ports);},
        has(_target,property) {return Reflect.has(ports,property);},
        ownKeys() {return Reflect.ownKeys(ports);},
        getOwnPropertyDescriptor(_target,property) {
          const descriptor=Reflect.getOwnPropertyDescriptor(ports,property);
          if(!descriptor)return undefined;
          return 'value' in descriptor&&typeof property==='string'&&typeof descriptor.value==='function'
            ? {...descriptor,configurable:true,value:wrap(property,descriptor.value)}
            : {...descriptor,configurable:true};
        },
        getPrototypeOf() {return Reflect.getPrototypeOf(ports);},
        defineProperty(_target,property,descriptor) {return Reflect.defineProperty(ports,property,descriptor);},
        deleteProperty(_target,property) {return Reflect.deleteProperty(ports,property);},
      });
      return proxy;
    },
  };
}

export const observedScope=createObservationScope({
  onObservation:event=>activeSink?.(event),
  onFailure:error=>console.error(`ProductSpec contract law: ${error instanceof Error?error.message:String(error)}`),
});
