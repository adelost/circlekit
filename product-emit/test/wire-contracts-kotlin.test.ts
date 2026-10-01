import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ContractPayloadError, field, finiteValueRef, finiteValues, readContractPayload, type LegoContract } from "@v1d/product-spec";
import { emitWireContractsKotlin } from "../src/core/index.js";
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
