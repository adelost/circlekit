import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const sources = await filesUnder(resolve(root, "src"));
const bad = [];

for (const file of sources) {
  const text = await readFile(file, "utf8");
  for (const match of text.matchAll(/from\s+["'](@v1d\/product-emit(?:\/[^"']*)?)["']/gu)) {
    const specifier = match[1];
    if (specifier !== "@v1d/product-emit/core" && specifier !== "@v1d/product-emit/skydiving") {
      bad.push(`${file.slice(root.length + 1)} imports forbidden '${specifier}'`);
    }
  }
}

if (bad.length > 0) throw new Error(bad.join("\n"));
console.log("ok - product-emit imports use only /core or /skydiving");

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? filesUnder(path) : entry.name.endsWith(".ts") ? [path] : [];
  }));
  return files.flat();
}
