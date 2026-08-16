import assert from "node:assert/strict";
import test from "node:test";
import {
  defineStateAuthority,
  defineStatePresentation,
  field,
  finiteValueRef,
  finiteValues,
  valueRef,
  type CompiledStateAuthority,
} from "@v1d/product-spec";
import { emitStatePresentationsKotlinFiles } from "../src/core/index.js";

const states = finiteValues("sample.state", ["idle", "ready"] as const);
const sourceContract = {
  id: "sample.source",
  kind: "state",
  boundary: "presentation",
  fields: [
    field("status", finiteValueRef(states.id)),
    field("snapshot", valueRef("sample.snapshot"), { nullable: true }),
    field("attempt", "integer"),
  ],
} as const;
const presentation = defineStatePresentation(states, {
  id: "sample.presentation",
  fields: [{ name: "label", value: "string" }] as const,
  cases: {
    idle: { label: "IDLE" },
    ready: { label: "READY" },
  },
});
const definition = defineStateAuthority({
  id: "sample.authority",
  source: { portRef: "sample.service.state", contract: sourceContract, stateField: "status", states },
  presentation,
});
const authority: CompiledStateAuthority = {
  ...definition.authority,
  presentation: { ...definition.authority.presentation, consumers: ["sample.surface.presentation"] },
};

test("state authority input ports use generated source contract types without Any", () => {
  const output = emitStatePresentationsKotlinFiles([authority], {
    packageName: "io.acme.generated",
    symbolPrefix: "Acme",
    sourceSha: "fixture",
    nativePortPackageName: "io.acme.ports",
  });
  const all = [output.aggregate, ...output.shards.map(({ content }) => content)].join("\n");

  assert.match(all, /enum class GeneratedAcmeSampleState \{\s*IDLE,\s*READY,/u);
  assert.match(all, /sealed interface GeneratedAcmeSampleSnapshotValue/u);
  assert.match(all, /data class GeneratedSampleAuthoritySourcePayload\([\s\S]*val Status: GeneratedAcmeSampleState,[\s\S]*val Snapshot: GeneratedAcmeSampleSnapshotValue\?,[\s\S]*val Attempt: Long,/u);
  assert.match(all, /ProductDataInput<GeneratedSampleAuthoritySourcePayload>/u);
  assert.doesNotMatch(all, /ProductDataInput<Any>|UNCHECKED_CAST|fun <T : Any> inputPort/u);
});
