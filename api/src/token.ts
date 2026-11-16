import { createHmac, timingSafeEqual } from "node:crypto";

const DEFAULT_TTL_MS = 72 * 60 * 60 * 1000;

function sign(payloadPart: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(payloadPart).digest();
}

export function createToken(address: string, nowMs: number, secret: string, ttlMs = DEFAULT_TTL_MS): string {
  const payloadPart = Buffer.from(`${address}|${nowMs + ttlMs}`).toString("base64url");
  return `${payloadPart}.${sign(payloadPart, secret).toString("base64url")}`;
}

/** Returns the address of a valid, unexpired token, otherwise null. */
export function verifyToken(token: string, nowMs: number, secret: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadPart, signaturePart] = parts;
  const given = Buffer.from(signaturePart, "base64url");
  const expected = sign(payloadPart, secret);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  const payload = Buffer.from(payloadPart, "base64url").toString();
  const cut = payload.lastIndexOf("|");
  if (cut < 1) return null;
  const expiresAt = Number(payload.slice(cut + 1));
  if (!Number.isFinite(expiresAt) || nowMs > expiresAt) return null;
  return payload.slice(0, cut);
}
