import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import ts from "typescript";

test("a bad binding names the node, port and both contracts on its own line", () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const configPath = resolve(root, "tsconfig.json");
  const fixturePath = resolve(root, "fixtures/node-authoring-invalid.ts");
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  assert.equal(config.error, undefined);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
  const program = ts.createProgram([fixturePath], { ...parsed.options, noEmit: true });
  const errors = ts.getPreEmitDiagnostics(program).filter((diagnostic) =>
    diagnostic.file?.fileName === fixturePath);
  assert.equal(errors.length, 2);
  const expected = [
    "node fixture.wrong-contract port pressure: expected fixture.pressure, actual fixture.position",
    "node fixture.misspelled-port port presure: expected <undeclared>, actual fixture.pressure",
  ];
  for (const [index, error] of errors.entries()) {
    const file = error.file!;
    const line = file.getLineAndCharacterOfPosition(error.start!).line;
    assert.match(file.text.split("\n")[line]!, /from: \{/u);
    const firstLine = ts.flattenDiagnosticMessageText(error.messageText, "\n").split("\n")[0]!;
    assert.ok(firstLine.includes(expected[index]!), firstLine);
  }
});
