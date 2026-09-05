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

test("growing state vocabulary stays in bounded files with each declaration and registry entry once", () => {
  for (const count of [0, 1, 40]) {
    const authorities = Array.from({ length: count }, (_, index) => {
      const states = finiteValues(`sample.state${index}`, Array.from(
        { length: 70 }, (_, state) => `state${state}`,
      ));
      const definition = defineStateAuthority({
        id: `sample.authority${index}`,
        source: {
          portRef: `sample.service${index}.state`, stateField: "status", states,
          contract: { ...sourceContract, fields: [
            field("status", finiteValueRef(states.id)),
            field("snapshot", valueRef("sample.snapshot"), { nullable: true }),
          ] },
        },
        presentation: {
          ...presentation, id: `sample.presentation${index}`, stateRef: states.id,
          contract: { ...presentation.contract, id: `sample.presentation${index}.payload` },
          cases: Object.fromEntries(states.values.map((state) => [state, { label: state }])),
        },
      });
      return {
        ...definition.authority,
        presentation: { ...definition.authority.presentation, consumers: [] },
      };
    });
    const options = {
      packageName: "io.acme.generated", symbolPrefix: "Acme",
      sourceSha: "fixture", nativePortPackageName: "io.acme.ports",
    };
    const output = emitStatePresentationsKotlinFiles(authorities, options);
    assert.deepEqual(emitStatePresentationsKotlinFiles(authorities, options), output);
    const files = [{ suffix: "aggregate", content: output.aggregate }, ...output.shards];
    assert.equal(new Set(files.map(({ suffix }) => suffix)).size, files.length);
    for (const { suffix, content } of files) {
      assert.ok(content.trimEnd().split("\n").length < 500, `${count} authorities: ${suffix} exceeds cap`);
    }
    const all = files.map(({ content }) => content).join("\n");
    const once = (text: string) => assert.equal(all.split(text).length - 1, 1, text);
    if (count > 0) once("sealed interface GeneratedAcmeSampleSnapshotValue");
    for (let index = 0; index < count; index++) {
      once(`enum class GeneratedAcmeSampleState${index} {`);
      once(`data class GeneratedSampleAuthority${index}SourcePayload(`);
      once(`data class GeneratedSamplePresentation${index}Payload(`);
      once(`object GeneratedAcmeStatePresentationSampleAuthority${index} {`);
      once(`val SampleAuthority${index} get() = GeneratedAcmeStatePresentationSampleAuthority${index}`);
      once(`id = "sample.authority${index}",`);
      once(`SampleAuthority${index}.authority,`);
      once(`id = "sample.state${index}",`);
      once(`nativeSymbol = GeneratedAcmeSampleState${index}::class,`);
      once(`"SampleAuthority${index}" to setOf(`);
      // Whole readable declarations/cases survive the split, including the last finite value.
      once(`GeneratedAcmeSampleState${index}.STATE69 to GeneratedSamplePresentation${index}Payload(Label = "state69")`);
    }
  }
  assert.throws(() => emitStatePresentationsKotlinFiles([{
    ...authority,
    source: { ...authority.source, states: { ...states,
      values: Array.from({ length: 500 }, (_, index) => `state${index}`),
    } },
  }], {
    packageName: "io.acme.generated", symbolPrefix: "Acme",
    sourceSha: "fixture", nativePortPackageName: "io.acme.ports",
  }), /Types declaration\/entry exceeds 499 lines/u);
});
