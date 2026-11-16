/** Sliding-window counter per key. */
export class RateLimiter {
  readonly #limit: number;
  readonly #windowMs: number;
  readonly #hits = new Map<string, number[]>();

  constructor(limit: number, windowMs: number) {
    this.#limit = limit;
    this.#windowMs = windowMs;
  }

  /** True and counted when below the limit. A refused hit is not counted. */
  hit(key: string, nowMs: number): boolean {
    const recent = (this.#hits.get(key) ?? []).filter((t) => t > nowMs - this.#windowMs);
    if (recent.length >= this.#limit) {
      this.#hits.set(key, recent);
      return false;
    }
    recent.push(nowMs);
    this.#hits.set(key, recent);
    return true;
  }

  /** Drops every key whose hits are all outside the window. */
  sweep(nowMs: number): void {
    for (const [k, times] of this.#hits) {
      if (times.every((t) => t <= nowMs - this.#windowMs)) this.#hits.delete(k);
    }
  }

  /** Number of keys held. For tests. */
  get size(): number {
    return this.#hits.size;
  }
}

/** Rate-limit key of a client IP: IPv4 as is, IPv6 reduced to its /64. */
export function ipKey(ip: string): string {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  if (mapped) return mapped[1];
  if (!ip.includes(":")) return ip;
  const [head, tail] = ip.split("::");
  const headParts = head ? head.split(":") : [];
  const tailParts = tail === undefined ? [] : tail ? tail.split(":") : [];
  const fill = tail === undefined ? 0 : 8 - headParts.length - tailParts.length;
  const full = [...headParts, ...Array(fill).fill("0"), ...tailParts];
  return full.slice(0, 4).map((h) => h.toLowerCase().replace(/^0+(?=.)/, "")).join(":");
}
