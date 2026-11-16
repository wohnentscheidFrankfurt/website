import { test } from "node:test";
import assert from "node:assert/strict";
import { RateLimiter, ipKey } from "../../api/src/limit.ts";

test("sliding window", () => {
  const l = new RateLimiter(2, 1000);
  assert.equal(l.hit("k", 0), true);
  assert.equal(l.hit("k", 1), true);
  assert.equal(l.hit("k", 2), false);
  assert.equal(l.hit("k", 1001), true);
});

test("a refused hit is not counted", () => {
  const l = new RateLimiter(1, 1000);
  assert.equal(l.hit("k", 0), true);
  assert.equal(l.hit("k", 500), false);
  assert.equal(l.hit("k", 1001), true);
});

test("keys are independent", () => {
  const l = new RateLimiter(1, 1000);
  assert.equal(l.hit("a", 0), true);
  assert.equal(l.hit("b", 0), true);
  assert.equal(l.hit("a", 1), false);
});

test("ipKey", () => {
  assert.equal(ipKey("1.2.3.4"), "1.2.3.4");
  assert.equal(ipKey("::ffff:1.2.3.4"), "1.2.3.4");
  assert.equal(ipKey("2a01:4f8:1c1a:d7a3::1"), ipKey("2a01:4f8:1c1a:d7a3:ffff::2"));
  assert.notEqual(ipKey("2a01:4f8:1c1a:d7a3::1"), ipKey("2a01:4f8:1c1a:d7a4::1"));
  assert.equal(ipKey("::1"), "0:0:0:0");
});

test("sweep drops keys whose hits are all outside the window", () => {
  const l = new RateLimiter(2, 1000);
  l.hit("a", 0);
  l.hit("b", 900);
  assert.equal(l.size, 2);
  l.sweep(1000);
  assert.equal(l.size, 1);
  l.sweep(1900);
  assert.equal(l.size, 0);
});

test("sweep keeps a key with a recent hit and its count", () => {
  const l = new RateLimiter(1, 1000);
  l.hit("a", 0);
  l.hit("a", 1500);
  l.sweep(1600);
  assert.equal(l.size, 1);
  assert.equal(l.hit("a", 1700), false);
});

test("hit prunes only its own key", () => {
  const l = new RateLimiter(1, 1000);
  l.hit("old", 0);
  l.hit("new", 5000);
  assert.equal(l.size, 2);
});
