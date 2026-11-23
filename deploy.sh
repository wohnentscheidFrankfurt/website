#!/usr/bin/env bash
# Build, check and upload the API and the site. Each deployment sets a Git tag.
# Rollback: git checkout <deploy tag> && ./deploy.sh. A tag from before the API rolls back the site only.
# The tag message names the map commit. Check it out in ../sozialraum-frankfurt and rebuild the map first.
set -euo pipefail
cd "$(dirname "$0")"

# The Mac's /usr/bin/rsync is openrsync. Use the rsync from Homebrew.
RSYNC=/opt/homebrew/bin/rsync
API_TARGET=wohnentscheid-deploy-api:/
TARGET=wohnentscheid-deploy:/
URL=https://wohnentscheid-frankfurt.de

# MAP_REPO would build from another map repo, but the tag names the commit of ../sozialraum-frankfurt.
if [[ -n "${MAP_REPO:-}" ]]; then
  echo "MAP_REPO is set. Unset it: a deploy builds the map of ../sozialraum-frankfurt." >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree is not clean. Commit first, so the tag matches what goes online." >&2
  exit 1
fi

tag="deploy-$(date +%Y-%m-%d-%H%M%S)"

npm ci
(cd api && npm ci && npm run check)
npm run build
map_commit="$(git -C ../sozialraum-frankfurt rev-parse --short HEAD)"
npm test # needs Mailpit and Caddy: brew install mailpit caddy

# The API first, so the form never posts to an old API. The stamp file goes last: it restarts the API.
(cd api && npm ci --omit=dev)
"$RSYNC" -az --delete --exclude=/deployed --exclude=/tsconfig.json api/ "$API_TARGET"
# The stamp lives outside the repo, so it never dirties the tree (old tags have no ignore rule for it).
stamp="$(mktemp)"
printf '%s\n' "$tag" > "$stamp"
"$RSYNC" -az "$stamp" "${API_TARGET}deployed"
rm -f "$stamp"
(cd api && npm ci) # dev dependencies back for the type check and the IDE

"$RSYNC" -az --delete dist/ "$TARGET"

# Smoke check: a filled honeypot answers 303 to the thanks page and sends no mail. The API needs a moment to restart.
# Both routes are checked: German and English.
smoke_check() {
  local path="$1" location="$2" label="$3"
  local expected="303 $URL$location" result=""
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    result="$(curl -s --max-time 5 -o /dev/null -w '%{http_code} %{redirect_url}' -X POST \
      --data 'email=smoke@example.org&website=x' "$URL$path" || true)"
    [[ "$result" == "$expected" ]] && return 0
    sleep 1
  done
  echo "Smoke check failed$label: got '$result', expected '$expected'. No tag set." >&2
  exit 1
}
smoke_check /api/anmelden /danke/ ""
smoke_check /api/en/signup /en/thanks/ " (English)"

git tag -a "$tag" -m "Site $(git rev-parse --short HEAD), map sozialraum-frankfurt $map_commit"
echo "Deployed $(git rev-parse --short HEAD) with map $map_commit as $tag."
