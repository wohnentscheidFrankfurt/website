// A local Caddy for the unit checks of server/Caddyfile. Needs Caddy: brew install caddy.
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";

export type Caddy = {
  port: number;
  /** A raw request: no URL cleaning by the client, so `..` and `//` reach Caddy as written. */
  get: (p: string, headers?: http.OutgoingHttpHeaders, method?: string) =>
    Promise<{ status: number; headers: http.IncomingHttpHeaders }>;
  stop: () => Promise<void>;
};

/** One block of the Caddyfile, from its first line to its closing brace, found by brace counting. */
export function block(caddyfile: string, head: string): string {
  const start = caddyfile.indexOf(head);
  if (start < 0) throw new Error(`no block "${head}" in server/Caddyfile`);
  let depth = 0;
  for (let i = caddyfile.indexOf("{", start); i < caddyfile.length; i++) {
    if (caddyfile[i] === "{") depth++;
    if (caddyfile[i] === "}" && --depth === 0) return caddyfile.slice(start, i + 1);
  }
  throw new Error(`block "${head}" not closed`);
}

const freePort = () =>
  new Promise<number>((resolve, reject) => {
    const s = net.createServer().listen(0, "127.0.0.1", () => {
      const { port } = s.address() as net.AddressInfo;
      s.close(() => resolve(port));
    });
    s.on("error", reject);
  });

async function waitForPort(port: number, log: () => string) {
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

/**
 * Starts Caddy on a free port with `rules` and an empty static site behind them.
 * The static site stands in for the real one: Caddy cleans `..` before matching, so such a path lands there.
 */
export async function startCaddy(rules: string): Promise<Caddy> {
  const port = await freePort();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "unit-caddy-"));
  const config = path.join(tmp, "Caddyfile");
  const site = path.join(tmp, "site");
  fs.mkdirSync(site);
  // persist_config off and the temp HOME keep Caddy from writing autosave.json or instance.uuid elsewhere.
  fs.writeFileSync(
    config,
    `{\n\tadmin off\n\tpersist_config off\n\tauto_https off\n}\n:${port} {\n${rules}\n` +
      `\thandle {\n\t\troot * ${site}\n\t\tfile_server\n\t}\n}\n`,
  );
  let log = "";
  const caddy: ChildProcess = spawn("caddy", ["run", "--adapter", "caddyfile", "--config", config], {
    env: { ...process.env, HOME: tmp, XDG_DATA_HOME: tmp, XDG_CONFIG_HOME: tmp },
    stdio: ["ignore", "ignore", "pipe"],
  });
  caddy.stderr?.on("data", (d) => { log += String(d); });
  caddy.on("error", () => {}); // a missing binary fails in waitForPort with a hint
  const stop = async () => {
    if (caddy.pid && caddy.exitCode === null && caddy.signalCode === null) {
      const exited = new Promise((r) => caddy.once("exit", r));
      caddy.kill("SIGTERM");
      await exited;
    }
    fs.rmSync(tmp, { recursive: true, force: true });
  };
  try {
    await waitForPort(port, () => log);
  } catch (e) {
    await stop(); // no Caddy and no temp dir left behind
    throw e;
  }

  return {
    port,
    get: (p, headers = {}, method = "GET") =>
      new Promise((resolve, reject) => {
        const req = http.request({ host: "127.0.0.1", port, path: p, method, headers }, (res) => {
          res.resume();
          res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers }));
        });
        req.on("error", reject);
        req.end();
      }),
    stop,
  };
}
