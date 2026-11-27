// Runs the tile block of server/Caddyfile in a local Caddy against an echo server in place of the BKG.
// Needs Caddy: brew install caddy.
import { test, expect } from "@playwright/test";
import http from "node:http";
import net from "node:net";
import fs from "node:fs";
import { block, startCaddy, type Caddy } from "./caddy.ts";

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
let caddy: Caddy;
const get = (...a: Parameters<Caddy["get"]>) => caddy.get(...a);

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  echo = http.createServer((req, res) => {
    seen.push({ method: req.method ?? "", url: req.url ?? "", headers: req.headers });
    res.writeHead(200, { "Content-Type": "image/png", "Set-Cookie": "a=b" });
    res.end(PNG);
  });
  await new Promise<void>((resolve) => echo.listen(0, "127.0.0.1", resolve));
  echoPort = (echo.address() as net.AddressInfo).port;
  const tiles = block(fs.readFileSync("server/Caddyfile", "utf8"), "handle_path /sozialraum-frankfurt/kacheln/* {");
  caddy = await startCaddy(tiles.replaceAll(UPSTREAM, `http://127.0.0.1:${echoPort}`));
});

test.afterAll(async () => {
  await caddy?.stop();
  await new Promise((r) => echo?.close(r));
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
