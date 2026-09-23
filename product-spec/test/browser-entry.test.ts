import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

/** The exact emitted browser import graph, not a source-file naming guess. */
test('the ProductSpec root does not reach a Node builtin',async()=>{
  const visited=new Set<string>();
  async function walk(url:URL) {
    if(visited.has(url.href))return;
    visited.add(url.href);
    const text=await readFile(url,'utf8');
    for(const match of text.matchAll(/(?:from\s*|import\s*)["']([^"']+)["']/gu)) {
      const specifier=match[1]!;
      assert.equal(specifier.startsWith('node:'),false,`${url.pathname} imports ${specifier}`);
      if(specifier.startsWith('./')||specifier.startsWith('../'))await walk(new URL(specifier,url));
    }
  }
  await walk(new URL('../src/index.js',import.meta.url));
  await walk(new URL('../src/observed.js',import.meta.url));
  await walk(new URL('../src/browser-observation.js',import.meta.url));
  assert.ok(visited.size>10,'the check must traverse the actual root graph');
});
