"""Browser acceptance for the actual workbench, not the earlier storyboard.

Start npm start separately. Normal mode navigates to the HTTP server directly.
--http-bridge is for managed browsers that prohibit localhost navigation: the
same UI module bytes execute in-memory and requests use the actual local server
through Python's HTTP client. It does not test browser CSP/network integration.
"""
import argparse
import json
import urllib.request
import urllib.error
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
p = argparse.ArgumentParser()
p.add_argument('--url', default='http://127.0.0.1:4317')
p.add_argument('--chromium', default=None)
p.add_argument('--http-bridge', action='store_true')
p.add_argument('--output', default='test-results')
args = p.parse_args()
out = Path(args.output); out.mkdir(parents=True, exist_ok=True)
requests = []; failures = []; checks = []

def http_request(url, options=None):
    options = options or {}
    if not isinstance(url, str) or not url.startswith('/api/'):
        raise ValueError('Test bridge accepts only relative Studio API requests.')
    requests.append(url)
    data = options.get('body')
    req = urllib.request.Request(args.url + url, data=data.encode() if isinstance(data,str) else None,
        headers=options.get('headers', {}), method=options.get('method', 'GET'))
    try:
        with urllib.request.urlopen(req, timeout=20) as response:
            return {'body': response.read().decode(), 'status': response.status}
    except urllib.error.HTTPError as e:
        return {'body': e.read().decode(), 'status': e.code}

def check(name, condition):
    if not condition:
        page.screenshot(path=str(out/"failure.png"),full_page=True)
        print(page.evaluate("[...document.querySelectorAll('*')].filter(e=>e.getBoundingClientRect().right > innerWidth+1).slice(0,15).map(e=>({tag:e.tagName,cls:e.className,w:e.getBoundingClientRect().width,right:e.getBoundingClientRect().right}))"))
    assert condition, name
    checks.append(name)

with sync_playwright() as pw:
    options = {'headless':True}
    if args.chromium: options['executable_path'] = args.chromium
    browser = pw.chromium.launch(**options)
    page = browser.new_page(viewport={'width':1600, 'height':1100}, accept_downloads=True)
    page.on('pageerror', lambda e: failures.append(str(e)))
    if args.http_bridge:
        page.expose_function('__studioHttp', http_request)
        html = (ROOT/'public/index.html').read_text()
        html = html.replace('<link rel="stylesheet" href="/style.css">', '<style>'+ (ROOT/'public/style.css').read_text()+'</style>')
        html = html.replace('<script type="module" src="/app.js"></script>','')
        page.set_content(html)
        page.evaluate("""() => { window.fetch = async (url, options) => {
            const r = await window.__studioHttp(url, options || {});
            return new Response(r.body, {status:r.status,headers:{'content-type':'application/json'}});
        }; }""")
        graph = (ROOT/'public/graph.js').read_text().replace('export function drawGraph','function drawGraph')
        app = (ROOT/'public/app.js').read_text().replace("import { drawGraph } from './graph.js';",'')
        page.add_script_tag(type='module',content=graph+'\n'+app)
    else:
        page.goto(args.url)
    page.wait_for_selector('#machine-state')
    check('English document',page.locator('html').get_attribute('lang')=='en')
    check('Four available sample selections',all(label in page.locator('#project option').all_text_contents() for label in ['Request lifecycle · example','AMUX · policies','Pipeline · example','Showcase · catalog excerpt']))
    page.locator('[data-action="step"]').click()
    page.wait_for_function("document.querySelector('#machine-state').value === 'PENDING'")
    check('Real machine step: Send -> PENDING', 'IDLE → PENDING' in page.locator('.result-big').inner_text())
    page.locator('#machine-input').select_option('Response')
    page.locator('[data-action="step"]').click()
    page.wait_for_selector('.notice.warning')
    check('Unknown guards stop the step','Supply the missing guard facts' in page.locator('.notice.warning').inner_text())
    page.locator('[data-guard="CURRENT_REQUEST"]').select_option('true')
    page.locator('[data-guard="RESPONSE_OK"]').select_option('true')
    page.locator('[data-action="step"]').click()
    page.wait_for_function("document.querySelector('#machine-state').value === 'SUCCESS'")
    check('Explicit facts select reply-success','reply-success' in page.locator('.notice.success').inner_text())
    page.screenshot(path=str(out/'logic.png'),full_page=True)
    for name in ['System','Scenarios','Interface','Changes','Logic']:
        page.locator(f'[data-view="{name}"]').click()
        check('View: '+name,page.locator(f'[data-view="{name}"]').get_attribute('aria-current')=='page')
    page.locator('[data-action="edit-source"]').click()
    before=page.locator('#source-editor').input_value()
    after=before.replace("id: 'reply-failure', from: 'PENDING', on: 'Response', to: 'FAILURE'", "id: 'reply-failure', from: 'PENDING', on: 'Response', to: 'SUCCESS'")
    check('Test actually changes a literal',before != after)
    page.locator('#source-editor').fill(after)
    page.locator('[data-action="validate"]').click()
    page.wait_for_selector('[data-action="simulate-draft"]:enabled')
    check('Source draft accepted through kernel', page.locator('[data-action="patch"]').is_enabled())
    original_key=page.locator('#project').input_value()
    page.locator('#project').select_option(label='AMUX · policies')
    page.wait_for_selector('[data-fact="need"]')
    page.locator('[data-fact="need"]').select_option('UNKNOWN')
    page.locator('[data-action="evaluate"]').click()
    page.wait_for_selector('.result-big')
    check('Actual AMUX HOLD result', 'HOLD' in page.locator('.result-big').inner_text())
    page.wait_for_function("document.querySelectorAll('.table-wrap:last-child tbody tr').length >= 18")
    page.screenshot(path=str(out/'policy.png'),full_page=True)
    page.locator('#project').select_option(original_key)
    page.wait_for_selector('#source-editor')
    check('Draft survives switching products',page.locator('#source-editor').input_value()==after)
    page.locator('[data-action="save"]').click()
    page.wait_for_function("document.querySelector('#toast').textContent.includes('Draft saved')")
    with page.expect_download() as info:
        page.locator('[data-action="patch"]').click()
    patch=info.value; patch.save_as(str(out/'source.patch'))
    check('Patch is actual changed source','reply-failure' in (out/'source.patch').read_text())
    page.screenshot(path=str(out/'changes.png'),full_page=True)
    page.locator('[data-action="simulate-draft"]').click()
    page.wait_for_function("document.querySelector('#project option:checked').textContent.startsWith('Candidate')")
    check('Candidate is a separate project',page.locator('#project').input_value()!=original_key)
    page.locator('[data-view="Scenarios"]').click()
    mock = json.loads(page.locator('#mock-editor').input_value())
    page.locator('[data-action="run-mocks"]').click()
    page.wait_for_function("document.querySelector('main.content').textContent.includes('Synthetic boundary only')")
    check('Fixture requests run without external calls','No real service' in page.locator('main.content').inner_text())
    mock['fixtures']=[]
    page.locator('#mock-editor').fill(json.dumps(mock))
    page.locator('[data-action="run-mocks"]').click()
    page.wait_for_function("document.querySelector('#toast').textContent.includes('No mock configured')")
    check('Mock miss is a visible refusal','External calls are disabled' in page.locator('#toast').inner_text())
    page.locator('#project').select_option(label='Showcase · catalog excerpt')
    page.wait_for_selector('[data-case="control.action-row"]')
    page.locator('[data-case="control.action-row"]').click()
    check('Real public Showcase catalog inspected','Local action counts' in page.locator('.inspector').inner_text())
    page.locator('#file-import').set_input_files({'name':'broken.ts','mimeType':'text/plain','buffer':b'export const broken = {'})
    page.wait_for_function("document.querySelector('#project option:checked').textContent === 'broken.ts'")
    page.wait_for_selector('#source-editor')
    check('Invalid imported source remains editable',not page.locator('#source-editor').get_attribute('readonly'))
    page.locator('#source-editor').fill((ROOT/'fixtures/workflow.ts').read_text())
    page.locator('[data-action="validate"]').click()
    page.wait_for_selector('[data-action="simulate-draft"]:enabled')
    check('Invalid file can be corrected and validated',page.locator('[data-action="patch"]').is_enabled())
    page.locator('[data-action="simulate-draft"]').click()
    page.wait_for_selector('[data-action="add-cell"]')
    page.locator('[data-action="add-cell"]').click()
    page.locator('#transition-id').fill('retry')
    page.locator('#transition-from').select_option('FAILURE')
    page.locator('#transition-on').select_option('Send')
    page.locator('#transition-to').select_option('PENDING')
    page.locator('#transition-form button[type="submit"]').click()
    page.wait_for_selector('[data-action="simulate-draft"]:enabled')
    check('Visual transition insertion yields validated source','"retry"' in page.locator('#source-editor').input_value())
    page.locator('[data-action="simulate-draft"]').click()
    page.wait_for_selector('#machine-state')
    page.locator('#machine-state').select_option('FAILURE')
    page.locator('#machine-input').select_option('Send')
    page.locator('[data-action="step"]').click()
    page.wait_for_function("document.querySelector('#machine-state').value === 'PENDING'")
    check('The newly authored transition actually executes','retry' in page.locator('.notice.success').inner_text())
    page.locator('#project').select_option(original_key)
    page.locator('[data-view="Logic"]').click()
    for width in [1600,1024,720,390]:
        page.set_viewport_size({'width':width,'height':1000})
        page.wait_for_timeout(60)
        check('No page overflow at '+str(width),page.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'))
    page.set_viewport_size({'width':1600,'height':1100})
    check('No JavaScript runtime errors', not failures)
    (out/'browser-report.json').write_text(json.dumps({'mode':'in-memory modules + real HTTP API' if args.http_bridge else 'direct HTTP browser','checks':checks,'javascriptErrors':failures,'apiRequests':len(requests)},indent=2))
    print(json.dumps({'passed':len(checks),'mode':'http-bridge' if args.http_bridge else 'direct-http','errors':failures},indent=2))
    browser.close()
