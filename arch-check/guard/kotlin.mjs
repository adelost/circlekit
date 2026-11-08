// The imports of Kotlin files resolved to the repository files they load: an index of each file's package and top-level names, then `import a.b.C`, `import a.b.C.D`, `import a.b.fn` and `import a.b.*`. row 1785.
const PACKAGE = /^[ \t]*package[ \t]+([\w.]+)/m;
const MODIFIERS = 'public|internal|private|protected|open|abstract|sealed|data|enum|annotation|inline|value|fun|const|lateinit|expect|actual|external|suspend|tailrec|operator|infix|override';
const DECLARATION = new RegExp(`^(?:(?:${MODIFIERS})[ \\t]+)*(?:class|object|interface|typealias|fun|val|var)[ \\t]+(?:<[^>]*>[ \\t]*)?(?:[\\w.<>?, ]+\\.)?(\\w+)`, 'gm');   // a top-level declaration starts in column 0
const IMPORT = /^[ \t]*import[ \t]+([\w.]+?)(\.\*)?(?:[ \t]+as[ \t]+\w+)?[ \t]*$/gm;
const BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g;

/** What each Kotlin file declares: package name to its files, and `package.Name` to the files declaring that top-level name. */
export function kotlinIndex(files, read) {
  const packages = new Map(), names = new Map(), add = (map, key, file) => map.set(key, [...(map.get(key) ?? []), file]);
  for (const file of files) {
    const text = read(file).replace(BLOCK_COMMENT, block => block.replace(/[^\n]/g, ' ')), pkg = PACKAGE.exec(text)?.[1] ?? '';
    add(packages, pkg, file);
    for (const [, name] of text.matchAll(DECLARATION)) add(names, `${pkg}.${name}`, file);
  }
  return { packages, names };
}

export function kotlinTargets(text, file, index) {
  const found = new Set();
  for (const [, fqn, star] of text.replace(BLOCK_COMMENT, block => block.replace(/[^\n]/g, ' ')).matchAll(IMPORT)) {
    if (star && index.packages.has(fqn)) { for (const target of index.packages.get(fqn)) found.add(target); continue; }
    for (let parts = fqn.split('.'); parts.length > 1; parts.pop()) {   // a nested class or a member: the longest prefix that is declared
      const hit = index.names.get(parts.join('.'));
      if (hit) { for (const target of hit) found.add(target); break; }
    }
  }
  found.delete(file);
  return [...found];
}
