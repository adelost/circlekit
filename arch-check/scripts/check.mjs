// The gate of the @v1d/arch-check release: the tool finds a planted violation of each kind it ships, holds a clean tree, and keeps its baseline shrink-only.
import {mkdtempSync, mkdirSync, writeFileSync, rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {check} from "../arch-check.mjs";

const root = mkdtempSync(join(tmpdir(), "arch-check-"));
const put = (path, text) => {mkdirSync(join(root, path, ".."), {recursive: true}); writeFileSync(join(root, path), text);};
put("src/big.ts", "const x = 1;\n".repeat(20)); put("src/a.ts", "import {y} from \"./m/inner\";\nexport {y};\n"); put("src/m/inner.ts", "export const y = 1;\n"); put("src/m/index.ts", "export {};\n");
put("src/n1.ts", "export const call = fetch(\"https://x\");\n"); put("src/d1.ts", "const q1 = f(alpha, beta);\nconst q2 = f(gamma, delta);\nconst q3 = f(epsilon, zeta);\nconst q4 = f(eta, theta);\n"); put("src/d2.ts", "const q1 = f(alpha, beta);\nconst q2 = f(gamma, delta);\nconst q3 = f(epsilon, zeta);\nconst q4 = f(eta, theta);\n");
put("packages/copy/x.txt", "x"); put("data.mjs", "export const data = {items: {one: {list: [1]}}, routes: {a: {x: 0}, b: {y: null, z: 2}, c: {}}};\n");
const rules = [
  {id: 1, name: "small-files", kind: "max-lines", files: "src/**/*.ts", max: 10, fix: "split"}, {id: 2, name: "small-folders", kind: "max-files", files: "src/*.ts", max: 3, fix: "move"},
  {id: 3, name: "module-edges", kind: "modules", files: "src/**/*.ts", modules: [{dir: "src/m", imports: []}], fix: "use index"}, {id: 4, name: "pattern", kind: "pattern", files: "src/**/*.ts", pattern: "fetch\\(", fix: "adapter"},
  {id: 5, name: "absent", kind: "absent", paths: ["packages/copy"], fix: "remove"}, {id: 6, name: "duplicates", kind: "duplicates", files: "src/**/*.ts", lines: 4, fix: "one helper"},
  {id: 7, name: "count", kind: "count", module: "data.mjs", export: "data", path: "items.*.list", min: 2, fix: "add"},
  {id: 8, name: "any-of", kind: "count", module: "data.mjs", export: "data", paths: ["routes.*.x", "routes.*.z"], min: 1, fix: "price it"}];
try {
  const {red, counts} = await check(root, {rules});
  for (const {id} of rules) if (!red.some(line => line.startsWith(`rule ${id} `))) throw new Error(`rule ${id} did not find its planted violation`);
  const anyOf = red.filter(line => line.startsWith("rule 8 "));
  if (anyOf.length !== 1 || !anyOf[0].includes("c has fewer")) throw new Error("count with paths: a 0 and a value count as there, only the item with neither is red");
  const held = await check(root, {rules}, counts);
  if (held.red.length) throw new Error(`a baseline of today's counts must hold: ${held.red[0]}`);
  const shrunk = await check(root, {rules}, {...counts, "1:src/big.ts": counts["1:src/big.ts"] + 5});
  if (!shrunk.red.some(line => line.startsWith("baseline 1:src/big.ts"))) throw new Error("a baseline above today's count must be red (it may only shrink)");
  const grown = await check(root, {rules}, {...counts, "1:src/big.ts": counts["1:src/big.ts"] - 1});
  if (!grown.red.some(line => line.startsWith("rule 1 "))) throw new Error("more than the baseline allows must be red");
  console.log(`arch-check: ${rules.length} kinds found, baseline holds and only shrinks`);
} finally {rmSync(root, {recursive: true, force: true});}
