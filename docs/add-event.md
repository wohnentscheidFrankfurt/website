# Add an event

1. Copy an event file in `src/content/events/`. Name it `YYYY-MM-DD-slug.md`.
2. Set the fields: `title`, `start`, `place`, `imageAlt` (describes the drawing).
   Optional: `subtitle`, `end`, `doors`, `address`, `callout`.
   `callout` is one line. It shows on the events page while the event is upcoming.
   `start`, `end` and `doors` need the offset: `+01:00` in winter, `+02:00` in summer. Without it the time is read as UTC.
3. Put the drawing in `src/assets/drawings/`. White background, 3:2, SVG or PNG. Point `image` to it.
4. Write the German text below the fields.
5. After the event, add the optional fields `review` (text) and `gallery` (`kind: photo` or `flipchart`, `src`, `alt`,
   `caption`). Photos go in `src/assets/events/<file-name>/`.
6. Optional flyer: set `flyer` and `flyerAlt`, both or none. The build fails if only one is set.
   Put the file in `src/assets/events/<file-name>/flyer.png`. Cut off the white print margin first.
   `flyer` points to it. `flyerAlt` repeats the full text of the flyer.
   The sticker on the flyer shares or saves this image. Nothing to do for it.
7. Add the `en:` block. It is required.
   `title` and `imageAlt` are always needed.
   `subtitle`, `address` and `callout` are optional. Without `en.address` the English page shows `address`.
   `en.callout` is needed when `callout` is set. `en.review` is needed when `review` is set.
   `en.gallery` has one entry (`alt`, optional `caption`) per `gallery` entry, in the same order.
   `en.body` holds the English text as plain paragraphs. Separate them with a blank line. It is needed when the
   Markdown body is not empty. The build fails when it is missing.
   With a flyer, `en.flyerAlt` is needed. `en.flyer` is optional: an English image, cropped like the German one.
   Without it the English page shows the German flyer.
   The English text follows the tone rules in `docs/architecture.md`, section Languages.
8. Run `npm run build && npm test`, then `./deploy.sh`.

The start page shows the flyer of the first upcoming event that has one. A countdown sits above it. The flyer links
to the event. Without such a flyer the start page lists the next three upcoming events in short rows: date, drawing,
title, subtitle, time, place. Without upcoming events it says "Neue Termine folgen bald."
The event moves to the review only with the first deploy after its day.
