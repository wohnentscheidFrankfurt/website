import { test } from "node:test";
import assert from "node:assert/strict";
import { createToken, verifyToken } from "../../api/src/token.ts";

const H72 = 72 * 3600 * 1000;
const now = 1_000_000;

test("round trip", () => {
  assert.equal(verifyToken(createToken("anna@example.org", now, "s"), now, "s"), "anna@example.org");
});

test("round trip with a pipe", () => {
  assert.equal(verifyToken(createToken("a|b@example.org", now, "s"), now, "s"), "a|b@example.org");
});

test("valid at 72 h, expired one ms later", () => {
  const t = createToken("anna@example.org", now, "s");
  assert.equal(verifyToken(t, now + H72, "s"), "anna@example.org");
  assert.equal(verifyToken(t, now + H72 + 1, "s"), null);
});

test("other secret", () => {
  assert.equal(verifyToken(createToken("anna@example.org", now, "s"), now, "x"), null);
});

test("flipped signature char", () => {
  const t = createToken("anna@example.org", now, "s");
  const dot = t.indexOf(".") + 1;
  const flipped = t.slice(0, dot) + (t[dot] === "A" ? "B" : "A") + t.slice(dot + 1);
  assert.equal(verifyToken(flipped, now, "s"), null);
});

test("malformed", () => {
  for (const t of ["abc", "", "a.b.c"]) assert.equal(verifyToken(t, now, "s"), null);
});
