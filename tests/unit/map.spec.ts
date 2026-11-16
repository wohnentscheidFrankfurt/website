import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
// @ts-expect-error plain ESM without types
import { checkMap } from "../../integrations/map.mjs";

const git = (repo: string, ...args: string[]) =>
  execFileSync("git", ["-C", repo, "-c", "user.name=t", "-c", "user.email=t@t", ...args], { encoding: "utf8" }).trim();

// A map repo with one commit, a map file touched after it and a green check report.
function makeRepo(): string {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "map-"));
  git(repo, "init", "-q");
  fs.mkdirSync(path.join(repo, "output"));
  fs.mkdirSync(path.join(repo, "interim"));
  fs.writeFileSync(path.join(repo, "output/sozialraum-frankfurt.html"), "<html>map</html>");
  fs.writeFileSync(path.join(repo, "interim/check_report.md"), "| OK | something |\n");
  git(repo, "add", ".");
  git(repo, "commit", "-q", "-m", "map");
  const later = new Date(Date.now() + 5000);
  fs.utimesSync(path.join(repo, "output/sozialraum-frankfurt.html"), later, later);
  return repo;
}

test("accepts a clean repo with a green report", () => {
  const repo = makeRepo();
  const result = checkMap(repo);
  expect(result.commit).toBe(git(repo, "rev-parse", "--short", "HEAD"));
  expect(result.file).toBe(path.join(repo, "output/sozialraum-frankfurt.html"));
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
