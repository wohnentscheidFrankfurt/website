# Wohnentscheid Website – notes for Claude

Website for wohnentscheid-frankfurt.de. It replaces the IONOS Web-Builder. The structure follows https://b-side.ms/
(events, about us, news, support, contact, imprint, privacy, English version); design and brand are our own.
The team does not edit texts. It sends wishes; we build them in a session and deploy.

## Rules

- **Never paste passwords into the chat, and never ask the user for one.** Keys and passphrases stay in the macOS
  keychain.
- The repo is public on GitHub: `wohnentscheidFrankfurt/website`. Never commit secrets, personal data or internal
  matters of the initiative. Push only after asking the user. Commits end with the Co-Authored-By line.
- Language: texts of the site (`src/pages/`, `src/views/`, `src/content/`, `src/i18n/`) are German and English.
  English follows `docs/architecture.md`, Languages. Everything else in the repo (code, comments,
  `docs/`, file names) is English. Always short sentences, one statement per sentence.
- Privacy: no tracking, no external fonts, scripts or CDNs. The site loads nothing from other origins. Tests check
  this.
- Architecture, server and deploy are in `docs/architecture.md`. Read it before a change there. A decision made in
  chat updates the matching file in `docs/` in the same commit. No dated protocol files.
- Docs follow [Diátaxis](https://diataxis.fr/): how-to, reference and explanation stay apart. As simple and short
  as possible, but still good. A new file only when there is content for it.

## Commands

```bash
npm run dev       # dev server on http://localhost:4321
npm run build     # static site to dist/
# `npm test` and `npm run dev:api` need `cd api && npm ci` once (a fresh clone cannot resolve nodemailer otherwise)
npm test          # API tests, then Playwright checks against dist/ (build first; needs Mailpit and Caddy: brew install mailpit caddy)
npm run dev:api   # sign-up API on :8787 (start Mailpit for the mails: mailpit)
./deploy.sh       # clean tree, npm ci, build, test, rsync to the server, Git tag deploy-<date>
```

Rollback: first check out the map commit named in the tag message in `../sozialraum-frankfurt` and rebuild the map.
Then `git checkout <deploy tag> && ./deploy.sh`. Then `git switch main` in both repos. Tags from before 16.11.2026
live only in the archive clone `../website-archiv` (`docs/architecture.md`, Deploy).

## Layout

- `src/pages/`: one file per page (start, events, Impressum, Datenschutz, `/danke/`, `/fehler/`, `/bestaetigen/`),
  English twins in `src/pages/en/`. `src/views/`: bodies of the start, events and after-form pages, shared by both languages.
  `src/i18n/`: route table (`routes.ts`) and dictionary (`ui.ts`).
  `src/layouts/Base.astro`: frame of every page (language, meta tags, base styles).
- `integrations/`: Astro integrations. `map.mjs` checks the map repo `../sozialraum-frankfurt` and copies its HTML
  to `dist/sozialraum-frankfurt/` (the map page, German only, not in `src/pages/`).
- `src/components/`: header, menu, heart, footer (three columns), event card, flyer with countdown and share sticker,
  "Mitmachen" (`Join`), language switch (`LangSwitch`), band "Bleib informiert" above the footer (`StayInformed`),
  map teaser on the German start page (`MapTeaser`), the Instagram mark of footer and phone menu (`InstagramIcon`).
- `src/content/events/`: one Markdown file per event. `src/lib/events.ts`: date logic.
- `src/lib/nav.ts`: menu items. The desktop bar and the phone menu both read them. `src/lib/social.ts`: our
  Instagram and GitHub addresses.
- `src/assets/`: brand, drawings, event photos and the map teaser image (`map/`). Raster originals are re-encoded at build and never reach `dist/` (except the Signal QR codes). SVGs are copied as they are; a check scans them.
- `api/`: Node service for the newsletter sign-up (`api/src/`, own `package.json`). `server/`: Caddyfile, systemd
  units and `set-secrets.sh`, the source of the live files.
- `tests/`: Playwright checks (desktop Chrome, Chrome at 390 px with touch, iPhone in WebKit). `tests/api/`: `node:test` checks of the API.
- `docs/`: the living docs. They describe the project as it is now; Git keeps the past. `architecture.md`
  (reference and explanation: build, checks, server, deploy), `add-event.md` (how-to).
- `dist/`, `node_modules/`, `test-results/`: not in Git.

## Way of working (confirmed by the user)

1. Spec and plan of a branch are temporary files outside the repo, in
   `~/Library/Application Support/JetBrains/IntelliJIdea2026.3/scratches/`. Implementation with TDD on a branch,
   a final review by a fresh reviewer, then merge to `main`. What stays valid moves into `docs/` before the merge.
2. Short status messages during long runs, otherwise no questions. Ask real decisions one at a time, with a
   recommendation.
3. If the spec changes, add an addendum and tell the user.

## Memory

The project memory lies in `~/.claude/projects/-Users-sven-nagel-IdeaProjects-we-website/memory/`.
