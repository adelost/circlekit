import assert from "node:assert/strict";
import test from "node:test";
import { field, valueRef, type LegoContract } from "@v1d/product-spec";
import { emitContractTypesKotlin } from "../src/core/index.js";

const options = { packageName: "io.v1d.sample.generated", symbolPrefix: "Sample", sourceFile: "product/src/product.ts", sourceSha: "abc123" };

/** Barometer's `barometer.reading` as product.ts declares it, plus an integer so every primitive column shows. */
function reading(fields: LegoContract["fields"]): LegoContract {
  return { id: "barometer.reading", kind: "observation", boundary: "service-internal", fields };
}

test("a declared record contract is a public data class with its declared names, order, types and nullability", () => {
  const kotlin = emitContractTypesKotlin([reading([
    field("pressureHpa", "number", { unit: "hpa", nullable: true }),
    field("zeroHpa", "number", { unit: "hpa", nullable: true }),
    field("samples", "integer"),
    field("sensor", "string"),
    field("held", "boolean"),
  ])], options);

  assert.equal(kotlin, `// GENERATED FILE. DO NOT EDIT.
// GENERATED FROM product/src/product.ts
// Product declaration SHA-256: abc123
package io.v1d.sample.generated

/** Contract \`barometer.reading\`. */
data class GeneratedBarometerReading(
    val pressureHpa: Double?,
    val zeroHpa: Double?,
    val samples: Long,
    val sensor: String,
    val held: Boolean,
)
`);
});

test("a renamed or retyped declared field renames or retypes the generated property, so native code cannot keep the old one", () => {
  const before = emitContractTypesKotlin([reading([field("pressureHpa", "number", { nullable: true })])], options);
  const renamed = emitContractTypesKotlin([reading([field("pressurePa", "number", { nullable: true })])], options);
  const retyped = emitContractTypesKotlin([reading([field("pressureHpa", "integer")])], options);

  assert.match(before, /val pressureHpa: Double\?,/u);
  assert.match(renamed, /val pressurePa: Double\?,/u);
  assert.doesNotMatch(renamed, /pressureHpa/u);
  assert.match(retyped, /val pressureHpa: Long,/u);
});

test("a field that references another value, or a contract with no fields, is refused by contract and field", () => {
  assert.throws(() => emitContractTypesKotlin([reading([field("snapshot", valueRef("barometer.snapshot"))])], options),
    /contract 'barometer\.reading' field 'snapshot' references 'barometer\.snapshot'; a contract type is emitted from primitive fields only/u);
  assert.throws(() => emitContractTypesKotlin([{ id: "barometer.reset", kind: "event", boundary: "ui-event", fields: [] }], options),
    /contract 'barometer\.reset' has no fields, so it has no data class/u);
});
