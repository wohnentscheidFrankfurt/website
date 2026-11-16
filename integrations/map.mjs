// Serves the map "Sozialraum Frankfurt" at /sozialraum-frankfurt/, unchanged.
// The map is one HTML file built in the sibling repo. After the build it is checked and copied into dist/.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FILE = "output/sozialraum-frankfurt.html";
const REPORT = "interim/check_report.md";

const git = (repo, ...args) => execFileSync("git", ["-C", repo, ...args], { encoding: "utf8" }).trim();

// Returns the map file and the short commit of the map repo. Throws one line per problem.
export function checkMap(repo) {
  const file = path.join(repo, FILE);
  const report = path.join(repo, REPORT);
  const problems = [];

  const hasFile = fs.existsSync(file);
  if (!hasFile) problems.push(`Map file ${file} is missing. Build the map in ${repo}.`);

  if (!fs.existsSync(report)) {
    problems.push(`Check report ${report} is missing. Run the checks in ${repo}.`);
  } else {
    const bad = fs.readFileSync(report, "utf8").split("\n").filter((l) => /^\| (WARN|FAIL)/.test(l));
    if (bad.length) problems.push(`Check report has ${bad.length} WARN or FAIL line(s). Fix them in ${repo}.`);
  }

  let commit = "";
  try {
    if (git(repo, "status", "--porcelain")) problems.push(`Map repo ${repo} has uncommitted changes. Commit or discard them.`);
    commit = git(repo, "rev-parse", "--short", "HEAD");
    const headTime = Number(git(repo, "log", "-1", "--format=%ct"));
    if (hasFile && fs.statSync(file).mtimeMs < headTime * 1000) {
      problems.push(`Map file is older than the HEAD commit of ${repo}. Rebuild the map.`);
    }
  } catch (e) {
    problems.push(`Cannot read the Git state of ${repo}: ${e.message}`);
  }

  if (hasFile && fs.readFileSync(file, "utf8").includes("/Users/")) {
    problems.push(`Map file contains a local path (/Users/). Remove it and rebuild the map.`);
  }

  if (problems.length) throw new Error(problems.join("\n"));
  return { file, commit };
}

export function mapIntegration(options = {}) {
  let root;
  return {
    name: "sozialraum-frankfurt",
    hooks: {
      "astro:config:done": ({ config }) => {
        root = fileURLToPath(config.root);
      },
      "astro:build:done": ({ dir, logger }) => {
        const repo = options.repo ?? path.resolve(root, "../sozialraum-frankfurt");
        const { file, commit } = checkMap(repo);
        const target = path.join(fileURLToPath(dir), "sozialraum-frankfurt", "index.html");
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(file, target);
        logger.info(`Map copied from commit ${commit}.`);
      },
    },
  };
}
