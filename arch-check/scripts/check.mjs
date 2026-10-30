// The gate of the @v1d/arch-check release: the tool finds a planted violation of each kind it ships, holds a clean tree, and keeps its baseline shrink-only.
import {mkdtempSync, mkdirSync, writeFileSync, rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {check} from "../arch-check.mjs";

const root = mkdtempSync(join(tmpdir(), "arch-check-"));
const put = (path, text) => {mkdirSync(join(root, path, ".."), {recursive: true}); writeFileSync(join(root, path), text);};
put("src/big.ts", "const x = 1;\n".repeat(20)); put("src/a.ts", "import {y} from \"./m/inner\";\nexport {y};\n"); put("src/m/inner.ts", "export const y = 1;\n"); put("src/m/index.ts", "export {};\n");
put("src/n1.ts", "export const call = fetch(\"https://x\");\n"); put("src/d1.ts", "const q1 = f(alpha, beta);\nconst q2 = f(gamma, delta);\nconst q3 = f(epsilon, zeta);\nconst q4 = f(eta, theta);\n"); put("src/d2.ts", "const q1 = f(alpha, beta);\nconst q2 = f(gamma, delta);\nconst q3 = f(epsilon, zeta);\nconst q4 = f(eta, theta);\n");
put("layout/known/x.txt", "x"); put("layout/stray/x.txt", "x"); put("layout/.hidden/x.txt", "x"); put("named/good-name.ts", "x"); put("named/good-name.d.ts", "x"); put("named/Bad_Name.ts", "x"); put("named/camelCase.ts", "x");
put("contracts/ok.ts", "/**\n * WHAT: Builds one catalog card with its name, tags and readings.\n * WHY: Keeps every page's card the same instead of each page drawing its own.\n */\nexport const a = 1;\n"); put("contracts/nowhy.ts", "/** WHAT: Draws one catalog card with its name and tags. */\nexport const b = 1;\n"); put("contracts/nocomment.ts", "export const c = 1;\n"); put("contracts/badverb.ts", "/** WHAT: Draws one catalog card with its name and tags.\n * WHY: Keeps every page's card the same instead of each page drawing its own. */\nexport const d = 1;\n");
put("packages/copy/x.txt", "x"); put("data.mjs", "export const data = {items: {one: {list: [1]}}, routes: {a: {x: 0}, b: {y: null, z: 2}, c: {}}};\n");
put("schemas/records.mjs", 'export const KEYS = {source: {duration: {}, fps: {}, recorded: {}, bytes: {}}, clip: {id: {}, label: {}, title: {}, src: {}, t0: {}, t1: {}}, mark: {id: {}, tag: {}, t: {}}, piece: {id: {}, from: {}, to: {}}, recipe: {recipe: {}, fps: {}, size: {}, root: {}}}; export const validateDocument = doc => []; export const PY_VALIDATOR = "schemas/records.py#validate_document"; export const kindOf = path => { const p = path.filter(x => typeof x === \"string\").join(\".\"); return path.length === 0 ? \"recipe\" : p === \"files\" ? \"source\" : p === \"sections.clips\" ? \"clip\" : p === \"events\" && path.length === 3 ? \"mark\" : p === \"pieces\" && path.length === 3 ? \"piece\" : null; };\n');
put("schemas/records.py", 'def validate_document(doc):\n    return []\n');
put("records/copy.js", 'import {validateDocument} from "../schemas/records.mjs";\nvalidateDocument(registry);\nconst source = registry.files[0];\nconst {duration, fps, recorded} = source;\nconst copy = {duration: source.duration, fps: source.fps, recorded: source.recorded};\nconst sourceKeys = ["duration", "fps", "recorded"];\nsourceKeys.map(key => source[key]);\nconst values = [source.duration, source.fps, source.recorded];\n// {duration, fps, recorded} is a comment, not another copy\n');
put("records/features.ts", 'interface Section { id: string; label: string; title: string }\nconst sections: Section[] = [{id: "find", label: "Find", title: "Find the moments"}];\n');
put("records/indirect.js", 'import {validateDocument} from "../schemas/records.mjs";\nvalidateDocument(registry);\nconst source = registry.files[0];\nconst keys = ["duration", "fps", "recorded"];\nconst copy = Object.fromEntries(keys.map(key => [key, source[key]]));\n');
put("records/indirect.py", 'from schemas.records import validate_document\nvalidate_document(registry)\nsource = registry["files"][0]\nkeys = ["duration", "fps", "recorded"]\ncopy = {key: source[key] for key in keys}\n');
put("records/provenance.js", 'import {validateDocument} from "../schemas/records.mjs";\nfunction recipeCopy(recipe) { validateDocument(recipe); const clip = recipe.sections[0].clips[0]; return {id: clip.id, src: clip.src, t0: clip.t0}; }\nfunction solvedCopy(solved) { const clip = solved.clips[0]; return {id: clip.id, src: clip.src, t0: clip.t0}; }\n');
put("records/provenance.py", 'from schemas.records import validate_document\ndef recipe_copy(recipe):\n    validate_document(recipe)\n    clip = recipe["sections"][0]["clips"][0]\n    return {"id": clip.id, "src": clip.src, "t0": clip.t0}\ndef solved_copy(solved):\n    clip = solved["clips"][0]\n    return {"id": clip.id, "src": clip.src, "t0": clip.t0}\n');
put("records/marks.js", 'import {validateDocument} from "../schemas/records.mjs";\nfunction read(marks) { validateDocument(marks); const event = marks[stem].events[0]; return {id: event.id, tag: event.tag, t: event.t}; }\nfunction other(events) { const event = events[0]; return {id: event.id, tag: event.tag, t: event.t}; }\n');
put("records/marks.py", 'from schemas.records import validate_document\ndef read(marks):\n    validate_document(marks)\n    piece = marks[stem]["pieces"][0]\n    return {"id": piece.id, "from": piece["from"], "to": piece.to}\ndef other(pieces):\n    piece = pieces[0]\n    return {"id": piece.id, "from": piece["from"], "to": piece.to}\n');
put("records/writer-sink.js", 'const keys = ["id", "src", "t0"];\nfunction fromEdl(edl) { const doc = {recipe: 3}; const clips = edl.clips.map(clip => Object.fromEntries(keys.map(key => [key, clip[key]]))); doc.sections = [{clips}]; return doc; }\n');
put("records/unrelated-sink.js", 'const keys = ["id", "src", "t0"];\nfunction other(edl) { const clips = edl.clips.map(clip => Object.fromEntries(keys.map(key => [key, clip[key]]))); return {clips}; }\n');
put("records/film-sink.js", 'const filmKeys = ["fps", "size", "root"];\nfunction fromEdl(edl) { const doc = {recipe: 3}; for (const key of filmKeys) doc[key] = edl[key]; return doc; }\n');
put("records/mark-writer.js", 'import {validateDocument} from "../schemas/records.mjs";\nfunction add(marks, stem) { validateDocument(marks); const entry = marks[stem] || (marks[stem] = {}); const events = entry.events || (entry.events = []); events.push({id: "a", tag: "exit", t: 1}); }\nfunction unrelated(events) { events.push({id: "a", tag: "other", t: 1}); }\n');
put("records/mark-intent.js", 'function add(row) { return {type: "insert", path: "pieces", value: {id: row.id, from: row.from, to: row.to}}; }\n');
put("records/mark-writer.py", 'from schemas.records import validate_document\ndef add(marks, stem):\n    validate_document(marks)\n    entry = marks[stem]\n    events = entry["events"]\n    events.append({"id": "a", "tag": "exit", "t": 1})\ndef unrelated(events):\n    events.append({"id": "a", "tag": "other", "t": 1})\n');
put("records/mark-intent.py", 'def add(row):\n    return {"type": "insert", "path": "pieces", "value": {"id": row.id, "from": row["from"], "to": row.to}}\n');
put("records/unrelated-cache.js", 'function ui(cache, key) { const event = cache[key].events[0]; return {id: event.id, tag: event.tag, t: event.t}; }\n');
put("records/unrelated-cache.py", 'def ui(cache, key):\n    event = cache[key]["events"][0]\n    return {"id": event["id"], "tag": event["tag"], "t": event["t"]}\n');
put("records/short.js", 'const copy = {duration: 1, fps: 2};\n');
put("records/copy.py", 'from schemas.records import validate_document\nvalidate_document(registry)\nsource = registry["files"][0]\ndata = {"duration": source.duration, "fps": source.fps, "recorded": source.recorded}\nvalues = [source.duration, source.fps, source.recorded]\n');
const rules = [
  {id: 12, name: "one-record-schema", kind: "record-fields", files: ["records/**/*.js", "records/**/*.ts", "records/**/*.py"], records: [{name: "source", module: "schemas/records.mjs#KEYS.source"}, {name: "clip", module: "schemas/records.mjs#KEYS.clip"}, {name: "mark", module: "schemas/records.mjs#KEYS.mark"}, {name: "piece", module: "schemas/records.mjs#KEYS.piece"}, {name: "film", module: "schemas/records.mjs#KEYS.recipe"}], fix: "import the schema"},
  {id: 1, name: "small-files", kind: "max-lines", files: "src/**/*.ts", max: 10, fix: "split"}, {id: 2, name: "small-folders", kind: "max-files", files: "src/*.ts", max: 3, fix: "move"},
  {id: 3, name: "module-edges", kind: "modules", files: "src/**/*.ts", modules: [{dir: "src/m", imports: []}], fix: "use index"}, {id: 4, name: "pattern", kind: "pattern", files: "src/**/*.ts", pattern: "fetch\\(", fix: "adapter"},
  {id: 5, name: "absent", kind: "absent", paths: ["packages/copy"], fix: "remove"}, {id: 6, name: "duplicates", kind: "duplicates", files: "src/**/*.ts", lines: 4, fix: "one helper"},
  {id: 10, name: "folders", kind: "folders", in: "layout", allow: ["known"], fix: "move it under a listed folder or list it"},
  {id: 11, name: "names", kind: "names", files: "named/*", pattern: "^[a-z0-9]+(-[a-z0-9]+)*(\\.[a-z0-9]+)+$", fix: "kebab-case, then the extensions"},
  {id: 9, name: "contract", kind: "contract", files: "contracts/*.ts", fix: "begin the file with WHAT: and WHY:"},
  {id: 7, name: "count", kind: "count", module: "data.mjs", export: "data", path: "items.*.list", min: 2, fix: "add"},
  {id: 8, name: "any-of", kind: "count", module: "data.mjs", export: "data", paths: ["routes.*.x", "routes.*.z"], min: 1, fix: "price it"}];
try {
  const {red, counts} = await check(root, {rules});
  for (const {id} of rules) if (!red.some(line => line.startsWith(`rule ${id} `))) throw new Error(`rule ${id} did not find its planted violation`);
  const record = red.filter(line => line.startsWith("rule 12 "));
  const sourceHits = record.filter(line => line.includes(" source:")), clipHits = record.filter(line => line.includes(" clip:"));
  if (sourceHits.length !== 8 || clipHits.length !== 3 || record.filter(line => line.includes(" mark:")).length !== 3 || record.filter(line => line.includes(" piece:")).length !== 1 || record.filter(line => line.includes(" film:")).length !== 1 || !record.some(line => line.includes("film-sink.js:1")) || !clipHits.some(line => line.includes("records/writer-sink.js:1")) || !clipHits.some(line => line.includes("records/provenance.js:2")) || !clipHits.some(line => line.includes("records/provenance.py:5")) || record.some(line => line.includes("unrelated-cache.py") || line.includes("unrelated-cache.js") || line.includes("mark-writer.py:8") || line.includes("mark-writer.js:3") || line.includes("unrelated-sink.js") || line.includes("features.ts") || line.includes("short.js") || line.includes("provenance.js:3") || line.includes("provenance.py:8") || line.includes("marks.js:3") || line.includes("marks.py:8")) || !record.every(line => line.includes("schemas/records.mjs"))) throw new Error(`record fields: expected 8 source and 2 real recipe copies, no unrelated section or solved clip; got ${record.join(" | ")}`);
  const missingSchema = await check(root, {rules: [{...rules[0], records: [{name: "source", module: "schemas/missing.mjs#KEYS.source"}]}]}).then(() => null, error => error);
  if (!missingSchema) throw new Error("a missing schema cannot make the rule pass");
  const anyOf = red.filter(line => line.startsWith("rule 8 "));
  if (anyOf.length !== 1 || !anyOf[0].includes("c has fewer")) throw new Error("count with paths: a 0 and a value count as there, only the item with neither is red");
  const stray = red.filter(line => line.startsWith("rule 10 "));
  if (stray.length !== 1 || !stray[0].includes("layout/stray")) throw new Error("folders: only the folder that is not listed is red (not a listed one, not a dot folder)");
  const badNames = red.filter(line => line.startsWith("rule 11 "));
  if (badNames.length !== 2 || !badNames.every(line => /Bad_Name|camelCase/.test(line)) || red.some(line => line.startsWith("rule 11 ") && /good-name/.test(line))) throw new Error("names: the two badly spelt files are red, kebab-case and .d.ts are not");
  const contract = red.filter(line => line.startsWith("rule 9 "));
  if (contract.length !== 3 || !contract.some(line => line.includes("contracts/badverb.ts") && line.includes("unknown verb")) || !contract.some(line => line.includes("contracts/nowhy.ts") && line.includes("no WHY:")) || !contract.some(line => line.includes("contracts/nocomment.ts")) || contract.some(line => line.includes("contracts/ok.ts"))) throw new Error("contract: a file with no WHY, a file with no comment and a file whose WHAT opens with an unknown verb are red, a file with both and the right words is green");
  const noAmux = await check(root, {rules: rules.filter(rule => rule.kind === "contract")}, {}, {amuxRoot: join(root, "no-amux-here")}).then(() => null, error => error);
  if (!noAmux || !String(noAmux.message).includes("AMUX was not found")) throw new Error("contract: without AMUX the run must stop, never pass");
  const held = await check(root, {rules}, counts);
  if (held.red.length) throw new Error(`a baseline of today's counts must hold: ${held.red[0]}`);
  const shrunk = await check(root, {rules}, {...counts, "1:src/big.ts": counts["1:src/big.ts"] + 5});
  if (!shrunk.red.some(line => line.startsWith("baseline 1:src/big.ts"))) throw new Error("a baseline above today's count must be red (it may only shrink)");
  const grown = await check(root, {rules}, {...counts, "1:src/big.ts": counts["1:src/big.ts"] - 1});
  if (!grown.red.some(line => line.startsWith("rule 1 "))) throw new Error("more than the baseline allows must be red");
  console.log(`arch-check: ${rules.length} kinds found, baseline holds and only shrinks`);
} finally {rmSync(root, {recursive: true, force: true});}
