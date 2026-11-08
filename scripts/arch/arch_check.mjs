// Row 1787: runs the architecture guard of @v1d/arch-check 0.9.1 on this repository: the rules of arch.config.json against the baseline of arch.baseline.json, which only shrinks. Run by `npm run lint`.
// The package is installed by npm ci and pinned twice: package-lock.json's integrity covers the tarball, SHA256 below covers the code that runs (every .mjs file of the package), checked before any of it is imported.
// A raise of a known exception, a removed rule, a widened dependency or door, a dropped module or a changed guard needs a named decision added to arch.decisions.json in the same commit. `--init`, `--adopt <rule id>` and `--lower` are the package's.

import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const VERSION = "0.9.1";
const SHA256 = "cec75d6badbef885ed53b2bc2b4eddf07240963355d663558f92d8b9976df2d0";   // sha256 over the package's .mjs files, each as its path inside the package, a NUL and its bytes, in path order; change both with the pin
const ROOT = fileURLToPath(new URL("../../", import.meta.url)), PACKAGE = join(ROOT, "node_modules/@v1d/arch-check"), FIX = "npm ci";

const installed = existsSync(join(PACKAGE, "package.json")) ? JSON.parse(readFileSync(join(PACKAGE, "package.json"), "utf8")).version : null;
if (installed !== VERSION) {
  console.error(`arch-check: this repository needs @v1d/arch-check ${VERSION} in node_modules and has ${installed ?? "none"}. Fix: ${FIX}`);
  process.exit(2);
}
const modules = dir => readdirSync(dir, { withFileTypes: true }).filter(entry => entry.name !== "node_modules")
  .flatMap(entry => entry.isDirectory() ? modules(join(dir, entry.name)) : entry.name.endsWith(".mjs") ? [join(dir, entry.name)] : []).sort();
const hash = createHash("sha256");
for (const file of modules(PACKAGE)) hash.update(`${file.slice(PACKAGE.length)}\0`).update(readFileSync(file));
if (hash.digest("hex") !== SHA256) {
  console.error(`arch-check: ${PACKAGE} is not the locked @v1d/arch-check ${VERSION} (its code differs from the pinned hash). Fix: ${FIX}`);
  process.exit(2);
}
const { runGuard } = await import(pathToFileURL(join(PACKAGE, "guard/run.mjs")).href);
process.exit(await runGuard({ root: ROOT, args: process.argv.slice(2) }));
