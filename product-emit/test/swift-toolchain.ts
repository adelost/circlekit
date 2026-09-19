import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * The open-source Swift toolchain, when this box has one. Skyvw row 202: a Linux box can compile and run the emitted
 * Swift, so the parity fixtures are checked for real here; a box without swiftc says so by name in the test output
 * instead of passing quietly on nothing.
 */
export function swiftcVersion(): string | null {
  try {
    return execFileSync("swiftc", ["--version"], { encoding: "utf8" }).split("\n")[0]!.trim();
  } catch {
    return null;
  }
}

export const swiftcSkip = swiftcVersion() === null
  ? { skip: "no swiftc on PATH: the emitted Swift was not compiled or run here" }
  : {};

/** Compiles [sources] (a name to its Swift text) plus a `main.swift`, runs it with [argv], and returns its stdout. */
export function runSwift(sources: Readonly<Record<string, string>>, main: string, files: Readonly<Record<string, string>> = {}): string {
  const directory = mkdtempSync(join(tmpdir(), "v1d-swift-"));
  try {
    for (const [name, text] of Object.entries({ ...sources, "main.swift": main })) writeFileSync(join(directory, name), text);
    for (const [name, text] of Object.entries(files)) writeFileSync(join(directory, name), text);
    const binary = join(directory, "parity");
    execFileSync("swiftc", ["-o", binary, ...Object.keys({ ...sources, "main.swift": main }).map((name) => join(directory, name))], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return execFileSync(binary, [...Object.keys(files).map((name) => join(directory, name))], { encoding: "utf8" }).trim();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
