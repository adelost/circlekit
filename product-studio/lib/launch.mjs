import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { access } from 'node:fs/promises';
import { main as studio } from '../bin/studio.mjs';
import { requireThat } from './util.mjs';

const kitRoot=fileURLToPath(new URL('../../',import.meta.url));

/**
 * WHAT: Starts the shared workbench or explicit contract check from an existing product checkout.
 * WHY: Keeps product launchers small without installing packages or starting application runtimes.
 */
export async function launch({root,amuxRoot,args=process.argv.slice(2),output=process.stdout}) {
  const command=args[0]&&!args[0].startsWith('-')?args[0]:'serve';
  const rest=command===args[0]?args.slice(1):args;
  if(command==='help'||rest.includes('--help')) {
    output.write('node studio.mjs [serve|check|doctor|inspect|query|source|simulate|scenario|trace] [options]\n');
    output.write('Set STUDIO_ROOT and AMUX_ROOT only for non-sibling checkouts. Opening Studio never installs, builds, tests or starts a product.\n');
    return 0;
  }
  requireThat(['serve','check','doctor','inspect','query','source','simulate','scenario','trace'].includes(command),
    'cli.usage','Unknown Studio command; run node studio.mjs help.');
  if(command==='check')return studio(['contracts',root,'--amux-root',amuxRoot,'--pretty',...rest],{stdout:output});
  const selected=[command,root,'--amux-root',amuxRoot,...rest];
  if(command==='serve'&&path.resolve(root)!==path.resolve(kitRoot)) {
    try { await access(path.join(kitRoot,'studio.workspace.json')); selected.push('--workspace',kitRoot); } catch {}
  }
  return studio(selected,{stdout:output});
}
