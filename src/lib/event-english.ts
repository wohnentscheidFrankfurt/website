// English block of an event: rules and accessors. Pure, no Astro imports.
import type { Lang } from "../i18n/routes.ts";

export interface EnglishFields {
  title: string;
  subtitle?: string;
  address?: string;
  imageAlt: string;
  callout?: string;
  review?: string;
  body?: string;
  gallery?: { alt: string; caption?: string }[];
  flyer?: unknown;
  flyerAlt?: string;
}

export interface EventFields {
  callout?: string;
  review?: string;
  gallery?: unknown[];
  flyer?: unknown;
  en: EnglishFields;
}

/** One message per broken rule. Empty when the English block is complete. */
export function englishProblems(data: EventFields): string[] {
  const { en } = data;
  const problems: string[] = [];
  const galleryLength = data.gallery?.length ?? 0;
  if ((en.gallery?.length ?? 0) !== galleryLength) {
    problems.push(`en.gallery needs ${galleryLength} entries, one per gallery entry`);
  }
  if (data.callout && !en.callout) problems.push("en.callout is required when callout is set");
  if (data.review && !en.review) problems.push("en.review is required when review is set");
  if (data.flyer && !en.flyerAlt) problems.push("en.flyerAlt is required when flyer is set");
  if (en.flyer && !en.flyerAlt) problems.push("en.flyer needs en.flyerAlt");
  if (en.flyer && !data.flyer) problems.push("en.flyer needs flyer");
  return problems;
}

/** Flyer image and alt text for a language. English falls back to the German image. */
export function flyerFor<I>(
  data: { flyer?: I; flyerAlt?: string; en: { flyer?: I; flyerAlt?: string } },
  lang: Lang,
): { src: I; alt: string } | undefined {
  if (data.flyer === undefined) return undefined;
  if (lang === "de") return { src: data.flyer, alt: data.flyerAlt ?? "" };
  return { src: data.en.flyer ?? data.flyer, alt: data.en.flyerAlt ?? "" };
}

/** Plain paragraphs of `en.body`, split at blank lines. */
export function englishBody(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p !== "");
}

export interface LocalizedEvent {
  title: string;
  subtitle?: string;
  address?: string;
  imageAlt: string;
  callout?: string;
  review?: string;
  gallery: { alt: string; caption?: string }[];
}

/** The text fields of an event in one language. The English address falls back to the German one. */
export function localized(
  data: {
    title: string;
    subtitle?: string;
    address?: string;
    imageAlt: string;
    callout?: string;
    review?: string;
    gallery?: { alt: string; caption?: string }[];
    en: EnglishFields;
  },
  lang: Lang,
): LocalizedEvent {
  if (lang === "de") {
    const { title, subtitle, address, imageAlt, callout, review } = data;
    return {
      title, subtitle, address, imageAlt, callout, review,
      gallery: (data.gallery ?? []).map(({ alt, caption }) => ({ alt, caption })),
    };
  }
  const { en } = data;
  return {
    title: en.title,
    subtitle: en.subtitle,
    address: en.address ?? data.address,
    imageAlt: en.imageAlt,
    callout: en.callout,
    review: en.review,
    gallery: en.gallery ?? [],
  };
}
