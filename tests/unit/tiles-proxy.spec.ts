// Runs the tile block of server/Caddyfile in a local Caddy against an echo server in place of the BKG.
// Needs Caddy: brew install caddy.
import { test, expect } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";

const UPSTREAM = "https://sgx.geodatenzentrum.de";
const BKG_PATH = "/wmts_basemapde/tile/1.0.0/de_basemapde_web_raster_grau/default/GLOBAL_WEBMERCATOR";
// 1x1 PNG.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

type Seen = { method: string; url: string; headers: http.IncomingHttpHeaders };
const seen: Seen[] = [];
let echo: http.Server;
let echoPort = 0;
let caddy: ChildProcess;
let caddyPort = 0;
let caddyLog = "";
let tmp = "";

test.describe.configure({ mode: "serial" });

// The handle_path block for the tiles, found by brace counting.
function tileBlock(caddyfile: string): string {
  const start = caddyfile.indexOf("handle_path /sozialraum-frankfurt/kacheln/* {");
  if (start < 0) throw new Error("no tile block in server/Caddyfile");
  let depth = 0;
  for (let i = caddyfile.indexOf("{", start); i < caddyfile.length; i++) {
    if (caddyfile[i] === "{") depth++;
    if (caddyfile[i] === "}" && --depth === 0) return caddyfile.slice(start, i + 1);
  }
  throw new Error("tile block not closed");
}

const freePort = () =>
  new Promise<number>((resolve, reject) => {
    const s = net.createServer().listen(0, "127.0.0.1", () => {
      const { port } = s.address() as net.AddressInfo;
      s.close(() => resolve(port));
    });
    s.on("error", reject);
  });

async function waitForPort(port: number, log = () => "") {
  for (let i = 0; i < 100; i++) {
    const open = await new Promise<boolean>((resolve) => {
      const c = net.connect(port, "127.0.0.1", () => { c.end(); resolve(true); });
      c.on("error", () => resolve(false));
    });
    if (open) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Caddy did not open port ${port}. Is it installed? brew install caddy\n${log()}`);
}

// A raw request: no URL cleaning by the client, so `..` and `//` reach Caddy as written.
function get(p: string, headers: http.OutgoingHttpHeaders = {}, method = "GET") {
  return new Promise<{ status: number; headers: http.IncomingHttpHeaders }>((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port: caddyPort, path: p, method, headers }, (res) => {
      res.resume();
      res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers }));
    });
    req.on("error", reject);
    req.end();
  });
}

test.beforeAll(async () => {
  echo = http.createServer((req, res) => {
    seen.push({ method: req.method ?? "", url: req.url ?? "", headers: req.headers });
    res.writeHead(200, { "Content-Type": "image/png", "Set-Cookie": "a=b" });
    res.end(PNG);
  });
  await new Promise<void>((resolve) => echo.listen(0, "127.0.0.1", resolve));
  echoPort = (echo.address() as net.AddressInfo).port;

  const block = tileBlock(fs.readFileSync("server/Caddyfile", "utf8")).replaceAll(UPSTREAM, `http://127.0.0.1:${echoPort}`);
  caddyPort = await freePort();
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tiles-caddy-"));
  const config = path.join(tmp, "Caddyfile");
  const site = path.join(tmp, "site");
  fs.mkdirSync(site);
  // persist_config off and the temp HOME keep Caddy from writing autosave.json or instance.uuid elsewhere.
  // The second handle stands in for the static site: Caddy cleans `..` before matching, so such a path lands there.
  fs.writeFileSync(
    config,
    `{\n\tadmin off\n\tpersist_config off\n\tauto_https off\n}\n:${caddyPort} {\n${block}\n` +
      `\thandle {\n\t\troot * ${site}\n\t\tfile_server\n\t}\n}\n`,
  );
  caddy = spawn("caddy", ["run", "--adapter", "caddyfile", "--config", config], {
    env: { ...process.env, HOME: tmp, XDG_DATA_HOME: tmp, XDG_CONFIG_HOME: tmp },
    stdio: ["ignore", "ignore", "pipe"],
  });
  caddy.stderr?.on("data", (d) => { caddyLog += String(d); });
  caddy.on("error", () => {}); // a missing binary fails in waitForPort with a hint
  await waitForPort(caddyPort, () => caddyLog);
});

test.afterAll(async () => {
  if (caddy?.pid && caddy.exitCode === null && caddy.signalCode === null) {
    const exited = new Promise((r) => caddy.once("exit", r));
    caddy.kill("SIGTERM");
    await exited;
  }
  await new Promise((r) => echo?.close(r));
  if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
});

test.beforeEach(() => { seen.length = 0; });

test("tile proxy rewrites z/y/x.png to the one BKG path", async () => {
  const res = await get("/sozialraum-frankfurt/kacheln/12/1386/2144.png?x=1");
  expect(res.status).toBe(200);
  expect(seen.map((s) => s.url)).toEqual([`${BKG_PATH}/12/1386/2144.png`]);
});

test("tile proxy forwards no client header", async () => {
  const res = await get("/sozialraum-frankfurt/kacheln/12/1386/2144.png", {
    "User-Agent": "Mozilla/5.0 test",
    Referer: "https://wohnentscheid-frankfurt.de/sozialraum-frankfurt/",
    Cookie: "id=42",
    "Accept-Language": "de-DE",
    Origin: "https://wohnentscheid-frankfurt.de",
    "Sec-Fetch-Site": "same-origin",
    "X-Forwarded-For": "1.2.3.4",
    Accept: "image/png",
    "Accept-Encoding": "gzip",
  });
  expect(res.status).toBe(200);
  expect(seen).toHaveLength(1);
  const allowed = ["host", "accept", "accept-encoding", "content-length", "connection"];
  expect(Object.keys(seen[0].headers).filter((h) => !allowed.includes(h))).toEqual([]);
  expect(seen[0].headers.host).toBe(`127.0.0.1:${echoPort}`);
});

test("tile proxy answers 404 for anything but z/y/x.png", async () => {
  for (const p of [
    "/sozialraum-frankfurt/kacheln/12/1386/2144.jpg",
    "/sozialraum-frankfurt/kacheln/../../etc/passwd",
    "/sozialraum-frankfurt/kacheln/a/b/c.png",
    "/sozialraum-frankfurt/kacheln/123/1/1.png",
    "/sozialraum-frankfurt/kacheln/https://example.org/1/1/1.png",
  ]) expect((await get(p)).status, p).toBe(404);
  expect(seen).toEqual([]);
});

test("tile proxy sends only GET and HEAD upstream", async () => {
  expect((await get("/sozialraum-frankfurt/kacheln/12/1386/2144.png", {}, "POST")).status).toBe(404);
  expect(seen).toEqual([]);
});

test("tile proxy drops Set-Cookie from upstream", async () => {
  const res = await get("/sozialraum-frankfurt/kacheln/12/1386/2144.png");
  expect(res.status).toBe(200);
  expect(res.headers["set-cookie"]).toBeUndefined();
});
