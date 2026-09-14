import assert from "node:assert/strict";
import test from "node:test";
import {
  emitServiceGlancesKotlin,
  serviceGlanceProblems,
  type ServiceGlanceDeclaration,
} from "../src/core/index.js";

type AcmeIcon = "PLANE" | "GAUGE" | "MAP";
const rules = { icons: new Set<AcmeIcon>(["PLANE", "GAUGE", "MAP"]), labelMaxChars: 11 };
const acme: readonly ServiceGlanceDeclaration<AcmeIcon>[] = [
  { id: "TRAFFIC", label: "TRAFFIC", icon: "PLANE", delivery: "CLOCK", intervalMs: 30_000 },
  { id: "PRESSURE", label: "PRESSURE", icon: "GAUGE", delivery: "STREAM", unit: "HERTZ" },
  { id: "MAP_DATA", label: "MAP DATA", icon: "MAP", delivery: "LEASE", leaseMs: 86_400_000 },
];
const emission = {
  packageName: "com.acme.generated", symbolPrefix: "Acme", sourceFile: "acme/services.ts", sourceSha: "test",
  nativeSymbols: { source: "com.acme.ServiceId", icon: "com.acme.IconToken" },
  sourceOf: (glance: ServiceGlanceDeclaration<AcmeIcon>) => `ServiceId.${glance.id}`,
};

test("a clock, a stream and a lease are drawable, and their units come from how they deliver", () => {
  assert.deepEqual(serviceGlanceProblems(acme, rules), []);
  const kotlin = emitServiceGlancesKotlin(acme, rules, emission);
  assert.ok(kotlin.includes('GeneratedAcmeServiceGlance(ServiceId.TRAFFIC, "TRAFFIC", IconToken.PLANE, GeneratedAcmeServiceGlanceUnit.INTERVAL, 30000L),'));
  assert.ok(kotlin.includes('GeneratedAcmeServiceGlance(ServiceId.PRESSURE, "PRESSURE", IconToken.GAUGE, GeneratedAcmeServiceGlanceUnit.HERTZ, null),'));
  assert.ok(kotlin.includes('GeneratedAcmeServiceGlance(ServiceId.MAP_DATA, "MAP DATA", IconToken.MAP, GeneratedAcmeServiceGlanceUnit.AGE, 86400000L),'));
  assert.match(kotlin, /^import com\.acme\.IconToken\nimport com\.acme\.ServiceId$/mu);
  assert.ok(!kotlin.toLowerCase().includes("skyvw"), "the emitter names no product");
});

/** skyvw:0 2026-09-14: "An unknown icon ... or a zero/negative interval fails at declaration time, not on the watch." */
test("an unknown or shared icon, a zero interval or lease, a lower-case label and a repeated id are not drawable", () => {
  const traffic = acme[0]!;
  const problems = (glances: readonly object[]) => serviceGlanceProblems(glances as readonly ServiceGlanceDeclaration<AcmeIcon>[], rules).join("\n");
  assert.match(problems([{ ...traffic, icon: "ROCKET" }]), /icon ROCKET, which the product cannot draw/u);
  assert.match(problems([traffic, { ...acme[1]!, icon: "PLANE" }]), /icon PLANE, which already names service glance 0 'TRAFFIC'/u);
  assert.match(problems([{ ...traffic, intervalMs: 0 }]), /positive whole-millisecond interval/u);
  assert.match(problems([{ ...traffic, intervalMs: -5 }]), /positive whole-millisecond interval/u);
  assert.match(problems([{ ...acme[2]!, leaseMs: 0 }]), /positive whole-millisecond lease/u);
  assert.match(problems([{ ...acme[1]!, unit: "AGE" }]), /is a stream, so its number is an INTERVAL or HERTZ/u);
  assert.match(problems([{ ...traffic, label: "Traffic" }]), /needs an UPPER CASE label/u);
  assert.match(problems([traffic, { ...traffic, icon: "GAUGE" }]), /declared twice/u);
  assert.match(problems([{ ...traffic, delivery: "PUSH" }]), /delivers by 'PUSH'/u);
  assert.throws(() => emitServiceGlancesKotlin([{ ...traffic, icon: "ROCKET" as AcmeIcon }], rules, emission), /not drawable/u);
});
