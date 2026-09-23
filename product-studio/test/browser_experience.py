"""Direct-browser experience regressions. Start the real server separately.
No HTTP bridge or synthetic browser-module loader is used by this test.
"""
import argparse
import json
from playwright.sync_api import sync_playwright, expect
p=argparse.ArgumentParser()
p.add_argument('--url',default='http://127.0.0.1:4317')
args=p.parse_args()
with sync_playwright() as pw:
    browser=pw.chromium.launch()
    page=browser.new_page(viewport={'width':1600,'height':1000})
    errors=[]
    page.on('pageerror',lambda e: errors.append(str(e)))
    page.goto(args.url)
    page.locator('#project').select_option(label='Request lifecycle · example')
    expect(page.locator('#machine-state')).to_be_visible()
    page.evaluate("window.originalGraph=document.querySelector('.graph-svg')")
    page.locator('[data-action="zoom-in"]').click()
    camera=page.locator('.graph-svg > g').get_attribute('transform')
    page.locator('#machine-input').select_option('Inspect')
    assert page.evaluate("window.originalGraph===document.querySelector('.graph-svg')")
    assert page.locator('.graph-svg > g').get_attribute('transform')==camera
    page.locator('[data-action="edit-source"]').click()
    editor=page.locator('#source-editor')
    expect(editor).to_be_visible()
    editor.click()
    page.evaluate("window.originalEditor=document.querySelector('#source-editor')")
    # A Problems visit retains draft ownership and can return via normal history.
    page.locator('[data-exp="problems"]').click()
    expect(page.get_by_role('heading',name='Problems & evidence',exact=True)).to_be_visible()
    page.go_back()
    expect(editor).to_be_visible()
    page.keyboard.press('Control+Shift+P')
    expect(page.locator('#command-search')).to_be_visible()
    page.locator('#command-search').fill('request')
    expect(page.locator('[data-object]').first).to_be_visible()
    page.keyboard.press('Escape')
    assert not page.locator('#dialog').is_visible()
    page.locator('[data-exp="bookmark"]').click()
    page.locator('.view-menu summary').click()
    page.locator('[data-exp="bookmarks"]').click()
    expect(page.locator('[data-bookmark]').first).to_be_visible()
    page.locator('[data-close]').click()
    for width in [1600,1024,720,390]:
        page.set_viewport_size({'width':width,'height':1000})
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), width
    assert not errors, errors
    print(json.dumps({'javascriptErrors':errors,'checks':'camera identity, navigation, source access, palette, saved view, widths','mode':'direct-http'}))
    browser.close()
