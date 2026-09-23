import { decide as baseDecide, type Decision, type DecisionAxes, type DecisionColumns,
  type DecisionPoint, type DecisionTable } from './decision-table-model.js';
import { step as baseStep, type Machine, type MachineStep } from './machine-model.js';

export type RawObservation =
  | {kind:'port';phase:'returned';portRef:string}
  | {kind:'decision';phase:'evaluated';facetId:string;cellId:string;facts:Record<string,string>;values:Record<string,unknown>}
  | {kind:'transition';phase:'evaluated';facetId:string;cellId:string|null;from:string;to:string;input:string;guards:Record<string,boolean>};

/** A transport-free, opt-in observation seam. Its callback must only enqueue; no network work belongs in a product call. */
export function createObservationScope({onObservation,onFailure}: {
  onObservation:(event:RawObservation)=>void;onFailure?:(error:unknown)=>void;
}) {
  const emit=(event:RawObservation) => {
    try { onObservation(event); }
    catch(error) { try { onFailure?.(error); } catch { /* Even diagnostic failure cannot change application behavior. */ } }
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
    bindPortImplementations<Ports extends object>(ports:Ports):Ports {
      const methods=new Map<PropertyKey,Function>();
      let proxy:Ports;
      proxy=new Proxy(ports,{
        get(target,property,receiver) {
          const value=Reflect.get(target,property,receiver);
          if(typeof property!=='string'||!Object.hasOwn(target,property)||typeof value!=='function')return value;
          const cached=methods.get(property);
          if(cached) return cached;
          const wrapped=function(this:unknown,...args:unknown[]) {
            const result=Reflect.apply(value,this===proxy?target:this,args);
            emit({kind:'port',phase:'returned',portRef:property});
            return result;
          };
          methods.set(property,wrapped);return wrapped;
        },
      });
      return proxy;
    },
  };
}
