import assert from "node:assert/strict";
import test from "node:test";
import { checkV1dPins } from "../src/pin-check.js";

const name = "@v1d/example";
const url = "https://circlekit.pages.dev/npm/v1d/example/1.2.3/v1d-example-1.2.3.tgz";

function fixture(spec = url, lockOverrides: Record<string, unknown> = {}) {
  return checkV1dPins({ dependencies: { [name]: spec } }, {
    packages: {
      "": { dependencies: { [name]: spec } },
      [`node_modules/${name}`]: {
        version: "1.2.3",
        resolved: spec,
        integrity: "sha512-YWJjZA==",
        ...lockOverrides,
      },
    },
  });
}

test("the reusable pin check accepts one exact immutable URL plus lock integrity", () => {
  assert.deepEqual(fixture(), { dependencies: [name], errors: [] });
});

test("the reusable pin check rejects local, workspace, floating and unlocked @v1d dependencies", () => {
  for (const spec of [
    "file:../product-spec",
    "workspace:*",
    "../product-spec",
    "^1.2.3",
    "https://circlekit.pages.dev/npm/v1d/example/latest/v1d-example-latest.tgz",
  ]) {
    assert.ok(fixture(spec).errors.some((error) => error.includes("immutable HTTPS tarball URL")
      || error.includes("must end in")), spec);
  }
  assert.ok(fixture(url, { integrity: undefined }).errors.includes(
    `${name}: package-lock is missing sha512 integrity`,
  ));
  assert.ok(fixture(url, { resolved: `${url}?moving=true` }).errors.includes(
    `${name}: package-lock resolved URL does not equal the package.json pin`,
  ));
});

test("the reusable pin check discovers every @v1d dependency section without a package list", () => {
  const sections = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"] as const;
  for (const section of sections) {
    const result = checkV1dPins({ [section]: { [name]: url } }, {
      packages: {
        "": { [section]: { [name]: url } },
        [`node_modules/${name}`]: {
          version: "1.2.3",
          resolved: url,
          integrity: "sha512-YWJjZA==",
        },
      },
    });
    assert.deepEqual(result, { dependencies: [name], errors: [] }, section);
  }
});
