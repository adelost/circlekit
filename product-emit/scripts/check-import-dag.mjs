import { readFile, readdir } from "node:fs/promises";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import ts from "typescript";

const root = resolve(import.meta.dirname, "..");
const sourceRoot = join(root, "src");
const coreRoot = join(sourceRoot, "core");
const skydivingRoot = join(sourceRoot, "skydiving");

const expectedCore = new Set([
  "compile-theme", "component-copy-model", "declaration-ids", "decode-theme-registry",
  "diagnostics", "emission-options", "emit-component-copy-kotlin",
  "emit-component-family-registry-kotlin", "emit-component-trees-kotlin",
  "emit-config-values-kotlin", "emit-native-lego-kotlin", "emit-navigation-kotlin",
  "emit-profile-table-js", "emit-state-presentations-kotlin", "emit-theme", "index",
  "kotlin-syntax", "model", "profile-table-model", "theme-model", "validate-invariants",
  "validate-native-legos", "validate-profile-table",
]);
const expectedSkydiving = new Set([
  "compile-interactions", "compile-settings", "emit-home-actions-kotlin",
  "emit-interaction-kotlin", "emit-iso-options-kotlin", "emit-jump-tags-kotlin", "emit-kotlin",
  "emit-map-object-presets-kotlin", "emit-map-product-kotlin", "emit-product-icons-kotlin",
  "emit-product-menus-kotlin", "emit-settings-components-kotlin",
  "emit-surface-components-kotlin", "emit-watch-chrome-slots-kotlin", "home-action-model",
  "index", "interaction-model", "iso-option-model", "jump-tag-model", "menu-text-budget", "model",
  "native-symbols", "normalize-setting", "product-menu-model", "product-menu-types",
  "setting-mount-model", "surface-component-model", "validate-iso-options",
  "validate-product-menus", "validate-setting-groups", "watch-chrome-slot-model",
]);

const failures = [];
await checkManifest(coreRoot, expectedCore);
await checkManifest(skydivingRoot, expectedSkydiving);

for (const file of await typescriptFiles(coreRoot)) {
  const source = await readFile(file, "utf8");
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  for (const specifier of importSpecifiers(ast)) {
    if (specifier === "@v1d/skydiving-legos" || specifier.startsWith("@v1d/skydiving-legos/")) {
      failures.push(`${relative(root, file)} imports the skydiving library from core`);
      continue;
    }
    if (!specifier.startsWith(".")) continue;
    const target = resolve(dirname(file), specifier.replace(/\.js$/u, ".ts"));
    if (target === skydivingRoot || target.startsWith(`${skydivingRoot}/`)) {
      failures.push(`${relative(root, file)} imports ${specifier} across core -> skydiving`);
    }
  }
}

const forbiddenPrefix = ["com", "adelost", "skydive", "altimeter"].join(".").replace("skydive.altimeter", "skydivealtimeter");
for (const file of await typescriptFiles(sourceRoot)) {
  if ((await readFile(file, "utf8")).includes(forbiddenPrefix)) {
    failures.push(`${relative(root, file)} contains a consumer package prefix`);
  }
}

if (failures.length > 0) {
  console.error(failures.map((failure) => `product-emit: ${failure}`).join("\n"));
  process.exit(1);
}
console.log(`product-emit DAG: PASS (${expectedCore.size} core, ${expectedSkydiving.size} skydiving modules)`);

async function checkManifest(directory, expected) {
  const actual = new Set((await readdir(directory))
    .filter((name) => extname(name) === ".ts")
    .map((name) => basename(name, ".ts")));
  for (const name of expected) if (!actual.has(name)) failures.push(`${relative(root, directory)} misses ${name}.ts`);
  for (const name of actual) if (!expected.has(name)) failures.push(`${relative(root, directory)} has unclassified ${name}.ts`);
}

async function typescriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await typescriptFiles(path));
    else if (entry.isFile() && extname(entry.name) === ".ts") files.push(path);
  }
  return files;
}

function importSpecifiers(ast) {
  const values = [];
  for (const statement of ast.statements) {
    if ((ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) &&
        statement.moduleSpecifier !== undefined && ts.isStringLiteral(statement.moduleSpecifier)) {
      values.push(statement.moduleSpecifier.text);
    }
  }
  return values;
}
