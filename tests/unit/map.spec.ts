import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
// @ts-expect-error plain ESM without types
import { checkMap, englishOnline } from "../../integrations/map.mjs";

const git = (repo: string, ...args: string[]) =>
  execFileSync("git", ["-C", repo, "-c", "user.name=t", "-c", "user.email=t@t", ...args], { encoding: "utf8" }).trim();

const DE = "output/sozialraum-frankfurt.html";
const EN = "output/sozialraum-frankfurt.en.html";
// The map build writes this link into the German map only when the English map is online.
const ONLINE = '<html><link rel="alternate" hreflang="en" href="https://wohnentscheid-frankfurt.de/en/sozialraum-frankfurt/">map</html>';

// Sets the modification time of the map files a few seconds after now, so they are newer than HEAD.
function touch(repo: string) {
  const later = new Date(Date.now() + 5000);
  for (const name of [DE, EN]) {
    if (fs.existsSync(path.join(repo, name))) fs.utimesSync(path.join(repo, name), later, later);
  }
}

// A map repo with one commit, map files touched after it and a green check report.
// Offline: only the German map counts. Online: the German map links the English one.
function makeRepo({ english = false } = {}): string {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "map-"));
  git(repo, "init", "-q");
  fs.mkdirSync(path.join(repo, "output"));
  fs.mkdirSync(path.join(repo, "interim"));
  fs.writeFileSync(path.join(repo, DE), english ? ONLINE : "<html>map</html>");
  fs.writeFileSync(path.join(repo, EN), "<html lang=\"en-GB\">map</html>");
  fs.writeFileSync(path.join(repo, "interim/check_report.md"), "| OK | something |\n");
  git(repo, "add", ".");
  git(repo, "commit", "-q", "-m", "map");
  touch(repo);
  return repo;
}

test("accepts a clean repo with a green report", () => {
  const repo = makeRepo();
  const result = checkMap(repo);
  expect(result.commit).toBe(git(repo, "rev-parse", "--short", "HEAD"));
  expect(result.files).toEqual({ de: path.join(repo, DE) });
});

test("rejects a missing map file", () => {
  const repo = makeRepo();
  fs.rmSync(path.join(repo, "output/sozialraum-frankfurt.html"));
  git(repo, "commit", "-q", "-am", "drop");
  expect(() => checkMap(repo)).toThrow(/build the map/i);
});

test("rejects a WARN or FAIL line in the check report", () => {
  for (const level of ["WARN", "FAIL"]) {
    const repo = makeRepo();
    fs.writeFileSync(path.join(repo, "interim/check_report.md"), `| OK | a |\n| ${level} | b |\n`);
    git(repo, "commit", "-q", "-am", "report");
    const later = new Date(Date.now() + 5000);
    fs.utimesSync(path.join(repo, "output/sozialraum-frankfurt.html"), later, later);
    expect(() => checkMap(repo), level).toThrow(/check report/i);
  }
});

test("rejects uncommitted changes", () => {
  const repo = makeRepo();
  fs.writeFileSync(path.join(repo, "stray.txt"), "x");
  expect(() => checkMap(repo)).toThrow(/uncommitted/i);
});

test("rejects a build older than HEAD", () => {
  const repo = makeRepo();
  const head = Number(git(repo, "log", "-1", "--format=%ct"));
  const old = new Date((head - 60) * 1000);
  fs.utimesSync(path.join(repo, "output/sozialraum-frankfurt.html"), old, old);
  expect(() => checkMap(repo)).toThrow(/rebuild the map/i);
});

test("rejects a local path in the map file", () => {
  const repo = makeRepo();
  fs.writeFileSync(path.join(repo, "output/sozialraum-frankfurt.html"), "<html>/Users/someone/x</html>");
  git(repo, "commit", "-q", "-am", "leak");
  const later = new Date(Date.now() + 5000);
  fs.utimesSync(path.join(repo, "output/sozialraum-frankfurt.html"), later, later);
  expect(() => checkMap(repo)).toThrow(/\/Users\//);
});

test("lists every problem at once", () => {
  const repo = makeRepo();
  fs.rmSync(path.join(repo, "output/sozialraum-frankfurt.html"));
  git(repo, "commit", "-q", "-am", "drop");
  fs.writeFileSync(path.join(repo, "stray.txt"), "x");
  let message = "";
  try { checkMap(repo); } catch (e) { message = (e as Error).message; }
  expect(message).toMatch(/build the map/i);
  expect(message).toMatch(/uncommitted/i);
  expect(message.split("\n").length).toBeGreaterThanOrEqual(2);
});

test("englishOnline reads the hreflang link of the German map", () => {
  expect(englishOnline(makeRepo())).toBe(false);
  expect(englishOnline(makeRepo({ english: true }))).toBe(true);
});

test("englishOnline is false without a German map", () => {
  const repo = makeRepo({ english: true });
  fs.rmSync(path.join(repo, DE));
  expect(englishOnline(repo)).toBe(false);
});

test("returns the English map when the German map links it", () => {
  const repo = makeRepo({ english: true });
  expect(checkMap(repo).files).toEqual({ de: path.join(repo, DE), en: path.join(repo, EN) });
});

test("ignores a broken English map while the English map is offline", () => {
  const repo = makeRepo();
  fs.writeFileSync(path.join(repo, EN), "<html>/Users/someone/x</html>");
  git(repo, "commit", "-q", "-am", "leak");
  touch(repo);
  expect(checkMap(repo).files).toEqual({ de: path.join(repo, DE) });
});

test("rejects a missing English map when the German map links it", () => {
  const repo = makeRepo({ english: true });
  fs.rmSync(path.join(repo, EN));
  git(repo, "commit", "-q", "-am", "drop");
  touch(repo);
  expect(() => checkMap(repo)).toThrow(/English map file .* is missing/i);
});

test("rejects an English map older than HEAD", () => {
  const repo = makeRepo({ english: true });
  const head = Number(git(repo, "log", "-1", "--format=%ct"));
  const old = new Date((head - 60) * 1000);
  fs.utimesSync(path.join(repo, EN), old, old);
  expect(() => checkMap(repo)).toThrow(/English map file is older/i);
});

test("rejects a local path in the English map", () => {
  const repo = makeRepo({ english: true });
  fs.writeFileSync(path.join(repo, EN), "<html>/Users/someone/x</html>");
  git(repo, "commit", "-q", "-am", "leak");
  touch(repo);
  expect(() => checkMap(repo)).toThrow(/English map file contains a local path/i);
});
