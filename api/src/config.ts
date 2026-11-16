import type { Config } from "./types.ts";

const INFO = "info@wohnentscheid-frankfurt.de";

export function loadConfig(
  env: Record<string, string | undefined>,
  readCredential: (name: string) => string | undefined,
): Config {
  const secret = (credential: string, variable: string) =>
    readCredential(credential)?.replace(/\r?\n$/, "") ?? env[variable];
  const int = (name: string, fallback: number) => {
    if (!env[name]) return fallback;
    const n = Number(env[name]);
    if (!Number.isInteger(n) || n <= 0) throw new Error(`${name} must be a positive integer`);
    return n;
  };

  const tokenSecret = secret("token-secret", "TOKEN_SECRET");
  if (!tokenSecret || tokenSecret.length < 16) throw new Error("token secret missing or shorter than 16 characters");

  const tls = env.SMTP_TLS ?? "starttls";
  if (tls !== "starttls" && tls !== "none") throw new Error("SMTP_TLS must be starttls or none");
  const password = secret("smtp-password", "SMTP_PASSWORD");
  if (tls === "starttls" && !password) throw new Error("SMTP password missing");

  return {
    port: int("API_PORT", 8787),
    siteOrigin: env.SITE_ORIGIN ?? "https://wohnentscheid-frankfurt.de",
    tokenSecret,
    from: env.MAIL_FROM ?? INFO,
    to: env.MAIL_TO ?? INFO,
    smtp: { host: env.SMTP_HOST ?? "smtp.ionos.de", port: int("SMTP_PORT", 587), tls, user: env.SMTP_USER ?? INFO, password },
    limits: { perIp: int("LIMIT_PER_IP", 5), perAddress: int("LIMIT_PER_ADDRESS", 3), total: int("LIMIT_TOTAL", 30) },
  };
}
