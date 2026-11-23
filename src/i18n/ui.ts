// Dictionary of the frame and page strings, German and English.
// Not here: legal texts, mails and event content. Link texts inside a sentence are split into before, link and after.
import type { Lang } from "./routes";

export interface Ui {
  titles: { home: string; events: string; imprint: string; privacy: string; thanks: string; error: string; confirm: string };
  frame: {
    homeLink: string;
    desktopNav: string;
    openMenu: string;
    phoneMenu: string;
    closeMenu: string;
    menuHome: string;
    menuEvents: string;
    menuJoin: string;
    // The switch strings name the other language and are written in it, on purpose.
    switchVisible: string;
    switchName: string;
    switchPhone: string;
    footerEvents: string;
    footerInstagram: string;
    footerHome: string;
    footerImprint: string;
    footerPrivacy: string;
    footerColumn1: string;
    footerColumn2: string;
    footerWriteUs: string;
    footerColumn3: string;
  };
  start: {
    logoAlt: string;
    drawingAlt: string;
    intro: string;
    nextOne: string;
    nextMany: string;
    none: string;
    side: string;
    allEvents: string;
  };
  countdown: {
    before: string;
    days: [string, string];
    hours: [string, string];
    minutes: [string, string];
    running: string;
  };
  flyer: { share: string; save: string; shareWord: string; saveWord: string };
  // Labels of the lightbox buttons and its error text.
  gallery: { close: string; zoom: string; prev: string; next: string; error: string };
  join: { title: string; text: string; button: string; mailSubject: string };
  // Teaser of the map "Sozialraum Frankfurt". The heading is the map's name in both languages.
  // The credit is split around its link: before, "basemap.de", after.
  mapTeaser: { imageAlt: string; creditBefore: string; creditAfter: string; text: string; button: string };
  stay: {
    title: string;
    mailTitle: string;
    mailText: string;
    label: string;
    button: string;
    small2: string;
    signalTitle: string;
    signalText: string;
    signalButton: string;
    qrAlt: string;
  };
  events: { title: string; upcoming: string; past: string; none: string };
  signup: {
    thanksTitle: string;
    thanksP1: string;
    thanksP2: string;
    errorTitle: string;
    errorP: { before: string; after: string };
    fallbackSubject: string;
    fallbackBody: string;
    confirmTitle: string;
    waiting: string;
    done: string;
    invalid: { before: string; link: string; after: string };
    failed: { before: string; link: string; after: string };
    retry: string;
    noScript: { before: string; after: string };
  };
}

const de: Ui = {
  titles: {
    home: "Wohnentscheid Frankfurt",
    events: "Veranstaltungen – Wohnentscheid Frankfurt",
    imprint: "Impressum – Wohnentscheid Frankfurt",
    privacy: "Datenschutz – Wohnentscheid Frankfurt",
    thanks: "Fast geschafft – Wohnentscheid Frankfurt",
    error: "Das hat nicht geklappt – Wohnentscheid Frankfurt",
    confirm: "Anmeldung bestätigen – Wohnentscheid Frankfurt",
  },
  frame: {
    homeLink: "Wohnentscheid Frankfurt – Startseite",
    desktopNav: "Hauptmenü",
    openMenu: "Menü öffnen",
    phoneMenu: "Menü",
    closeMenu: "Menü schließen",
    menuHome: "Startseite",
    menuEvents: "Veranstaltungen",
    menuJoin: "Mitmachen",
    switchVisible: "EN",
    switchName: "EN – Show the English version",
    switchPhone: "Show the English version",
    footerEvents: "Veranstaltungen",
    footerInstagram: "Instagram",
    footerHome: "Startseite",
    footerImprint: "Impressum",
    footerPrivacy: "Datenschutz",
    footerColumn1: "Wohnentscheid Frankfurt",
    footerColumn2: "Mitmachen",
    footerWriteUs: "Schreib uns",
    footerColumn3: "Andere Plattformen",
  },
  start: {
    logoAlt: "Wohnentscheid Frankfurt",
    drawingAlt:
      "Zeichnung: Drei Wohnhäuser auf einer ovalen Insel, ein Altbau mit Turm, ein langer Block und ein achteckiger Bau. Auf den Dächern Solarzellen und Hochbeete. Dazwischen ein runder Garten mit Bäumen. Menschen spielen Schach, springen Seil und fahren Rad.",
    intro:
      "Unsere Utopie: Bezahlbarer Wohnraum für Alle. Seit Anfang Oktober entwickeln wir Forderungen, um die Stadt in die Pflicht zu nehmen. Am 28. November diskutieren wir den Stand offen mit allen.",
    nextOne: "Nächste Veranstaltung",
    nextMany: "Nächste Veranstaltungen",
    none: "Neue Termine folgen bald.",
    side: "Hier stehen unsere nächsten Termine. Alle Termine und den Rückblick findet ihr unter Veranstaltungen.",
    allEvents: "Alle Veranstaltungen",
  },
  countdown: {
    before: "noch",
    days: ["Tag", "Tage"],
    hours: ["Stunde", "Stunden"],
    minutes: ["Minute", "Minuten"],
    running: "Läuft gerade",
  },
  flyer: { share: "Flyer teilen", save: "Flyer speichern", shareWord: "Teilen", saveWord: "Sichern" },
  gallery: {
    close: "Schließen", zoom: "Zoomen", prev: "Vorheriges Bild", next: "Nächstes Bild",
    error: "Das Bild ließ sich nicht laden.",
  },
  join: {
    title: "Mitmachen",
    text: "Du willst aktiv werden, weißt aber nicht genau, wie Du Dich einbringen kannst? Schreib uns gerne eine Mail, wir nehmen dann Kontakt zu Dir auf :)!",
    button: "Jetzt mitmachen",
    mailSubject: "Mitmachen",
  },
  mapTeaser: {
    imageAlt: "Karte von Frankfurt: Anteil der Wohnungen von ABG und Nassauischer Heimstätte je Stadtteil, in Rottönen",
    creditBefore: "Hintergrund: © ",
    creditAfter: " / BKG, CC BY 4.0",
    text: "Wir haben eine Karte gebaut, um die Gebiete Frankfurts für eine andere Wohn- und Klimapolitik aufzuschlüsseln. Schaut gerne rein, und gewinnt neue Perspektiven!",
    button: "Zur Karte",
  },
  stay: {
    title: "Bleib informiert",
    mailTitle: "Per Mail",
    mailText: "Ab und zu ein Newsletter. Kein Spam, jederzeit abmeldbar.",
    label: "Deine Mail-Adresse",
    button: "Eintragen",
    small2: "Oder schreib an ",
    signalTitle: "Per Signal",
    signalText: "Kurze Infos und Termine in unserer Signal-Gruppe.",
    signalButton: "Signal-Gruppe beitreten",
    qrAlt: "QR-Code zur Signal-Gruppe des Wohnentscheids",
  },
  events: { title: "Veranstaltungen", upcoming: "Demnächst", past: "Rückblick", none: "Neue Termine folgen bald." },
  signup: {
    thanksTitle: "Fast geschafft",
    thanksP1: "Schau in dein Postfach und bestätige deine Anmeldung. Der Link gilt 72 Stunden.",
    thanksP2: "Keine Mail da? Schau auch im Spam-Ordner nach.",
    errorTitle: "Das hat nicht geklappt",
    errorP: { before: "Versuch es später noch mal oder schreib uns an ", after: "." },
    fallbackSubject: "Bleib informiert",
    fallbackBody: "Bitte tragt mich in euren Newsletter ein.",
    confirmTitle: "Anmeldung bestätigen",
    waiting: "Einen Moment, wir tragen dich ein …",
    done: "Du bist eingetragen. Danke!",
    invalid: { before: "Link ungültig oder abgelaufen. Trag dich einfach ", link: "noch mal ein", after: "." },
    failed: { before: "Das hat nicht geklappt. Versuch es später noch mal oder ", link: "schreib uns", after: "." },
    retry: "Noch mal versuchen",
    noScript: { before: "Schreib uns kurz, dann tragen wir dich ein. ", after: "." },
  },
};

const en: Ui = {
  titles: {
    home: "Wohnentscheid Frankfurt",
    events: "Events – Wohnentscheid Frankfurt",
    imprint: "Imprint – Wohnentscheid Frankfurt",
    privacy: "Privacy – Wohnentscheid Frankfurt",
    thanks: "Almost done – Wohnentscheid Frankfurt",
    error: "That did not work – Wohnentscheid Frankfurt",
    confirm: "Confirm your sign-up – Wohnentscheid Frankfurt",
  },
  frame: {
    homeLink: "Wohnentscheid Frankfurt – Home",
    desktopNav: "Main menu",
    openMenu: "Open menu",
    phoneMenu: "Menu",
    closeMenu: "Close menu",
    menuHome: "Home",
    menuEvents: "Events",
    menuJoin: "Get involved",
    switchVisible: "DE",
    switchName: "DE – Deutsche Version anzeigen",
    switchPhone: "Zur deutschen Version",
    footerEvents: "Events",
    footerInstagram: "Instagram",
    footerHome: "Home",
    footerImprint: "Imprint",
    footerPrivacy: "Privacy",
    footerColumn1: "Wohnentscheid Frankfurt",
    footerColumn2: "Get involved",
    footerWriteUs: "Write to us",
    footerColumn3: "Other platforms",
  },
  start: {
    logoAlt: "Wohnentscheid Frankfurt",
    drawingAlt:
      "Drawing: Three apartment buildings on an oval island: an old building with a tower, a long block and a building with eight sides. Solar panels and raised beds on the roofs. Between them a round garden with trees. People play chess, skip rope and ride bikes.",
    intro:
      "Our dream: good homes that everyone can pay for. Since October, we have been writing demands for the city of Frankfurt. On 28 November, we talk about these demands openly with everyone.",
    nextOne: "Next event",
    nextMany: "Next events",
    none: "New dates will follow soon.",
    side: "Here are our next dates. You can find all dates and past events under Events.",
    allEvents: "All events",
  },
  countdown: {
    before: "in",
    days: ["day", "days"],
    hours: ["hour", "hours"],
    minutes: ["minute", "minutes"],
    running: "Happening now",
  },
  flyer: { share: "Share flyer", save: "Save flyer", shareWord: "Share", saveWord: "Save" },
  gallery: {
    close: "Close", zoom: "Zoom", prev: "Previous picture", next: "Next picture",
    error: "The picture could not be loaded.",
  },
  join: {
    title: "Get involved",
    text: "You want to get active, but you are not sure how you can help? Write to us by email, and we will contact you :)!",
    button: "Get involved now",
    mailSubject: "Get involved",
  },
  mapTeaser: {
    imageAlt: "Map of Frankfurt: share of the dwellings of ABG and Nassauische Heimstätte per quarter, in shades of red",
    creditBefore: "Background: © ",
    creditAfter: " / BKG, CC BY 4.0",
    text: "We've built a map to break down Frankfurt's districts for a different housing and climate policy. Feel free to take a look and gain some new perspectives!",
    button: "Open the map",
  },
  stay: {
    title: "Stay informed",
    mailTitle: "By email",
    mailText: "A newsletter now and then. No spam. You can unsubscribe at any time.",
    label: "Your email address",
    button: "Sign up",
    small2: "Or write to ",
    signalTitle: "On Signal",
    signalText: "Short news and dates in our Signal group.",
    signalButton: "Join the Signal group",
    qrAlt: "QR code for the Signal group of Wohnentscheid Frankfurt",
  },
  events: { title: "Events", upcoming: "Coming up", past: "Past events", none: "New dates will follow soon." },
  signup: {
    thanksTitle: "Almost done",
    thanksP1: "Look in your inbox and confirm your sign-up. The link is valid for 72 hours.",
    thanksP2: "No email? Also look in your spam folder.",
    errorTitle: "That did not work",
    errorP: { before: "Try again later or write to us at ", after: "." },
    fallbackSubject: "Stay informed",
    fallbackBody: "Please add me to your newsletter.",
    confirmTitle: "Confirm your sign-up",
    waiting: "One moment, we are signing you up …",
    done: "You are signed up. Thank you!",
    invalid: { before: "This link is not valid or has expired. Just ", link: "sign up again", after: "." },
    failed: { before: "That did not work. Try again later or ", link: "write to us", after: "." },
    retry: "Try again",
    noScript: { before: "Write to us by email, then we will sign you up. ", after: "." },
  },
};

export const ui: Record<Lang, Ui> = { de, en };

/** Ids of the two start page blocks that the menu and the footer link to. */
export const ANCHORS: Record<Lang, { join: string; band: string }> = {
  de: { join: "mitmachen", band: "bleib-informiert" },
  en: { join: "get-involved", band: "stay-informed" },
};
