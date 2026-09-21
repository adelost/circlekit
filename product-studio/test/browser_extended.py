"""Extended architecture/source/trace journeys over the actual app and HTTP server.

The synthetic fixture intentionally does not claim to be a native product. Direct
HTTP is the default. --http-bridge is an explicit constrained-browser fallback,
not proof of normal browser CSP/module loading or the published package install.
"""
import argparse,json,subprocess,urllib.request,urllib.error
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--chromium');p.add_argument('--http-bridge',action='store_true');p.add_argument('--output',default='test-results/extended');args=p.parse_args()
out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
process=subprocess.Popen(['node','test/serve-fixture.mjs'],cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
checks=[];errors=[];requests=[]
try:
    first=process.stdout.readline()
    if not first: raise RuntimeError(process.stderr.read())
    fixture=json.loads(first)
    def bridge(url,options=None):
        options=options or {}
        if not url.startswith('/api/'):raise ValueError('Only local Studio API routes are bridged.')
        requests.append(url);data=options.get('body')
        req=urllib.request.Request(fixture['origin']+url,data=data.encode() if isinstance(data,str) else None,method=options.get('method','GET'),headers=options.get('headers',{}))
        try:
            with urllib.request.urlopen(req,timeout=20) as r:return {'body':r.read().decode(),'status':r.status}
        except urllib.error.HTTPError as e:return {'body':e.read().decode(),'status':e.code}
    def check(name,truth):
        if not truth:page.screenshot(path=str(out/'failure.png'),full_page=True)
        assert truth,name
        checks.append(name)
    with sync_playwright() as pw:
        opts={'headless':True}
        if args.chromium:opts['executable_path']=args.chromium
        browser=pw.chromium.launch(**opts);page=browser.new_page(viewport={'width':1600,'height':1120},accept_downloads=True)
        page.on('pageerror',lambda e:errors.append(str(e)))
        if args.http_bridge:
            page.expose_function('__studioHttp',bridge)
            html=(ROOT/'public/index.html').read_text().replace('<link rel="stylesheet" href="/style.css">','<style>'+(ROOT/'public/style.css').read_text()+'</style>').replace('<script type="module" src="/app.js"></script>','')
            page.set_content(html)
            page.evaluate("""()=>{window.fetch=async(url,options)=>{const r=await window.__studioHttp(url,options||{});return new Response(r.body,{status:r.status,headers:{'content-type':'application/json'}})}}""")
            graph=(ROOT/'public/graph.js').read_text().replace('export function drawGraph','function drawGraph')
            tools=(ROOT/'public/studio-tools.js').read_text().replace('export function ','function ')
            app=(ROOT/'public/app.js').read_text().replace("import { drawGraph } from './graph.js';",'').replace("import { architectureControls, sourceNavigator, entityInspector, traceView, installDocumentState } from './studio-tools.js';",'')
            page.add_script_tag(type='module',content=graph+'\n'+tools+'\n'+app)
        else:page.goto(fixture['origin'])
        page.wait_for_selector('#project')
        page.locator('#project').select_option(label='Architecture example');page.wait_for_selector('[data-view="System"]');page.locator('[data-view="System"]').click()
        page.wait_for_selector('#query-from')
        check('A generated inspection bundle attaches an arbitrary product',page.locator('.graph-node').count()==4)
        page.locator('#query-from').select_option('node::ingest.reader');page.locator('#query-to').select_option('component::screen.preview');page.locator('[data-query="path"]').click()
        page.wait_for_function("document.querySelector('main').textContent.includes('4 selected entities')")
        check('Shortest path follows three actual bindings','3 binding edges' in page.locator('main').inner_text())
        check('Scope caption renders numeric coverage, not a template expression','${' not in page.locator('.risk-caption').first.inner_text())
        page.screenshot(path=str(out/'architecture.png'),full_page=True)
        page.locator('#architecture-mode').select_option('domains');page.wait_for_function("document.querySelectorAll('.graph-node').length===3")
        check('Semantic group view uses explicit exported groups',page.locator('.graph-node').count()==3)
        page.locator('#architecture-mode').select_option('owners');page.wait_for_function("document.querySelectorAll('.graph-node').length===4")
        page.locator('.graph-node[aria-label^="processing.transform,"]').click();page.wait_for_selector('[data-source-entity="node::processing.transform"]')
        page.locator('[data-source-entity="node::processing.transform"]').click();page.wait_for_selector('#source-editor')
        selection=page.locator('#source-editor').evaluate('(e)=>e.value.slice(e.selectionStart,e.selectionEnd)')
        check('Graph node opens its exact source span','processing.transform' in selection)
        check('Code editor has actual source and line navigation',page.locator('#line-gutter').inner_text().startswith('1\n2\n3'))
        before=page.locator('#source-editor').input_value();page.locator('#source-editor').fill(before+'\n// uncommitted studio draft')
        page.locator('[data-view="Logic"]').click();page.locator('[data-view="Changes"]').click()
        check('Code draft is retained when changing views',page.locator('#source-editor').input_value().endswith('// uncommitted studio draft'))
        page.screenshot(path=str(out/'source.png'),full_page=True)
        page.locator('[data-view="Trace"]').click();page.locator('#trace-import').set_input_files(fixture['traceFile'])
        page.wait_for_function("document.querySelector('main').textContent.includes('5 retained events')")
        check('Trace import verifies identity and retains synthetic evidence label','Synthetic trace' in page.locator('main').inner_text())
        page.locator('[data-trace-sequence="2"]').first.click();page.wait_for_function("document.querySelector('main').textContent.includes('Logic comparison: consistent')")
        check('Recorded cell and values checked against matching kernel','Logic comparison: consistent' in page.locator('main').inner_text())
        check('Causal view follows explicit parents',page.locator('details[open] [data-trace-sequence]').count()==3)
        page.screenshot(path=str(out/'trace.png'),full_page=True)
        page.locator('[data-action="trace-first"]').click();page.wait_for_function("document.querySelector('main').textContent.includes('#0 · message')")
        check('Backward trace navigation does not run product logic','#0 · message' in page.locator('main').inner_text())
        page.locator('#project').select_option(label='AMUX · policies');page.wait_for_selector('[data-fact="need"]')
        page.locator('[data-cell="within-policy"]').click();page.locator('[data-action="split-region"]').click();page.locator('#split-axis').select_option('readiness');page.locator('#split-values').fill('["SAFE"]');page.locator('#split-id').fill('within-policy-safe');page.locator('#split-form button[type="submit"]').click()
        page.wait_for_selector('[data-action="simulate-draft"]:enabled')
        check('Semantic region split produces validated ordinary source','within-policy-safe' in page.locator('#source-editor').input_value())
        page.locator('[data-action="simulate-draft"]').click();page.wait_for_selector('[data-fact="readiness"]')
        page.locator('[data-fact="need"]').select_option('NONE');page.locator('[data-fact="readiness"]').select_option('SAFE');page.locator('[data-action="evaluate"]').click()
        page.wait_for_function("document.querySelector('.notice.success')?.textContent.includes('within-policy-safe')")
        check('New split cell returns original policy output','CONTINUE' in page.locator('.result-big').inner_text())
        page.locator('[data-view="Scenarios"]').click();page.locator('[data-action="save-scenario"]').click();page.wait_for_function("document.querySelector('#toast').textContent.includes('Scenario saved locally')")
        page.locator('[data-action="open-scenarios"]').click();page.wait_for_selector('[data-scenario-id]:enabled');page.locator('[data-scenario-id]:enabled').first.click();page.wait_for_function("!document.querySelector('dialog').open")
        check('Scenario save/reopen roundtrip uses the same model',json.loads(page.locator('#scenario-editor').input_value())['facetId']=='amux.context-cost')
        page.locator('[data-action="run-scenario"]').click();page.wait_for_function("document.querySelector('main').textContent.includes('0 independent assertions supplied')")
        check('No-assertion run is not marked as proven passing','"assertionStatus": "unasserted"' in page.locator('main').inner_text())
        for width in [1600,1024,720,390]:
            page.set_viewport_size({'width':width,'height':1050});page.wait_for_timeout(60)
            check('Extended view has no page overflow at '+str(width),page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
        check('No application JavaScript errors',not errors)
        browser.close()
    report={'mode':'http-bridge' if args.http_bridge else 'direct-http','kernel':fixture['kernelVersion'],'checks':checks,'errors':errors,'apiRequests':len(requests)}
    (out/'report.json').write_text(json.dumps(report,indent=2));print(json.dumps({'passed':len(checks),'errors':errors,'kernel':fixture['kernelVersion']},indent=2))
finally:
    process.terminate()
    try:process.wait(timeout=10)
    except subprocess.TimeoutExpired:process.kill()
