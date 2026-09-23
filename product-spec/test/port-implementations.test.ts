import assert from "node:assert/strict";
import test from "node:test";
import { bindPortImplementations } from "../src/index.js";

test("normal port binding preserves the exact object and callable", () => {
  const open = () => "opened";
  const ports = { "account.open": open };
  const bound = bindPortImplementations(ports);
  assert.equal(bound, ports);
  assert.equal(bound["account.open"], open);
  assert.equal(bound["account.open"](), "opened");
});
