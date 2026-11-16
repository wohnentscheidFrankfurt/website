import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeAddress } from "../../api/src/address.ts";

test("trims and lower-cases", () => {
  assert.equal(normalizeAddress("  Anna@Example.ORG "), "anna@example.org");
});

test("keeps a pipe in the local part", () => {
  assert.equal(normalizeAddress("a|b@example.org"), "a|b@example.org");
});

for (const bad of ["", "anna", "a@b@c.de", "anna@localhost", "an na@x.de", "an\nna@x.de", "müller@x.de", "a,b@x.de", "@x.de", "a@"]) {
  test(`rejects ${JSON.stringify(bad)}`, () => {
    assert.equal(normalizeAddress(bad), null);
  });
}

test("rejects forbidden characters", () => {
  for (const c of ";<>\"()[]\\") assert.equal(normalizeAddress(`a${c}b@x.de`), null, c);
});

test("rejects 255 characters, accepts 254", () => {
  const domain = "@x.de";
  assert.equal(normalizeAddress("a".repeat(255 - domain.length) + domain), null);
  assert.notEqual(normalizeAddress("a".repeat(254 - domain.length) + domain), null);
});
