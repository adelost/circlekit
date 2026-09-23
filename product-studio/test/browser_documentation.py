"""Direct HTTP acceptance for type-owned intent and scoped reported evidence."""
import json
import subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
ROOT=Path(__file__).resolve().parents[1]
process=subprocess.Popen(['node','test/serve-documentation-fixture.mjs'],cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
checks=[]
try:
    first=process.stdout.readline()
    if not first:
        raise RuntimeError(process.stderr.read())
    fixture=json.loads(first)
    source=Path(fixture['root'])/'src/reader.ts'
    original=source.read_bytes()
    with sync_playwright() as pw:
        browser=pw.chromium.launch()
        page=browser.new_page(viewport={'width':1600,'height':1100})
        errors=[]
        page.on('pageerror',lambda e: errors.append(str(e)))
        page.goto(fixture['origin'])
        page.locator('.view-menu summary').click()
        page.locator('[data-exp="intent"]').click()
        expect(page.get_by_role('heading',name='Intent & behavior',exact=True)).to_be_visible()
        expect(page.locator('main')).to_contain_text('Routes recorded input to the processing boundary.')
        expect(page.locator('main')).to_contain_text('Keeps input acquisition outside transforms and presentation.')
        expect(page.locator('main')).to_contain_text('matched-source')
        expect(page.locator('main')).to_contain_text('wording not evaluated')
        checks.append('Exact source WHAT/WHY is visible, without fabricated grammar validation')
        page.locator('[data-doc-section="legacy"]').click()
        expect(page.locator('main')).to_contain_text('OLD_READER')
        expect(page.locator('main')).to_contain_text('Reads one input on its legacy clock.')
        checks.append('Legacy reason stays separate from ProductSpec type identity')
        page.locator('[data-doc-section="reports"]').click()
        expect(page.locator('main')).to_contain_text('one recorded input')
        expect(page.locator('main')).to_contain_text('the reader receives demand')
        expect(page.locator('main')).to_contain_text('the input is delivered once')
        expect(page.locator('main')).to_contain_text('skipped')
        expect(page.locator('main')).to_contain_text('unit')
        expect(page.locator('main')).to_contain_text('not executed service coverage')
        checks.append('BDD descriptions, original levels and skipped results stay distinct')
        page.locator('main [data-doc-file="test/reader.test.ts"]').click()
        expect(page.locator('#source-editor')).to_be_visible()
        expect(page.locator('#source-editor')).to_have_value("// Association fixture, not executed by Studio.\ntest('sends once',()=>{deliver('ingest.reader.frames');});\n")
        checks.append('Reported test opens its actual attached source')
        page.locator('[data-view="System"]').click()
        page.locator('.graph-node[aria-label^="ingest.reader,"]').click()
        expect(page.locator('[aria-label="Type intent"]')).to_contain_text('Routes recorded input to the processing boundary.')
        expect(page.locator('[aria-label="Type intent"]')).to_contain_text('node-type::example.reader')
        page.locator('[aria-label="Type intent"] summary').filter(has_text='Declared reality').click()
        expect(page.locator('[aria-label="Type intent"]')).to_contain_text('processing.transform')
        checks.append('Node inspector joins the owning type with actual declared consumers')
        assert not errors,errors
        assert source.read_bytes()==original
        checks.append('No application JavaScript errors or product-source writes')
        browser.close()
    print(json.dumps({'mode':'direct-http','synthetic':True,'passed':len(checks),'checks':checks}))
finally:
    process.terminate()
    try:process.wait(timeout=10)
    except subprocess.TimeoutExpired:process.kill()
