import { link, lstat, realpath, rm, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { requireThat } from './util.mjs';

/** An explicit private capture file, never a conventional owner-test report. */
export async function saveLiveCapture(root,output,trace) {
  const base=await realpath(root),target=path.resolve(base,output);
  requireThat(target.startsWith(base+path.sep)&&target.endsWith('.studio-trace.json')
    && !path.relative(base,target).split(path.sep).includes('test-results'),
  'live.output','Choose a new .studio-trace.json outside test-results and inside the selected directory.');
  const parent=await realpath(path.dirname(target));
  requireThat((parent===base||parent.startsWith(base+path.sep))
    && !path.relative(base,parent).split(path.sep).includes('test-results'),
    'live.output','Capture destination escapes the selected directory or resolves into test-results.');
  const existing=await lstat(target).catch(error=>error.code==='ENOENT'?null:Promise.reject(error));
  requireThat(!existing,'live.output','Capture destination already exists. Choose a new file.');
  const temporary=path.join(parent,`.studio-capture-${randomBytes(12).toString('hex')}.tmp`);
  try {
    await writeFile(temporary,JSON.stringify(trace,null,2)+'\n',{flag:'wx',mode:0o600});
    await link(temporary,target); // Atomic no-replace, including a concurrent symlink at target.
  } catch(error) {
    if(error.code==='EEXIST')requireThat(false,'live.output','Capture destination already exists. Choose a new file.');
    throw error;
  } finally { await rm(temporary,{force:true}); }
  return {file:path.relative(base,target).split(path.sep).join('/'),captureId:trace.capture.id,through:trace.capture.through};
}
