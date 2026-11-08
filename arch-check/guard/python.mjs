// The imports of one Python file, resolved to the repository files they load (a module file or a package's __init__.py); a library outside the repository resolves to nothing. row 1785.
import { posix } from 'node:path';

const BLANK = text => text.replace(/("""|''')[\s\S]*?\1/g, block => block.replace(/[^\n]/g, ' '));   // a docstring's lines are not imports
const IMPORT = /^[ \t]*(?:from[ \t]+(\.*)([\w.]*)[ \t]+import\b[ \t]*(\([^)]*\)|[^\n]*)|import[ \t]+([\w., \t]+?)(?:[ \t]+as\b[^\n]*)?[ \t]*(?:#[^\n]*)?$)/gm;

/** `roots` are the folders absolute imports start from (src for src/pkg/mod.py); `known` is the set of repository files. */
export function pythonTargets(text, file, roots, known) {
  const fileOf = path => [`${path}.py`, `${path}/__init__.py`].find(p => known.has(p)) ?? null;
  const starts = dots => dots ? [posix.join(posix.dirname(file), ...Array(dots.length - 1).fill('..'))] : roots;
  const found = new Set();
  for (const [, dots, from, names, plain] of BLANK(text).matchAll(IMPORT)) {
    if (plain !== undefined) {   // import a.b.c, d.e
      for (const dotted of plain.split(',').map(one => one.trim()).filter(Boolean)) {
        const parts = dotted.split('.');
        for (const start of roots) for (let n = parts.length; n > 0; n--) { const hit = fileOf(posix.join(start, ...parts.slice(0, n))); if (hit) { found.add(hit); n = 0; } }
      }
      continue;
    }
    const parts = from ? from.split('.') : [];
    for (const start of starts(dots)) {
      const base = posix.join(start, ...parts);
      const listed = names.replace(/#[^\n]*/g, '').replace(/\bas\s+\w+/g, '').replace(/[()]/g, ' ').split(/[,\s]+/).filter(name => /^\w+$/.test(name));
      const own = fileOf(base);
      if (own) found.add(own);
      for (const name of listed) { const sub = fileOf(`${base}/${name}`); if (sub) found.add(sub); }
    }
  }
  found.delete(file);
  return [...found];
}
