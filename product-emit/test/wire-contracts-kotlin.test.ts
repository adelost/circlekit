import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { ContractPayloadError, field, finiteValueRef, finiteValues, readContractPayload, type LegoContract } from "@v1d/product-spec";
import { emitWireContractsKotlin, kotlinIdentifier } from "../src/core/index.js";
import { kotlinSkip, runKotlin } from "./kotlin-toolchain.js";
import { acmeOrder, acmeReceipt, acmeWireContracts, acmeWireValues } from "./wire-acme.js";

const options = { packageName: "dev.acme.wire", symbolPrefix: "Acme", sourceFile: "test/wire-acme.ts", sourceSha: "fixture" };
const fromTest = (path: string) => readFileSync(new URL(`../../test/${path}`, import.meta.url), "utf8");

interface WireFixture {
  readonly name: string;
  readonly contract: string;
  readonly body: unknown;
  readonly read?: unknown;
  readonly refuse?: string;
  readonly field?: string;
}

// The same file the generated Kotlin is run against (golden/wire-contracts.kt, with Android's org.json and Maven's
// 20240303): it accepts and refuses exactly these cases, and writes back exactly the value TypeScript reads.
const fixtures = JSON.parse(fromTest("fixtures/wire-acme.json")) as readonly WireFixture[];
const contracts: Readonly<Record<string, LegoContract>> = { "shop.order": acmeOrder, "shop.receipt": acmeReceipt };

for (const fixture of fixtures) {
  test(`TypeScript reads the wire fixture '${fixture.name}' as the Kotlin parse does`, () => {
    const read = () => readContractPayload(contracts[fixture.contract]!, fixture.body, acmeWireValues);
    if (fixture.refuse === undefined) {
      assert.deepEqual(read(), fixture.read ?? fixture.body);
      return;
    }
    assert.throws(read, (error) => error instanceof ContractPayloadError && error.field === fixture.field
      && error.message.startsWith(fixture.refuse!));
  });
}

/** What a read decides: the value it writes back, or the fault with its contract, its field path and its message. */
function tsOutcome(fixture: WireFixture): unknown {
  try {
    return { value: JSON.parse(JSON.stringify(readContractPayload(contracts[fixture.contract]!, fixture.body, acmeWireValues))) };
  } catch (error) {
    if (!(error instanceof ContractPayloadError)) throw error;
    return { contractId: error.contractId, field: error.field, message: error.message.replace(/\s*\[[^\]]*\]$/u, "") };
  }
}

/** A Kotlin main that reads every fixture with its generated class and prints one JSON line per case. */
const harness = `package dev.acme.wire

import java.io.File
import org.json.JSONArray
import org.json.JSONObject

fun main(args: Array<String>) {
    val parsers: Map<String, (JSONObject) -> JSONObject> = mapOf(
${Object.keys(contracts).map((id) => `        "${id}" to { json -> Generated${options.symbolPrefix}${kotlinIdentifier(id)}.parse(json).toJson() },`).join("\n")}
    )
    val fixtures = JSONArray(File(args[0]).readText())
    for (index in 0 until fixtures.length()) {
        val fixture = fixtures.getJSONObject(index)
        val line = JSONObject()
        try {
            line.put("value", JSONObject(parsers.getValue(fixture.getString("contract"))(fixture.getJSONObject("body")).toString()))
        } catch (error: Throwable) {
            line.put("contractId", property(error, "getContractId") ?: JSONObject.NULL)
                .put("field", property(error, "getField") ?: JSONObject.NULL)
                .put("message", (error.message ?: error.javaClass.simpleName))
        }
        println(line.toString())
    }
}

private fun property(error: Throwable, getter: String): String? =
    runCatching { error.javaClass.getMethod(getter).invoke(error) as? String }.getOrNull()
`;

test("the emitted Kotlin decides every fixture as readContractPayload does: the same value, or the same fault at the same path", kotlinSkip, () => {
  const sources = { "AcmeWire.kt": emitWireContractsKotlin(acmeWireContracts, acmeWireValues, options), "Harness.kt": harness };
  const fixturePath = fileURLToPath(new URL("../../test/fixtures/wire-acme.json", import.meta.url));
  for (const output of runKotlin(sources, "dev.acme.wire.HarnessKt", [fixturePath])) {
    const lines = output.trim().split("\n").map((line) => JSON.parse(line) as unknown);
    assert.equal(lines.length, fixtures.length);
    fixtures.forEach((fixture, index) => assert.deepEqual(lines[index], tsOutcome(fixture), fixture.name));
  }
});

test("the generated wire Kotlin is the golden file that was compiled and run on the fixtures", () => {
  assert.equal(emitWireContractsKotlin(acmeWireContracts, acmeWireValues, options), fromTest("golden/wire-contracts.kt"));
});

const sizes = finiteValues("shop.size", ["S", "M", "L"]);
const order = (fields: LegoContract["fields"], extra: Partial<LegoContract> = {}): LegoContract =>
  ({ id: "shop.order", kind: "event", boundary: "wire", fields, ...extra });

test("the emitter refuses what a Kotlin client cannot hold or name", () => {
  const emit = (contract: LegoContract, values: readonly ReturnType<typeof finiteValues>[] = [sizes]) => () =>
    emitWireContractsKotlin([contract], values, options);
  assert.throws(emit(order([field("size", "string")], { boundary: "service-internal" })),
    /emitWireContractsKotlin emits wire contracts; 'shop\.order' has boundary 'service-internal'/u);
  assert.throws(emit(order([field("day", "string", { optional: true, nullable: true })])),
    /wire contract 'shop\.order' field 'day' is optional and nullable; a Kotlin client cannot tell an absent key from null/u);
  assert.throws(emit(order([field("size", finiteValueRef("shop.size"))]), []),
    /finite 'shop\.size' needs exactly one nonempty value declaration/u);
  assert.throws(emit(order([field("power", finiteValueRef("shop.power"))]), [finiteValues("shop.power", ["on", "ON"])]),
    /finite 'shop\.power' values 'on' and 'ON' are one Kotlin constant ON/u);
  assert.throws(emit(order([], { kind: "event" })), /wire contract 'shop\.order' has no fields, so it has no data class/u);
  const other = order([field("size", "integer")]);
  assert.throws(() => emitWireContractsKotlin([order([field("size", "string")]), other], [], options),
    /two different wire contracts are named 'shop\.order'/u);
});
