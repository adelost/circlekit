// story-fix.mjs: --fix for story-order (4a) and stepdown (4b), Cut row 1873 (sandman:0 8 Nov): it moves whole top-level functions, with the comments
// directly above them, and changes no line. A function moves only past code that does not run it at load; a function declaration, being hoisted,
// moves freely. A file whose result does not hold the same lines, or has more breaches, is left as it was.
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {aboveCallers, exportList, functionsOf, helpersAbove, holding, inlineExport, lineOf, parsed, privateAbove, pythonUnits, referencesIn, tsUnits, typescriptOf} from "./story.mjs";

const CODE = /\.(js|mjs|cjs|ts|tsx|mts|cts)$/;

/** Fixes each named file that a story-order or stepdown rule covers (`covers(rule, file)`); one line per file it changed or could not change. */
export function fixStory(root, config, files, covers) {
  const rules = config.rules.filter(rule => rule.kind === "story-order" || rule.kind === "stepdown"), told = [];
  for (const file of files.filter(f => CODE.test(f) || f.endsWith(".py"))) {
    const wants = {order: rules.some(r => r.kind === "story-order" && covers(r, file)), step: rules.some(r => r.kind === "stepdown" && covers(r, file))};
    if (!wants.order && !wants.step) continue;
    const text = readFileSync(join(root, file), "utf8"), story = storyOf(root, file, text);
    if (story.broken) { told.push(`${file}: not read (it does not parse)`); continue; }
    const {moved, stuck, lines} = reorder(text.split("\n"), story, wants);
    if (!moved.length) { if (stuck.length) told.push(`${file}: left ${stuck.join(", ")} (moving would pass code that runs it at load)`); continue; }
    const after = lines.join("\n"), kept = storyOf(root, file, after);
    if ([...text.split("\n")].sort().join("\n") !== [...lines].sort().join("\n") || kept.broken || (kept.faults ?? 0) > (story.faults ?? 0) || breaches(kept, wants) > breaches(story, wants)) {
      told.push(`${file}: not changed, the moves did not hold`); continue;
    }
    writeFileSync(join(root, file), after);
    told.push(`${file}: moved ${moved.join(", ")}${stuck.length ? `; left ${stuck.join(", ")} (it would pass code that runs it at load)` : ""}`);
  }
  return told;
}

/** A file's statements as items (lines, name, exported, hoisted, the file's functions it uses at load) and its function graph. */
function storyOf(root, file, text) {
  return file.endsWith(".py") ? pythonStory(file, text) : scriptStory(root, file, text);
}

function scriptStory(root, file, text) {
  const ts = typescriptOf(root), src = parsed(ts, file, text, true), {units, tiered} = tsUnits(ts, file, text), names = new Set(units.map(u => u.name));
  const lineAt = pos => lineOf(src, null, pos), listed = exportList(ts, src);
  const items = src.statements.map(s => {
    const fns = functionsOf(ts, s), whole = ts.isFunctionDeclaration(s) || (ts.isVariableStatement(s) && fns.length === s.declarationList.declarations.length);
    const quiet = whole || ts.isImportDeclaration(s) || ts.isInterfaceDeclaration(s) || ts.isTypeAliasDeclaration(s) || ts.isExportDeclaration(s);
    return {start: lineAt(s.getStart(src)), end: lineAt(s.getEnd()), name: whole && fns.length === 1 ? fns[0].name : null, exported: !listed && inlineExport(ts, s),
      hoisted: ts.isFunctionDeclaration(s), load: quiet ? [] : referencesIn(ts, s, names)};
  });
  return {units, tiered, items, fours: helpersAbove(ts, file, text).length, faults: src.parseDiagnostics.length};
}

/** Python's story through python3, from a copy in a folder of its own, so the text read need not be on disk. A file Python cannot parse is broken. */
function pythonStory(file, text) {
  const dir = mkdtempSync(join(tmpdir(), "story-fix-"));
  try {
    writeFileSync(join(dir, "file.py"), text);
    const [{units, items}] = pythonUnits({root: dir}, ["file.py"]);
    return {units: units.filter(u => u.kind === "def"), tiered: true, python: true, fours: privateAbove(units).length,
      items: items.map(i => ({...i, exported: !!i.name && !i.name.startsWith("_"), hoisted: false}))};
  } catch { return {broken: true}; } finally { rmSync(dir, {recursive: true, force: true}); }
}

function breaches(story, {order, step}) {
  return (order ? story.fours : 0) + (step ? aboveCallers(story.units, story.tiered).length : 0);
}

/** The lines in the new order, the functions moved, and those left because a move would pass code that runs them at load. */
function reorder(lines, story, {order, step}) {
  const blocks = blocksOf(lines, story.items, story.python), unit = new Map(story.units.map(u => [u.name, u])), holds = holding(story.units, story.tiered);
  const calls = new Map(story.units.map(u => [u.name, u.calls])), moved = [], stuck = new Set();
  const reach = block => { const seen = new Set(block.load); for (const name of seen) for (const next of calls.get(name) ?? []) seen.add(next); return seen; };
  const target = i => {
    const b = blocks[i];
    if (!b.name || stuck.has(b.name)) return -1;
    const last = blocks.findLastIndex(x => x.exported && (!story.python || x.kind === "def"));   // Python's last public def, JS's last inline export
    if (order && story.tiered && !b.exported && i < last && (unit.has(b.name) || story.python)) return last;
    const callers = step && unit.has(b.name) ? blocks.map((x, k) => k > i && x.name && unit.has(x.name) && unit.get(x.name).calls.includes(b.name) && holds(unit.get(x.name), unit.get(b.name)) ? k : -1) : [];
    return Math.max(-1, ...callers);
  };
  for (let round = 0; round < blocks.length * blocks.length; round++) {
    const i = blocks.findIndex((_, k) => target(k) > k);
    if (i < 0) break;
    const to = target(i), b = blocks[i];
    if (!b.hoisted && blocks.slice(i + 1, to + 1).some(x => reach(x).has(b.name))) { stuck.add(b.name); continue; }
    blocks.splice(to + 1, 0, ...blocks.splice(i, 1));
    if (!moved.includes(b.name)) moved.push(b.name);
  }
  return {moved, stuck: [...stuck], lines: [...blocks.head, ...blocks.flatMap((b, k) => [...(blocks.seps[k] ?? []), ...b.lines]), ...blocks.tail]};
}

/** The items as blocks of whole lines: the lines between two items go with the second, but its leading blank lines stay where they are (`seps`),
 *  so the spacing of the file keeps its places; the comments directly above the first item go with it unless they reach line 1 (the file's head).
 *  Items that share a line are one block that never moves. */
function blocksOf(lines, items, python) {
  const comment = python ? /^\s*#/ : /^\s*(\/\/|\/\*|\*)/, blocks = [];
  for (const item of items) {
    const prev = blocks.at(-1);
    if (prev && item.start <= prev.end) { Object.assign(prev, {end: Math.max(prev.end, item.end), name: null, load: [...prev.load, ...item.load]}); continue; }
    let from = item.start;
    if (!prev) { while (from > 1 && comment.test(lines[from - 2])) from--; if (from === 1) from = item.start; }
    blocks.push({...item, from: prev ? prev.end + 1 : from});
  }
  const seps = blocks.map((b, k) => {
    const all = lines.slice(b.from - 1, k + 1 < blocks.length ? blocks[k + 1].from - 1 : b.end), blank = k ? all.findIndex(line => line.trim()) : 0;
    b.lines = all.slice(Math.max(0, blank));
    return all.slice(0, Math.max(0, blank));
  });
  return Object.assign(blocks, {seps, head: lines.slice(0, (blocks[0]?.from ?? lines.length + 1) - 1), tail: blocks.length ? lines.slice(blocks.at(-1).end) : []});
}
