// Serves the map "Sozialraum Frankfurt", unchanged: German at /sozialraum-frankfurt/, English at
// /en/sozialraum-frankfurt/. The map is one HTML file per language, built in the sibling repo. After the build both
// are checked and copied into dist/.
// The English map is online only when the map build says so: then the German map links it with hreflang="en"
// (ENGLISH_ONLINE in the map repo's pipeline/config.py). Until then the site neither checks nor copies it.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FILES = { de: "output/sozialraum-frankfurt.html", en: "output/sozialraum-frankfurt.en.html" };
const TARGETS = { de: "sozialraum-frankfurt/index.html", en: "en/sozialraum-frankfurt/index.html" };
const NAMES = { de: "Map file", en: "English map file" };
const REPORT = "interim/check_report.md";
const VIRTUAL = "virtual:map";
// The teaser image of the English start page. Imported only while the English map is online: an image that is
// imported but never rendered would reach dist/ as its original (tests/unit/images.spec.ts).
const TEASER_EN = "src/assets/map/teaser-en.png";

const git = (repo, ...args) => execFileSync("git", ["-C", repo, ...args], { encoding: "utf8" }).trim();

// True when the German map links the English one, so the English map is online.
export function englishOnline(repo) {
  const file = path.join(repo, FILES.de);
  return fs.existsSync(file) && fs.readFileSync(file, "utf8").includes('hreflang="en"');
}

// Returns the map files by language and the short commit of the map repo. Throws one line per problem.
export function checkMap(repo) {
  const report = path.join(repo, REPORT);
  const langs = englishOnline(repo) ? ["de", "en"] : ["de"];
  const files = Object.fromEntries(langs.map((lang) => [lang, path.join(repo, FILES[lang])]));
  const problems = [];

  for (const lang of langs) {
    if (!fs.existsSync(files[lang])) problems.push(`${NAMES[lang]} ${files[lang]} is missing. Build the map in ${repo}.`);
  }

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
    for (const lang of langs) {
      if (fs.existsSync(files[lang]) && fs.statSync(files[lang]).mtimeMs < headTime * 1000) {
        problems.push(`${NAMES[lang]} is older than the HEAD commit of ${repo}. Rebuild the map.`);
      }
    }
  } catch (e) {
    problems.push(`Cannot read the Git state of ${repo}: ${e.message}`);
  }

  for (const lang of langs) {
    if (fs.existsSync(files[lang]) && fs.readFileSync(files[lang], "utf8").includes("/Users/")) {
      problems.push(`${NAMES[lang]} contains a local path (/Users/). Remove it and rebuild the map.`);
    }
  }

  if (problems.length) throw new Error(problems.join("\n"));
  return { files, commit };
}

// options.repo: the map repo, relative to the site root or absolute. Default ../sozialraum-frankfurt.
// Pages read `import { englishMap, englishTeaser } from "virtual:map"`: englishMap is true when the English map is
// online, englishTeaser is then the English teaser image, else null.
export function mapIntegration(options = {}) {
  let repo;
  let english;
  return {
    name: "sozialraum-frankfurt",
    hooks: {
      "astro:config:setup": ({ config, updateConfig }) => {
        const root = fileURLToPath(config.root);
        repo = path.resolve(root, options.repo ?? "../sozialraum-frankfurt");
        english = englishOnline(repo);
        const code = english
          ? `export const englishMap = true;\nexport { default as englishTeaser } from ${JSON.stringify(path.join(root, TEASER_EN))};`
          : "export const englishMap = false;\nexport const englishTeaser = null;";
        updateConfig({
          vite: {
            plugins: [{
              name: "sozialraum-frankfurt-flag",
              resolveId: (id) => (id === VIRTUAL ? `\0${VIRTUAL}` : undefined),
              load: (id) => (id === `\0${VIRTUAL}` ? code : undefined),
            }],
          },
        });
      },
      "astro:build:done": ({ dir, logger }) => {
        const { files, commit } = checkMap(repo);
        // The pages were built with the flag of the setup. A map that changed state since then would not fit them.
        if (Boolean(files.en) !== english) throw new Error(`The English map went ${english ? "offline" : "online"} during the build. Build again.`);
        for (const [lang, file] of Object.entries(files)) {
          const target = path.join(fileURLToPath(dir), TARGETS[lang]);
          fs.mkdirSync(path.dirname(target), { recursive: true });
          fs.copyFileSync(file, target);
        }
        logger.info(`Map copied from commit ${commit}${files.en ? ", German and English" : ", German only"}.`);
      },
    },
  };
}
