import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";

/**
 * The Kotlin compiler and the org.json builds, when this box names them, so the emitted wire Kotlin is compiled and
 * run here; a box without them says so by name in the test output instead of passing quietly on nothing.
 * V1D_KOTLIN_CLASSPATH: kotlin-compiler-embeddable with its dependencies, kotlin-stdlib among them.
 * V1D_ORG_JSON: one or more org.json classpaths separated by ';' (Android's, Maven's), each run in turn.
 */
const compiler = process.env.V1D_KOTLIN_CLASSPATH ?? "";
const jsons = (process.env.V1D_ORG_JSON ?? "").split(";").filter((entry) => entry !== "");
const stdlib = compiler.split(delimiter).find((entry) => /kotlin-stdlib-[0-9.]+\.jar$/u.test(entry));

export const kotlinSkip = stdlib === undefined || jsons.length === 0
  ? { skip: "set V1D_KOTLIN_CLASSPATH and V1D_ORG_JSON: the emitted Kotlin was not compiled or run here" }
  : {};

/** Compiles [sources] once against the first org.json, runs [mainClass] with [args] on every org.json, returns each stdout. */
export function runKotlin(sources: Readonly<Record<string, string>>, mainClass: string, args: readonly string[]): readonly string[] {
  const directory = mkdtempSync(join(tmpdir(), "v1d-kotlin-"));
  try {
    const files = Object.entries(sources).map(([name, text]) => { writeFileSync(join(directory, name), text); return join(directory, name); });
    const out = join(directory, "out");
    execFileSync("java", ["-cp", compiler, "org.jetbrains.kotlin.cli.jvm.K2JVMCompiler", "-no-stdlib", "-no-reflect",
      "-jvm-target", "17", "-cp", [stdlib!, jsons[0]!].join(delimiter), "-d", out, ...files], { stdio: ["ignore", "pipe", "pipe"] });
    return jsons.map((json) => execFileSync("java", ["-cp", [out, stdlib!, json].join(delimiter), mainClass, ...args],
      { encoding: "utf8" }));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
