import { execFileSync, spawnSync } from "node:child_process";
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

/** For a compile law that needs kotlinc alone, not org.json. */
export const kotlinCompilerSkip = stdlib === undefined
  ? { skip: "set V1D_KOTLIN_CLASSPATH: the emitted Kotlin was not compiled here" }
  : {};

export type KotlinVerdict =
  | { readonly compiled: true; readonly stdout: string }
  | { readonly compiled: false; readonly diagnostics: string };

/**
 * The one kotlinc step: writes [sources] into [directory] and compiles them against kotlin-stdlib and the first
 * org.json this box names (the emitted wire Kotlin imports it; other sources ignore it). A refusal carries kotlinc's
 * own message instead of throwing.
 */
function kotlinc(directory: string, sources: Readonly<Record<string, string>>):
  { readonly out: string } | { readonly diagnostics: string } {
  const files = Object.entries(sources).map(([name, text]) => { writeFileSync(join(directory, name), text); return join(directory, name); });
  const out = join(directory, "out");
  const compile = spawnSync("java", ["-cp", compiler, "org.jetbrains.kotlin.cli.jvm.K2JVMCompiler", "-no-stdlib", "-no-reflect",
    "-jvm-target", "17", "-cp", [stdlib!, ...jsons.slice(0, 1)].join(delimiter), "-d", out, ...files], { encoding: "utf8" });
  return compile.status === 0 ? { out } : { diagnostics: `${compile.stderr}${compile.stdout}` };
}

/** Compiles [sources] once, runs [mainClass] with [args] on every org.json, returns each stdout. A refusal throws. */
export function runKotlin(sources: Readonly<Record<string, string>>, mainClass: string, args: readonly string[]): readonly string[] {
  const directory = mkdtempSync(join(tmpdir(), "v1d-kotlin-"));
  try {
    const compiled = kotlinc(directory, sources);
    if ("diagnostics" in compiled) throw new Error(`kotlinc refused the sources:\n${compiled.diagnostics}`);
    return jsons.map((json) => execFileSync("java", ["-cp", [compiled.out, stdlib!, json].join(delimiter), mainClass, ...args],
      { encoding: "utf8" }));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

/**
 * Compiles [sources] with kotlinc. A refusal is a verdict, not a throw, so a test can read kotlinc's own message.
 * When it compiles and [mainClass] is named, runs that class and returns its stdout.
 */
export function compileKotlin(sources: Readonly<Record<string, string>>, mainClass?: string): KotlinVerdict {
  const directory = mkdtempSync(join(tmpdir(), "v1d-kotlinc-"));
  try {
    const compiled = kotlinc(directory, sources);
    if ("diagnostics" in compiled) return { compiled: false, diagnostics: compiled.diagnostics };
    const stdout = mainClass === undefined ? ""
      : execFileSync("java", ["-cp", [compiled.out, stdlib!, ...jsons.slice(0, 1)].join(delimiter), mainClass], { encoding: "utf8" });
    return { compiled: true, stdout };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
