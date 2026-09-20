"""Compile/test the real family-model.ts in a temporary directory; no repo changes.
Usage: python check-family.py /path/to/circlekit/product-spec/src/family-model.ts
Requires locally installed tsc and node. It does not install packages or use network.
"""
from pathlib import Path
import hashlib, json, shutil, subprocess, sys, tempfile

def main():
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    source = Path(sys.argv[1]).resolve()
    raw = source.read_bytes()
    blob = hashlib.sha1(f'blob {len(raw)}\0'.encode()+raw).hexdigest()
    checks=[]
    with tempfile.TemporaryDirectory(prefix='productspec-family-') as tmp:
        d=Path(tmp)
        (d/'family-model.ts').write_bytes(raw)
        base=['tsc','--strict','--target','ES2022','--module','commonjs','--outDir',str(d/'compiled')]
        def compile_case(name,code,expected_code):
            p=d/f'{name}.ts'; p.write_text(code)
            r=subprocess.run(base+[str(p)],text=True,capture_output=True,timeout=30)
            ok=(r.returncode==0) if expected_code==0 else (r.returncode!=0 and 'TS2322' in r.stdout)
            checks.append({'id':name,'passed':ok,'exit':r.returncode,'stdout':r.stdout,'stderr':r.stderr})
        compile_case('literal-inference', '''import { family } from './family-model';
const make = family({ category: 'CONDITIONS', shape: 'WHOLE_JUMP' });
const row = make({ id: 'night', label: 'NIGHT' });
const category: 'CONDITIONS' = row.category;
const name: 'night' = row.id;
''',0)
        compile_case('restatement-rejected', '''import { family } from './family-model';
const make = family({ category: 'CONDITIONS' });
make({ id: 'night', category: 'CONDITIONS' });
''',1)
        (d/'runtime.cjs').write_text('''const assert=require('node:assert/strict');
const {family}=require('./compiled/family-model.js');
const make=family({category:'CONDITIONS',shape:'WHOLE_JUMP'});
assert.deepEqual(make({id:'night'}),{category:'CONDITIONS',shape:'WHOLE_JUMP',id:'night'});
assert.throws(()=>make({id:'night',category:'CONDITIONS'}), /restates/);
assert.throws(()=>make({id:'night',category:'OTHER'}), /restates/);
console.log('runtime: valid merge and both redundant/conflicting restatements checked');
''')
        r=subprocess.run(['node',str(d/'runtime.cjs')],capture_output=True,text=True,timeout=10)
        checks.append({'id':'runtime-data-and-refusals','passed':r.returncode==0,'stdout':r.stdout,'stderr':r.stderr})
    report={'source':str(source.name),'git_blob':blob,'scope':'Entire real family module only; not the full ProductSpec compiler, published package or native emitter.',
      'node':subprocess.check_output(['node','--version'],text=True).strip(),
      'tsc':subprocess.check_output(['tsc','--version'],text=True).strip(),'checks':checks,
      'passed':sum(x['passed'] for x in checks),'failed':sum(not x['passed'] for x in checks)}
    print(json.dumps(report,ensure_ascii=False,indent=2))
    return int(report['failed']>0)
if __name__=='__main__': sys.exit(main())
