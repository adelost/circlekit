import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

test("test-only package condition observes decisions, steps and bound ports", () => {
  const directory = mkdtempSync(join(tmpdir(), "product-spec-trace-"));
  const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
  const code = `import {choice,defineDecisionTable,decide,on,defineMachine,step,bindPortImplementations} from "@v1d/product-spec";
    const table=defineDecisionTable({id:"fixture.policy",axes:{phase:["READY"]},columns:{action:choice(["RUN"])},
      cells:[on("run",{phase:"READY"},{action:"RUN"})]});
    decide(table,{phase:"READY"});
    const machine=defineMachine({id:"fixture.machine",states:["IDLE","DONE"],initial:"IDLE",inputs:["Go"],guards:[],
      cells:[{id:"go",from:"IDLE",on:"Go",to:"DONE"}],rests:["IDLE","DONE"],deadlines:[],otherwise:"stay",ordering:"exclusive"});
    step(machine,"IDLE","Go",new Set());
    bindPortImplementations({"owner.open":()=>42})["owner.open"]();`;
  try {
    execFileSync(process.execPath, ["--conditions=studio-trace", "--input-type=module", "-e", code], {
      cwd: root, env: { ...process.env, V1D_STUDIO_TRACE_DIR: directory },
    });
    const files = readdirSync(directory);
    assert.equal(files.length, 1);
    const events = readFileSync(join(directory, files[0]!), "utf8").trim().split("\n").map(line => JSON.parse(line));
    assert.deepEqual(events.map(event => event.kind), ["decision", "transition", "port"]);
    assert.equal(events[0].cellId, "run");
    assert.equal(events[1].to, "DONE");
    assert.equal(events[2].portRef, "owner.open");
    execFileSync(process.execPath, ["--input-type=module", "-e", code], { cwd: root });
    assert.equal(readdirSync(directory).length, 1, "normal package condition must not write a trace");
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
