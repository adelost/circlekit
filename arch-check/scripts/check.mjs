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
const rules = [
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
