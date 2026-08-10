import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import {
  decodeNativeBindingManifest,
  PRODUCT_SPEC_SCHEMA_VERSION,
  buildOutputManifest,
  productArtifactConformance,
  productArtifactHostCoverage,
  productJsonEmitter,
  type NativeBindingManifest,
  type ProductEmitterPlugin,
} from "@v1d/product-spec";
import { showcaseKotlinEmitter } from "../src/emit-kotlin.js";
import { CIRCLEKIT_ASSET_CATALOG, CIRCLEKIT_STYLE } from "@v1d/circlekit-assets";
import { showcaseGarminEmitter } from "../src/emit-monkeyc.js";
import { showcaseSwiftEmitter } from "../src/emit-swift.js";
import {
  SHOWCASE_ARTIFACT_PROFILES,
  compileCircleKitShowcaseProduct,
  requireCircleKitShowcaseNativeConformance,
} from "../src/product.js";

const root = resolve(import.meta.dirname, "../..");

type Mutable<T> = T extends readonly (infer Item)[]
  ? Mutable<Item>[]
  : T extends object
    ? { -readonly [Key in keyof T]: Mutable<T[Key]> }
    : T;

async function registry() {
  return decodeNativeBindingManifest(JSON.parse(
    await readFile(resolve(root, "native-registry/showcase.json"), "utf8"),
  ));
}

async function productSpecVersion(): Promise<string> {
  const raw = JSON.parse(await readFile(resolve(root, "node_modules/@v1d/product-spec/package.json"), "utf8")) as {
    version?: unknown;
  };
  assert.equal(typeof raw.version, "string");
  return raw.version as string;
}

const swiftEmitter = () => showcaseSwiftEmitter(
  "generated/GeneratedShowcaseProduct.swift",
  "generated/apple-native.json",
  [
    { id: "apple-iphone-swiftui", surfaces: ["compact", "wide"] },
    { id: "apple-watchos-swiftui", surfaces: ["round"] },
  ],
  CIRCLEKIT_ASSET_CATALOG,
  CIRCLEKIT_STYLE,
);

const garminEmitter = () => showcaseGarminEmitter(
  "generated/GeneratedCircleKitShowcase.mc",
  "generated/garmin-native.json",
  CIRCLEKIT_ASSET_CATALOG,
  CIRCLEKIT_STYLE,
);

function emittedRegistry(
  emitter: ProductEmitterPlugin,
  product: ReturnType<typeof compileCircleKitShowcaseProduct>,
  id: string,
): NativeBindingManifest {
  const output = emitter.emit(product).find((artifact) => artifact.id === id);
  assert.notEqual(output, undefined);
  return decodeNativeBindingManifest(JSON.parse(output!.content));
}

function nativeHosts(
  product: ReturnType<typeof compileCircleKitShowcaseProduct>,
  android: NativeBindingManifest,
): readonly NativeBindingManifest[] {
  return [
    android,
    emittedRegistry(swiftEmitter(), product, "showcase-swiftui-native-manifest"),
    emittedRegistry(garminEmitter(), product, "showcase-garmin-native-manifest"),
  ];
}

test("one compiled ProductSpec owns Android, Apple and Garmin Showcase structure", async () => {
  const android = await registry();
  const version = await productSpecVersion();
  assert.equal(version, "0.3.47");
  const product = compileCircleKitShowcaseProduct(version);
  // Read from the package rather than pinned to a literal: a hardcoded number goes
  // stale on every schema bump and only ever proves which version was current the
  // day the test was written.
  assert.equal(product.schemaVersion, PRODUCT_SPEC_SCHEMA_VERSION);
  assert.equal(product.schemaVersion, 9);
  assert.deepEqual(product.stateAuthorities, []);
  assert.deepEqual(product.artifacts.map(({ id }) => id), SHOWCASE_ARTIFACT_PROFILES);
  assert.equal(product.showcase.sections.length, 7);
  assert.equal(product.showcase.cases.length, 15);
  assert.deepEqual(product.nodeTypes.map(({ kind }) => kind), ["present", "service", "present"]);
  assert.equal(product.nodes.length, 3);
  assert.equal(product.componentTypes.length, product.showcase.cases.length + 2);
  assert.equal(product.components.length, product.showcase.cases.length + 2);
  assert.equal(product.componentFamilies.length, product.showcase.sections.length + 1);
  assert.deepEqual(product.artifacts.map(({ id, serves }) => ({ id, serves })), [
    { id: "phone-full-ui", serves: ["compact", "wide"] },
    { id: "wear-full-ui", serves: ["round"] },
    { id: "iphone-full-ui", serves: ["compact", "wide"] },
    { id: "watchos-full-ui", serves: ["round"] },
    { id: "garmin-limited-ui", serves: ["round"] },
  ]);
  for (const family of product.componentFamilies) {
    assert.deepEqual(family.family.trees.map(({ surface }) => surface), ["round", "compact", "wide"]);
  }
  assert.deepEqual(
    Object.fromEntries(SHOWCASE_ARTIFACT_PROFILES.map((artifact) => [
      artifact,
      product.artifactScopes.filter(({ artifactRef }) => artifactRef === artifact).length,
    ])),
    {
      "phone-full-ui": 14,
      "wear-full-ui": 7,
      "iphone-full-ui": 14,
      "watchos-full-ui": 7,
      "garmin-limited-ui": 1,
    },
  );
  assert.equal(product.portRegistry.nodePorts.length, 21);
  assert.equal(product.portRegistry.componentPorts.length, 47);
  assert.equal(product.portRegistry.bindings.length, 48);
  assert.equal(product.portRegistry.demandEdges.length, 0);
  assert.equal(product.navigation.activePagePortRef, "navigation.activePage");
  assert.equal(product.navigation.pageHostPortRef, "page.host.activePage");
  assert.deepEqual(product.navigation.artifacts[0], {
    artifactRef: "phone-full-ui",
    entryPageRef: "section.foundations",
    pages: [
      { pageRef: "section.foundations", restore: "root", guardContractRef: null, back: "system" },
      ...["atoms", "controls", "input", "media", "templates", "flows"].map((section) => ({
        pageRef: `section.${section}`, restore: "process", guardContractRef: null, back: "previous",
      })),
    ],
  });
  assert.deepEqual(product.navigation.actionGroups.find(({ componentInstanceRef }) =>
    componentInstanceRef === "page.menu")?.actions.map(({ sourcePortRef, targetPortRef, effect }) => ({
      sourcePortRef, targetPortRef, effect,
    })), [{ sourcePortRef: "page.menu.route", targetPortRef: "navigation.route", effect: "push" }]);
  assert.deepEqual(product.navigation.actionGroups.find(({ componentInstanceRef }) =>
    componentInstanceRef === "foundation.colors")?.actions.map(({ sourcePortRef, targetPortRef, effect }) => ({
      sourcePortRef, targetPortRef, effect,
    })), [{
    sourcePortRef: "foundation.colors.open",
    targetPortRef: "navigation.foundationColors",
    effect: "dispatch",
  }]);

  const first = buildOutputManifest(product, [
    productJsonEmitter("generated/showcase-product.json"),
    showcaseKotlinEmitter("generated/GeneratedShowcaseProduct.kt"),
    swiftEmitter(),
    garminEmitter(),
  ], ["generated"]);
  const second = buildOutputManifest(product, [
    productJsonEmitter("generated/showcase-product.json"),
    showcaseKotlinEmitter("generated/GeneratedShowcaseProduct.kt"),
    swiftEmitter(),
    garminEmitter(),
  ], ["generated"]);
  assert.deepEqual(first, second);
  const output = (id: string) => {
    const artifact = first.artifacts.find((candidate) => candidate.id === id);
    assert.notEqual(artifact, undefined);
    return artifact!;
  };
  const apple = decodeNativeBindingManifest(JSON.parse(output("showcase-swiftui-native-manifest").content));
  const garminRegistry = decodeNativeBindingManifest(JSON.parse(output("showcase-garmin-native-manifest").content));
  for (const host of [android, apple, garminRegistry]) {
    assert.deepEqual(productArtifactConformance(product, host), []);
  }
  assert.deepEqual(productArtifactHostCoverage(product, [android, apple, garminRegistry]), []);
  requireCircleKitShowcaseNativeConformance(product, android, [android, apple, garminRegistry]);

  const swiftGenerated = output("showcase-swiftui").content;
  for (const node of apple.nodes) {
    assert.match(swiftGenerated, new RegExp(`nativePortId: "${node.nativePortId.replaceAll(".", "\\.")}"`, "u"));
    for (const port of [...node.inputPorts, ...node.outputPorts]) {
      assert.match(swiftGenerated, new RegExp(`"${port}"`, "u"));
    }
  }
  assert.match(swiftGenerated, /static let navigationArtifacts:/u);
  assert.match(swiftGenerated, /effect: "dispatch"/u);
  assert.match(swiftGenerated, /effect: "push"/u);
  const garminGenerated = output("showcase-garmin-limited-ui").content;
  for (const node of garminRegistry.nodes) {
    assert.match(garminGenerated, new RegExp(`"nativePortId" => "${node.nativePortId.replaceAll(".", "\\.")}"`, "u"));
  }
  for (const { iconId } of garminRegistry.icons) {
    assert.match(garminGenerated, new RegExp(`"id" => "${iconId}"`, "u"));
  }
  assert.match(garminGenerated, /NATIVE_NAVIGATION_ARTIFACTS/u);
  assert.match(garminGenerated, /"effect" => "dispatch"/u);

  const swift = swiftEmitter();
  const swiftSource = swift.emit(product)[0]!.content;
  for (const section of ["foundations", "atoms", "controls", "input", "media", "templates", "flows"]) {
    assert.match(swiftSource, new RegExp(`screenId: "section\\.${section}"`, "u"));
  }
  assert.throws(() => swift.emit({
    ...product,
    artifacts: product.artifacts.filter(({ id }) => id !== "watchos-full-ui"),
  }), /apple-watchos-swiftui.*exactly one artifact, found 0/);

  const garmin = garminEmitter();
  assert.throws(() => garmin.emit({
    ...product,
    artifacts: product.artifacts.filter(({ id }) => id !== "garmin-limited-ui"),
  }), /garmin-connectiq-monkeyc.*exactly one artifact, found 0/);
  assert.throws(() => garmin.emit({
    ...product,
    artifactScopes: product.artifactScopes.filter(({ artifactRef }) => artifactRef !== "garmin-limited-ui"),
  }), /must expose one entry scope, found 0/);
});

test("native component, profile and icon drift stops before emission", async () => {
  const actual = await registry();
  const version = await productSpecVersion();
  const product = compileCircleKitShowcaseProduct(version);
  const hosts = nativeHosts(product, actual);
  const validateAndroid = (android: NativeBindingManifest) =>
    requireCircleKitShowcaseNativeConformance(product, android, [android, ...hosts.slice(1)]);
  assert.throws(() => validateAndroid({
    ...actual,
    components: actual.components.slice(1),
  }), /\[component\/missing\].*foundation\.colors@phone-full-ui/);
  assert.throws(() => validateAndroid({
    ...actual,
    components: actual.components.map((binding, index) => index === 0
      ? { ...binding, profiles: ["phone-full-ui"] }
      : binding),
  }), /renders on \[phone-full-ui\], but Showcase demonstrates every component/);
  assert.throws(() => validateAndroid({
    ...actual,
    icons: [...actual.icons, { iconId: "orphan", nativeSymbol: "RingIcons.Orphan" }],
  }), /\[icon\/orphan\] icon asset 'orphan'/);
  assert.throws(() => validateAndroid({
    ...actual,
    nodes: actual.nodes.map((node) => node.nodeId === "navigation"
      ? { ...node, inputPorts: node.inputPorts.slice(1) }
      : node),
  }), /\[node-port\/missing\].*navigation\./);
  assert.throws(() => validateAndroid({
    ...actual,
    navigation: {
      ...actual.navigation,
      actionGroups: actual.navigation.actionGroups.filter(({ componentInstanceRef }) => componentInstanceRef !== "page.menu"),
    },
  }), /\[navigation\/missing\].*page\.menu/);

  const appleHost = hosts.find(({ profiles }) => profiles?.includes("iphone-full-ui") === true);
  if (appleHost?.profiles === undefined) throw new Error("missing executable Apple host registration");
  const withoutNativePage = structuredClone(appleHost) as Mutable<NativeBindingManifest>;
  const nativeIphoneArtifact = withoutNativePage.navigation.artifacts
    .find(({ artifactRef }) => artifactRef === "iphone-full-ui");
  if (nativeIphoneArtifact === undefined) throw new Error("missing emitted iPhone navigation registration");
  const nativeFlowsPageIndex = nativeIphoneArtifact.pages
    .findIndex(({ pageRef }) => pageRef === "section.flows");
  if (nativeFlowsPageIndex < 0) throw new Error("missing emitted flows page registration");
  nativeIphoneArtifact.pages.splice(nativeFlowsPageIndex, 1);
  assert.match(
    productArtifactConformance(product, withoutNativePage).map(({ message }) => message).join("\n"),
    /section\.flows/u,
  );

  const changedExecutableBack = structuredClone(appleHost) as Mutable<NativeBindingManifest>;
  const nativeAtomsPage = changedExecutableBack.navigation.artifacts
    .find(({ artifactRef }) => artifactRef === "iphone-full-ui")?.pages
    .find(({ pageRef }) => pageRef === "section.atoms");
  if (nativeAtomsPage === undefined) throw new Error("missing emitted atoms page registration");
  nativeAtomsPage.back = "system";
  assert.match(
    productArtifactConformance(product, changedExecutableBack).map(({ message }) => message).join("\n"),
    /back.*section\.atoms|section\.atoms.*back/u,
  );
  assert.throws(() => requireCircleKitShowcaseNativeConformance(
    product, actual, hosts.slice(0, 2),
  ), /\[artifact\/missing\].*garmin-limited-ui/);
});
