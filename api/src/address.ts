const FORBIDDEN = /[\s\x00-\x1f\x7f-￿,;<>"()[\]\\]/;

/** Trims and lower-cases an address. Returns null when it is not acceptable. */
export function normalizeAddress(input: string): string | null {
  const address = input.trim().toLowerCase();
  if (address.length === 0 || address.length > 254) return null;
  if (FORBIDDEN.test(address)) return null;
  const parts = address.split("@");
  if (parts.length !== 2) return null;
  const [local, domain] = parts;
  if (!local || !domain || !domain.includes(".")) return null;
  return address;
}
