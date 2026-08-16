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

const otherStates = finiteValues("sample.other", ["closed", "open"] as const);
const sharedSourceContract = {
  id: "sample.shared-source",
  kind: "state",
  boundary: "presentation",
  fields: [
    field("status", finiteValueRef(states.id)),
    field("other", finiteValueRef(otherStates.id)),
  ],
} as const;
const otherPresentation = defineStatePresentation(otherStates, {
  id: "sample.other-presentation",
  fields: [{ name: "label", value: "string" }] as const,
  cases: {
    closed: { label: "CLOSED" },
    open: { label: "OPEN" },
  },
});
const otherDefinition = defineStateAuthority({
  id: "sample.other-authority",
  source: { portRef: "sample.shared.state", contract: sharedSourceContract, stateField: "other", states: otherStates },
  presentation: otherPresentation,
});
const statusDefinition = defineStateAuthority({
  id: "sample.status-authority",
  source: { portRef: "sample.shared.state", contract: sharedSourceContract, stateField: "status", states },
  presentation,
});

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
  assert.match(all, /fun <S : Any> bind\([\s\S]*state: \(S\) -> GeneratedAcmeSampleState,[\s\S]*GeneratedStatePresentationBinding<S, GeneratedSamplePresentationPayload>/u);
  assert.match(all, /nativePortIdsByBinding: Map<String, Set<GeneratedProductPortId>>/u);
  assert.doesNotMatch(all, /ProductDataInput<Any>|UNCHECKED_CAST|fun <T : Any> inputPort/u);
});

test("shared source contracts reuse every declared finite type in every payload", () => {
  const authorities: CompiledStateAuthority[] = [
    { ...statusDefinition.authority, presentation: { ...statusDefinition.authority.presentation, consumers: [] } },
    { ...otherDefinition.authority, presentation: { ...otherDefinition.authority.presentation, consumers: [] } },
  ];
  const output = emitStatePresentationsKotlinFiles(authorities, {
    packageName: "io.acme.generated",
    symbolPrefix: "Acme",
    sourceSha: "fixture",
    nativePortPackageName: "io.acme.ports",
  });
  const all = [output.aggregate, ...output.shards.map(({ content }) => content)].join("\n");

  assert.match(all, /data class GeneratedSampleStatusAuthoritySourcePayload\([\s\S]*val Status: GeneratedAcmeSampleState,[\s\S]*val Other: GeneratedAcmeSampleOther,/u);
  assert.match(all, /data class GeneratedSampleOtherAuthoritySourcePayload\([\s\S]*val Status: GeneratedAcmeSampleState,[\s\S]*val Other: GeneratedAcmeSampleOther,/u);
  assert.doesNotMatch(all, /GeneratedAcmeSample(?:State|Other)Value/u);
});
