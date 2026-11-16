import type { IncomingMessage, ServerResponse } from "node:http";
import { normalizeAddress } from "./address.ts";
import { RateLimiter, ipKey } from "./limit.ts";
import { createToken, verifyToken } from "./token.ts";
import type { Config, Lang, Mailer } from "./types.ts";

const MAX_BODY_BYTES = 2048;
const HOUR_MS = 60 * 60 * 1000;

type Deps = { config: Config; mailer: Mailer; now: () => number; log: (line: string) => void };

/** Reads a urlencoded body of at most MAX_BODY_BYTES. Resolves null when invalid or too large. */
function readForm(req: IncomingMessage): Promise<URLSearchParams | null> {
  return new Promise((resolve) => {
    if (!(req.headers["content-type"] ?? "").toLowerCase().startsWith("application/x-www-form-urlencoded")) {
      return resolve(null);
    }
    const chunks: Buffer[] = [];
    let size = 0;
    let done = false;
    const finish = (value: URLSearchParams | null) => {
      if (done) return;
      done = true;
      req.removeAllListeners("data");
      resolve(value);
    };
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) return finish(null);
      chunks.push(chunk);
    });
    req.on("end", () => finish(new URLSearchParams(Buffer.concat(chunks).toString("utf8"))));
    req.on("error", () => finish(null));
    req.on("close", () => finish(null));
  });
}

/** Per language: redirect targets, the page of the confirm link and the suffix of log lines. German logs stay as they were. */
const SITE: Record<Lang, { thanks: string; error: string; confirmPage: string; suffix: string }> = {
  de: { thanks: "/danke/", error: "/fehler/", confirmPage: "/bestaetigen/", suffix: "" },
  en: { thanks: "/en/thanks/", error: "/en/error/", confirmPage: "/en/confirm/", suffix: " en" },
};

function errorCode(err: unknown): string {
  const e = err as { code?: unknown; responseCode?: unknown } | null;
  return String(e?.code ?? e?.responseCode ?? "unknown");
}

export function createApp({ config, mailer, now, log }: Deps) {
  const perIp = new RateLimiter(config.limits.perIp, HOUR_MS);
  const perAddress = new RateLimiter(config.limits.perAddress, 24 * HOUR_MS);
  const total = new RateLimiter(config.limits.total, HOUR_MS);
  const confirmPerAddress = new RateLimiter(config.limits.perAddress, 24 * HOUR_MS);
  const confirmTotal = new RateLimiter(config.limits.total, HOUR_MS);

  // The privacy text promises at most 24 hours in memory. Windows are at most 24 h and the sweep runs every
  // minute, so an entry lives at most 24 h + 1 min: within the tolerance of that promise.
  // unref: the timer never keeps the process (or a test run) alive.
  setInterval(() => {
    const t = now();
    for (const limiter of [perIp, perAddress, total, confirmPerAddress, confirmTotal]) limiter.sweep(t);
  }, 60 * 1000).unref();

  function redirect(res: ServerResponse, to: string) {
    res.writeHead(303, { Location: to, Connection: "close" }).end();
  }
  function status(res: ServerResponse, code: number) {
    res.writeHead(code, { Connection: "close" }).end();
  }
  const originOk = (req: IncomingMessage) => {
    const origin = req.headers.origin;
    return origin === undefined || origin === config.siteOrigin;
  };

  async function signup(req: IncomingMessage, res: ServerResponse, lang: Lang) {
    const site = SITE[lang];
    const reject = (reason: string) => {
      log(`signup rejected ${reason}${site.suffix}`);
      redirect(res, site.error);
    };
    if (!originOk(req)) return reject("origin");
    const form = await readForm(req);
    if (!form) return reject("body");
    if ((form.get("website") ?? "") !== "") {
      log(`signup rejected honeypot${site.suffix}`);
      return redirect(res, site.thanks);
    }
    const address = normalizeAddress(form.get("email") ?? "");
    if (!address) return reject("address");
    const forwarded = req.headers["x-forwarded-for"];
    const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0].trim();
    const key = ipKey(first || (req.socket.remoteAddress ?? ""));
    const t = now();
    if (!perIp.hit(key, t)) return reject("limit-ip");
    if (!perAddress.hit(address, t)) return reject("limit-address");
    if (!total.hit("all", t)) return reject("limit-total");
    try {
      const token = createToken(address, t, config.tokenSecret);
      await mailer.sendConfirmation(address, `${config.siteOrigin}${site.confirmPage}#${token}`, lang);
    } catch (err) {
      log(`smtp error ${errorCode(err)}${site.suffix}`);
      return redirect(res, site.error);
    }
    log(`signup sent${site.suffix}`);
    redirect(res, site.thanks);
  }

  async function confirm(req: IncomingMessage, res: ServerResponse, lang: Lang) {
    const { suffix } = SITE[lang];
    if (!originOk(req)) {
      log(`confirm rejected origin${suffix}`);
      return status(res, 403);
    }
    const form = await readForm(req);
    const address = verifyToken(form?.get("token") ?? "", now(), config.tokenSecret);
    if (!address) {
      log(`confirm invalid${suffix}`);
      return status(res, 400);
    }
    const t = now();
    if (!confirmPerAddress.hit(address, t)) {
      log(`confirm rejected limit-address${suffix}`);
      return status(res, 200);
    }
    if (!confirmTotal.hit("all", t)) {
      log(`confirm rejected limit-total${suffix}`);
      return status(res, 503);
    }
    try {
      await mailer.sendNotification(address, new Date(t), lang);
    } catch (err) {
      log(`smtp error ${errorCode(err)}${suffix}`);
      return status(res, 502);
    }
    log(`confirm sent${suffix}`);
    status(res, 200);
  }

  const routes = new Map<string, { kind: "signup" | "confirm"; lang: Lang }>([
    ["/api/anmelden", { kind: "signup", lang: "de" }],
    ["/api/bestaetigen", { kind: "confirm", lang: "de" }],
    ["/api/en/signup", { kind: "signup", lang: "en" }],
    ["/api/en/confirm", { kind: "confirm", lang: "en" }],
  ]);

  return (req: IncomingMessage, res: ServerResponse): void => {
    const path = (req.url ?? "").split("?")[0];
    const match = req.method === "POST" ? routes.get(path) : undefined;
    if (!match) return status(res, 404);
    const { kind, lang } = match;
    const { suffix, error } = SITE[lang];
    if (kind === "signup") {
      signup(req, res, lang).catch(() => {
        log(`signup error${suffix}`);
        if (!res.headersSent) redirect(res, error);
      });
    } else {
      confirm(req, res, lang).catch(() => {
        log(`confirm error${suffix}`);
        if (!res.headersSent) status(res, 500);
      });
    }
  };
}
