#!/usr/bin/env node

import { resolve } from "node:path";
import { checkV1dPinsAt } from "./pin-check.js";

const root = resolve(process.argv[2] ?? ".");
try {
  const result = await checkV1dPinsAt(root);
  if (result.errors.length > 0) {
    console.error(`v1d pin check failed:\n${result.errors.map((error) => `- ${error}`).join("\n")}`);
    process.exitCode = 1;
  } else {
    console.log(`ok - ${result.dependencies.length} immutable @v1d dependency pin(s)`);
  }
} catch (error) {
  console.error(`v1d pin check failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
