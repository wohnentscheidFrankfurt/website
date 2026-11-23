import { test, expect } from "@playwright/test";
import fs from "node:fs";

const read = (file: string) => fs.readFileSync(file, "utf8");

test("Caddyfile keeps the live log filter and headers", () => {
  const c = read("server/Caddyfile");
  for (const line of [
    "exclude http.log.access http.log.error",
    "X-Content-Type-Options nosniff",
    "Referrer-Policy strict-origin-when-cross-origin",
    "X-Frame-Options DENY",
    "-Server",
    "request>headers delete",
    "request>tls delete",
    "request>remote_port delete",
    "resp_headers delete",
    "request>remote_ip ip_mask 16 32",
    "request>client_ip ip_mask 16 32",
    "roll_keep_for 144h",
    "redir https://wohnentscheid-frankfurt.de{uri} permanent",
  ]) expect(c, line).toContain(line);
});

test("Caddyfile proxies /api/* and serves the site in a second handle", () => {
  const c = read("server/Caddyfile");
  expect(c).toMatch(/handle \/api\/\* \{[^}]*request_body \{\s*max_size 4KB\s*\}[^}]*reverse_proxy 127\.0\.0\.1:8787/s);
  expect(c).toMatch(/handle \{\s*root \* \/var\/www\/wohnentscheid\s*file_server\s*\}/);
  expect(c.indexOf("handle /api/*")).toBeLessThan(c.indexOf("root * /var/www/wohnentscheid"));
});

test("Caddyfile proxies the map tiles before the static site, to one upstream and without log", () => {
  const c = read("server/Caddyfile");
  const block = c.indexOf("handle_path /sozialraum-frankfurt/kacheln/* {");
  expect(block).toBeGreaterThan(c.indexOf("wohnentscheid-frankfurt.de {"));
  expect(block).toBeLessThan(c.indexOf("root * /var/www/wohnentscheid"));
  const body = c.slice(block, c.indexOf("\n\t}\n", block));
  expect(body).toContain("log_skip");
  expect(c.split("https://sgx.geodatenzentrum.de").length - 1).toBe(1);
  expect(body).toContain("https://sgx.geodatenzentrum.de");
});

test("Caddyfile sends a failed sign-up POST to /fehler/ when the API is down, the English one to /en/error/", () => {
  const c = read("server/Caddyfile");
  expect(c).toMatch(/handle_errors 502 503 504 \{\s*@signup path \/api\/anmelden\s*redir @signup \/fehler\/ 303\s*@signupEn path \/api\/en\/signup\s*redir @signupEn \/en\/error\/ 303\s*\}/);
});

test("deploy.sh smoke-checks both sign-up routes with a filled honeypot", () => {
  const d = read("deploy.sh");
  expect(d).toContain('smoke_check /api/anmelden /danke/ ""');
  expect(d).toContain('smoke_check /api/en/signup /en/thanks/ " (English)"');
  // The honeypot keeps the check from sending a real mail on every deploy.
  expect(d.split("--data 'email=smoke@example.org&website=x'").length - 1).toBe(1);
  expect(d).toMatch(/--data 'email=smoke@example\.org&website=x' "\$URL\$path"/);
  expect(d).toContain("expected=\"303 $URL$location\"");
});

test("Caddyfile sets no trusted_proxies: the API trusts the first X-Forwarded-For entry", () => {
  // Without trusted_proxies, reverse_proxy replaces a client-sent X-Forwarded-For with the real address.
  expect(read("server/Caddyfile").replace(/^\s*#.*$/gm, "")).not.toContain("trusted_proxies");
});

test("API unit is hardened and holds no secret", () => {
  const u = read("server/wohnentscheid-api.service");
  for (const line of [
    "DynamicUser=yes",
    "ExecStart=/usr/bin/node /opt/wohnentscheid-api/src/main.ts",
    "LoadCredentialEncrypted=smtp-password:/etc/credstore.encrypted/wohnentscheid-api-smtp-password",
    "LoadCredentialEncrypted=token-secret:/etc/credstore.encrypted/wohnentscheid-api-token-secret",
    "ProtectSystem=strict",
    "ProtectHome=yes",
    "PrivateTmp=yes",
    "NoNewPrivileges=yes",
    "RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX",
    "MemoryMax=128M",
    "Restart=on-failure",
    "WantedBy=multi-user.target",
  ]) expect(u, line).toContain(line);
  expect(u).not.toMatch(/^Environment=.*PASSWORD/im);
});

test("the path unit restarts the API when the deploy stamp changes", () => {
  expect(read("server/wohnentscheid-api-restart.path")).toContain("PathChanged=/opt/wohnentscheid-api/deployed");
  const s = read("server/wohnentscheid-api-restart.service");
  expect(s).toContain("Type=oneshot");
  expect(s).toContain("ExecStart=/usr/bin/systemctl restart wohnentscheid-api.service");
});

test("set-secrets.sh prints no secret", () => {
  const s = read("server/set-secrets.sh");
  expect(s).toContain("set -euo pipefail");
  expect(s).toContain("security find-generic-password -s wohnentscheid-mail -a IONOS_PASSWORD -w");
  expect(s).not.toMatch(/\becho\b[^\n]*\$/); // no echo of a variable
});

test("deploy.sh uploads the API before the site", () => {
  const d = read("deploy.sh");
  const api = d.indexOf('"$RSYNC" -az --delete --exclude=/deployed --exclude=/tsconfig.json api/ "$API_TARGET"');
  const stamp = d.indexOf('"$RSYNC" -az "$stamp" "${API_TARGET}deployed"');
  const site = d.indexOf('"$RSYNC" -az --delete dist/ "$TARGET"');
  expect(api).toBeGreaterThan(-1);
  expect(stamp).toBeGreaterThan(api);
  expect(site).toBeGreaterThan(stamp);
  expect(d).toContain("TARGET=wohnentscheid-deploy:/");
  expect(d).toContain("API_TARGET=wohnentscheid-deploy-api:/");
});

test("deploy.sh names the map commit in the deploy tag", () => {
  const d = read("deploy.sh");
  expect(d).toContain("git -C ../sozialraum-frankfurt rev-parse --short HEAD");
  expect(d).toMatch(/git tag -a "\$tag" -m "[^"]*\$map_commit[^"]*"/);
});

// MAP_REPO points the build at another map repo (docs/architecture.md, Build). A deploy must use the sibling repo:
// its commit goes into the tag, and a test repo could put an unproofread English map online.
// Static check: running deploy.sh would upload.
test("deploy.sh refuses MAP_REPO before it builds anything", () => {
  const d = read("deploy.sh");
  const guard = d.indexOf('if [[ -n "${MAP_REPO:-}" ]]; then');
  expect(guard).toBeGreaterThan(-1);
  expect(guard).toBeLessThan(d.indexOf("npm ci"));
  expect(d.slice(guard, d.indexOf("fi", guard))).toContain("exit 1");
});
