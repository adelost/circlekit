/** V8 stack provenance for a declaration call, mapped to authored TypeScript when the host enables source maps. */
const declaredSites=new WeakMap<object,string>();

export function declarationSite(owner:Function):string {
  const trace=new Error();
  const capture=(Error as unknown as {captureStackTrace?:(error:Error,owner:Function)=>void}).captureStackTrace;
  if(capture)capture(trace,owner);
  const frame=trace.stack?.split('\n')[capture?1:3]?.trim() ?? '';
  const location=/\(([^()]+\.(?:ts|js):\d+:\d+)\)$/u.exec(frame)?.[1]
    ?? /^at (\S+\.(?:ts|js):\d+:\d+)$/u.exec(frame)?.[1];
  const match=location&&/(.+\.(?:ts|js)):(\d+):(\d+)$/u.exec(location);
  return match?`${match[1]!.replace(/^file:\/\//u,'')}:${match[2]}`:'source unknown';
}

export function rememberDeclarationSite(value:object,site:string):void {declaredSites.set(value,site);}
export function declaredSite(value:object):string|undefined {return declaredSites.get(value);}
export function rememberCallsite<T extends object>(value:T,owner:Function):T {
  rememberDeclarationSite(value,declarationSite(owner));
  return value;
}
