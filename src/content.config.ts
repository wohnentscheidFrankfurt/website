import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";
import { englishProblems } from "./lib/event-english.ts";

const events = defineCollection({
  loader: glob({ pattern: "*.md", base: "src/content/events" }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      subtitle: z.string().optional(),
      start: z.coerce.date(),
      end: z.coerce.date().optional(),
      doors: z.coerce.date().optional(),
      place: z.string(),
      address: z.string().optional(),
      image: image(),
      imageAlt: z.string(),
      callout: z.string().optional(),
      review: z.string().optional(),
      gallery: z
        .array(z.object({ kind: z.enum(["photo", "flipchart"]), src: image(), alt: z.string(), caption: z.string().optional() }))
        .optional(),
      flyer: image().optional(),
      flyerAlt: z.string().min(1).optional(),
      en: z.object({
        title: z.string(),
        subtitle: z.string().optional(),
        address: z.string().optional(),
        image: image().optional(),
        imageAlt: z.string(),
        callout: z.string().optional(),
        review: z.string().optional(),
        body: z.string().optional(),
        gallery: z.array(z.object({ alt: z.string(), caption: z.string().optional() })).optional(),
        flyer: image().optional(),
        flyerAlt: z.string().min(1).optional(),
      }),
    })
    .refine((e) => (e.flyer === undefined) === (e.flyerAlt === undefined), {
      message: "flyer and flyerAlt go together: set both or none",
    })
    .superRefine((e, ctx) => {
      for (const message of englishProblems(e)) ctx.addIssue({ code: "custom", message, path: ["en"] });
    }),
});

export const collections = { events };
