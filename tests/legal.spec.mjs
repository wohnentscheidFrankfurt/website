// Checks of the imprint and the privacy page. The texts are legal texts: the checks pin them word for word.
import { test, expect } from "@playwright/test";

const ADDRESS = "info@wohnentscheid-frankfurt.de";
const POSTAL = ["Sven Nagel", "Ostendstraße 9", "60314 Frankfurt am Main"];
const HBDI = "https://datenschutz.hessen.de/";
const DESKTOP = "desktop-chrome";

const PAGES = {
  "/impressum/": {
    binding: null,
    title: "Impressum – Wohnentscheid Frankfurt",
    h1: "Impressum",
    h2: ["Angaben nach § 5 DDG", "Kontakt", "Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV", "Bilder"],
    address: [POSTAL],
    p: [
      "Diese Website gehört zur Initiative Wohnentscheid Frankfurt.",
      `E-Mail: ${ADDRESS}`,
      "Sven Nagel, Anschrift wie oben.",
      "Zeichnungen und Fotos: Wohnentscheid Frankfurt.",
    ],
    mailto: 1,
    nbsp: ["§ 5", "§ 18", "Abs. 2", "60314 Frankfurt"],
  },
  "/datenschutz/": {
    binding: null,
    title: "Datenschutz – Wohnentscheid Frankfurt",
    h1: "Datenschutz",
    h2: ["Kurz gesagt", "Verantwortlich", "Server und Protokoll", "Karte „Sozialraum Frankfurt“", "E-Mail", "Newsletter", "Signal, Instagram und GitHub",
      "Deine Rechte"],
    address: [[...POSTAL, ADDRESS]],
    p: [
      "Diese Website setzt keine Cookies. Sie hat kein Tracking und keine Statistik. " +
        "Sie lädt nichts von anderen Servern. Schriften und Bilder liegen auf unserem eigenen Server.",
      "Die Website liegt auf einem Server der Hetzner Online GmbH in Nürnberg. " +
        "Hetzner verarbeitet die Daten in unserem Auftrag. Die Verbindung ist mit HTTPS verschlüsselt.",
      "Bei jedem Aufruf schreibt der Server einen Eintrag ins Protokoll: Zeitpunkt, aufgerufene Seite, " +
        "Art der Anfrage, Antwort des Servers, Datenmenge, Dauer und eine gekürzte IP-Adresse. " +
        "Die IP-Adresse kürzt der Server vor dem Speichern. " +
        "Bei IPv4 bleiben die ersten zwei von vier Teilen, bei IPv6 die ersten 32 Bit. " +
        "Browser und Herkunftsseite speichern wir nicht.",
      "Wir brauchen das Protokoll, um Fehler und Angriffe zu erkennen. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f " +
        "DSGVO. Unser berechtigtes Interesse ist ein sicherer Betrieb. Nach spätestens sieben Tagen löscht der " +
        "Server die Einträge.",
      "Unter wohnentscheid-frankfurt.de/sozialraum-frankfurt/ zeigen wir eine Karte. Die " +
        "Hintergrundkarte kommt von basemap.de. Das ist ein Dienst des Bundesamts für Kartographie " +
        "und Geodäsie (BKG). Dein Browser lädt die Kacheln der Hintergrundkarte von unserem Server. " +
        "Unser Server holt sie beim BKG ab. Das BKG sieht dabei nur unseren Server. Es bekommt weder " +
        "deine IP-Adresse noch Angaben über deinen Browser. Die Abrufe der Kacheln schreiben wir " +
        "nicht ins Protokoll.",
      "Wenn du uns schreibst, verarbeiten wir deine Adresse und deine Nachricht. Wir nutzen sie nur, um dir zu " +
        "antworten. Unser Postfach liegt bei der IONOS SE in Montabaur. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f " +
        "DSGVO. Unser berechtigtes Interesse ist, deine Fragen zu beantworten. Wir löschen deine Mail, wenn wir " +
        "sie nicht mehr brauchen.",
      "Du kannst dich über das Formular auf unserer Website eintragen. Dann schicken wir dir eine Mail mit " +
        "einem Link. Erst wenn du dort bestätigst, tragen wir dich ein. So kann niemand eine fremde Adresse " +
        "eintragen. Für das Formular verarbeitet unser Server bei Hetzner deine Adresse und deine IP-Adresse. " +
        "Er speichert sie nicht. Für die Sperre gegen Missbrauch hält er sie höchstens 24 Stunden im " +
        "Arbeitsspeicher. Die Mails verschicken wir über IONOS.",
      "Nach der Bestätigung bekommen wir eine Mail mit deiner Adresse. Darin steht auch, ob du dich auf der " +
        "deutschen oder der englischen Seite eingetragen hast. Wir speichern deine Adresse, deine Themen und das " +
        "Datum der Anmeldung. Damit schicken wir dir ab und zu unseren Newsletter. Wir messen nicht, ob du ihn öffnest oder auf Links " +
        "klickst. Rechtsgrundlage ist deine Einwilligung nach Art. 6 Abs. 1 lit. a DSGVO. Wir speichern die " +
        "Daten, bis du dich abmeldest. Für die Sperre gegen Missbrauch ist die Rechtsgrundlage Art. 6 Abs. 1 " +
        "lit. f DSGVO. Unser berechtigtes Interesse ist, das Formular vor Missbrauch zu schützen.",
      "Du kannst dich jederzeit abmelden: über den Link in jeder Mail oder mit einer Mail an uns. Nach der " +
        "Abmeldung behalten wir deine Adresse mit dem Vermerk „abgemeldet“. So bekommst du nicht aus Versehen " +
        "wieder Post. Rechtsgrundlage dafür ist Art. 6 Abs. 1 lit. f DSGVO.",
      "Wir verlinken unsere Signal-Gruppe, unser Instagram-Profil und unser GitHub-Konto. Das sind einfache Links. " +
        "Erst mit dem Klick verlässt du unsere Website. Dann gelten die Datenschutzregeln von Signal, Instagram " +
        "oder GitHub. In der " +
        "Signal-Gruppe sehen die anderen Mitglieder deinen Signal-Namen.",
      "Du hast das Recht auf Auskunft, Berichtigung, Löschung und Einschränkung der Verarbeitung. Du hast das " +
        "Recht auf Datenübertragbarkeit (Art. 15 bis 20 DSGVO). Eine Einwilligung kannst du jederzeit für die " +
        `Zukunft widerrufen. Schreib dazu an ${ADDRESS}.`,
      "Widerspruch: Wo wir uns auf Art. 6 Abs. 1 lit. f DSGVO stützen, kannst du jederzeit widersprechen " +
        "(Art. 21 DSGVO). Eine Mail an uns genügt.",
      "Du kannst dich auch bei einer Aufsichtsbehörde beschweren. Für uns zuständig ist der Hessische Beauftragte " +
        "für Datenschutz und Informationsfreiheit, Gustav-Stresemann-Ring 1, 65189 Wiesbaden, " +
        "datenschutz.hessen.de.",
      "Stand: November 2026",
    ],
    mailto: 2,
    nbsp: ["Abs. 1", "Art. 6", "lit. a", "lit. f", "Art. 15", "Art. 21", "60314 Frankfurt", "65189 Wiesbaden"],
  },
  "/en/imprint/": {
    binding: { text: "This is a translation. The German version is legally binding: Impressum.", href: "/impressum/" },
    title: "Imprint – Wohnentscheid Frankfurt",
    h1: "Imprint",
    h2: ["Information according to § 5 DDG (German Digital Services Act)", "Contact",
      "Responsible for the content according to § 18(2) MStV (German Interstate Media Treaty)", "Images"],
    address: [POSTAL],
    p: [
      "This is a translation. The German version is legally binding: Impressum.",
      "This website belongs to the initiative Wohnentscheid Frankfurt.",
      `Email: ${ADDRESS}`,
      "Sven Nagel, address as above.",
      "Drawings and photos: Wohnentscheid Frankfurt.",
    ],
    mailto: 1,
    nbsp: ["§ 5", "§ 18", "60314 Frankfurt"],
  },
  "/en/privacy/": {
    binding: { text: "This is a translation. The German version is legally binding: Datenschutz.", href: "/datenschutz/" },
    title: "Privacy – Wohnentscheid Frankfurt",
    h1: "Privacy",
    h2: ["In short", "Responsible", "Server and log", "Map “Sozialraum Frankfurt”", "Email", "Newsletter", "Signal, Instagram and GitHub", "Your rights"],
    address: [[...POSTAL, ADDRESS]],
    p: [
      "This is a translation. The German version is legally binding: Datenschutz.",
      "This website sets no cookies. It has no tracking and no statistics. It loads nothing from other servers. " +
        "Fonts and images are on our own server.",
      "The website is on a server of Hetzner Online GmbH in Nuremberg. Hetzner processes the data on our behalf. " +
        "The connection is encrypted with HTTPS.",
      "Each time you open a page, the server writes an entry in the log: time, page, type of request, answer of " +
        "the server, amount of data, duration and a shortened IP address. The server shortens the IP address " +
        "before it saves it. For IPv4 the first two of four parts stay, for IPv6 the first 32 bits. We do not " +
        "save your browser or the page you came from.",
      "We need the log to find errors and attacks. The legal basis is Art. 6(1)(f) GDPR. Our legitimate interest " +
        "is a safe operation. The server deletes the entries after seven days at the latest.",
      "At wohnentscheid-frankfurt.de/sozialraum-frankfurt/ we show a map. The background map comes " +
        "from basemap.de. This is a service of the Federal Agency for Cartography and Geodesy " +
        "(Bundesamt für Kartographie und Geodäsie, BKG). Your browser loads the tiles of the " +
        "background map from our server. Our server fetches them from the BKG. The BKG only sees our " +
        "server. It gets neither your IP address nor details about your browser. We do not write the " +
        "tile requests to the log.",
      "If you write to us, we process your address and your message. We use them only to answer you. Our mailbox " +
        "is at IONOS SE in Montabaur. The legal basis is Art. 6(1)(f) GDPR. Our legitimate interest is to answer " +
        "your questions. We delete your email when we no longer need it.",
      "You can sign up with the form on our website. Then we send you an email with a link. We add you only when " +
        "you confirm there. This way nobody can sign up another person's address. For the form, our " +
        "server at Hetzner processes your address and your IP address. It does not save them. To block misuse, " +
        "it keeps them in memory for 24 hours at most. We send the emails through IONOS.",
      "After you confirm, we get an email with your address. It also says if you signed up on the German or the " +
        "English page. We save your address, your topics and the date you signed up. We use them to send you our " +
        "newsletter now and then. We do not measure if you open it or click on links. The legal basis is your " +
        "consent according to Art. 6(1)(a) GDPR. We keep the data until you unsubscribe. For blocking misuse, " +
        "the legal basis is Art. 6(1)(f) GDPR. Our legitimate interest is to protect the form against misuse.",
      "You can unsubscribe at any time: with the link in every email or with an email to us. After you " +
        "unsubscribe, we keep your address with the note “unsubscribed”. This way you do not get mail from us " +
        "again by mistake. The legal basis for this is Art. 6(1)(f) GDPR.",
      "We link to our Signal group, our Instagram profile and our GitHub account. These are simple links. You leave " +
        "our website only when you click. Then the privacy rules of Signal, Instagram or GitHub apply. In the Signal " +
        "group, the other " +
        "members see your Signal name.",
      "You have the right to access, correction, deletion and restriction of processing. You have the right to " +
        "data portability (Art. 15 to 20 GDPR). You can withdraw your consent at any time for the future. To do " +
        `so, write to ${ADDRESS}.`,
      "Objection: Where we rely on Art. 6(1)(f) GDPR, you can object at any time (Art. 21 GDPR). An email to us " +
        "is enough.",
      "You can also complain to a supervisory authority. The authority for us is the Hessian Commissioner for " +
        "Data Protection and Freedom of Information (Der Hessische Beauftragte für Datenschutz und " +
        "Informationsfreiheit), Gustav-Stresemann-Ring 1, 65189 Wiesbaden, datenschutz.hessen.de.",
      "Last updated: November 2026",
    ],
    mailto: 2,
    nbsp: ["Art. 6", "Art. 15", "Art. 21", "60314 Frankfurt", "65189 Wiesbaden"],
  },
};

for (const [path, spec] of Object.entries(PAGES)) {
  test.describe(path, () => {
    test("has title, h1 and the sections in order", async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveTitle(spec.title);
      await expect(page.locator("main h1")).toHaveText(spec.h1);
      await expect(page.locator("main h2")).toHaveText(spec.h2);
    });

    test("has the texts word for word", async ({ page }) => {
      await page.goto(path);
      if (spec.binding) {
        // The first paragraph after the h1 says which version binds. Its link names the German page.
        await expect(page.locator("main h1 + p")).toHaveText(spec.binding.text);
        const link = page.locator("main h1 + p a");
        await expect(link).toHaveAttribute("href", spec.binding.href);
        await expect(link).toHaveAttribute("hreflang", "de");
        await expect(link).toHaveAttribute("lang", "de");
      }
      await expect(page.locator("main p")).toHaveText(spec.p);
      const lines = await page.locator("main address").evaluateAll((els) =>
        els.map((el) => el.innerText.split("\n").map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean)));
      expect(lines).toEqual(spec.address);
    });

    // Numbers and abbreviations stay on one line with what they belong to.
    test("has non-breaking spaces in references and postcodes", async ({ page }) => {
      await page.goto(path);
      const text = await page.locator("main").evaluate((el) => el.textContent);
      for (const pair of spec.nbsp) {
        expect(text).toContain(pair.replace(" ", "\u00a0"));
        expect(text).not.toContain(pair);
      }
    });

    test("addresses are upright", async ({ page }) => {
      await page.goto(path);
      const styles = await page.locator("main address").evaluateAll((els) =>
        els.map((el) => getComputedStyle(el).fontStyle));
      expect(styles).toEqual(spec.address.map(() => "normal"));
    });

    test("mail addresses are mailto links, all links plain", async ({ page }) => {
      await page.goto(path);
      const mails = page.locator("main").getByRole("link", { name: ADDRESS, exact: true });
      await expect(mails).toHaveCount(spec.mailto);
      for (const link of await mails.all()) await expect(link).toHaveAttribute("href", `mailto:${ADDRESS}`);
      await expect(page.locator("main a[target]")).toHaveCount(0);
    });

    // On desktop the page is wider than the column: it must sit at the left edge of main's content, not centred.
    test("text column is narrow and left-aligned", async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== DESKTOP, "desktop width");
      await page.goto(path);
      const column = await page.locator("main .prose").evaluate((el) => {
        const main = el.closest("main");
        return {
          width: el.getBoundingClientRect().width,
          left: el.getBoundingClientRect().left,
          content: main.getBoundingClientRect().left + parseFloat(getComputedStyle(main).paddingLeft),
          rem: parseFloat(getComputedStyle(document.documentElement).fontSize),
        };
      });
      expect(column.width).toBeLessThanOrEqual(42 * column.rem);
      expect(Math.abs(column.left - column.content)).toBeLessThanOrEqual(0.5);
    });

    test("links have an ink focus ring", async ({ page }) => {
      await page.goto(path);
      for (const link of await page.locator("main .prose a").all()) {
        await link.focus();
        const ring = await link.evaluate((el) => {
          const s = getComputedStyle(el);
          return { visible: el.matches(":focus-visible"), style: s.outlineStyle, color: s.outlineColor,
            width: s.outlineWidth, offset: s.outlineOffset };
        });
        expect(ring).toEqual({ visible: true, style: "solid", color: "rgb(17, 17, 17)", width: "3px", offset: "2px" });
      }
    });

    test("fits at 320 px", async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 700 });
      await page.goto(path);
      await page.evaluate(() => document.fonts.ready);
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(scrollWidth).toBeLessThanOrEqual(320);
    });
  });
}

for (const path of ["/datenschutz/", "/en/privacy/"]) {
  const name = "datenschutz.hessen.de";
  test(`${path} links the supervisory authority`, async ({ page }) => {
    await page.goto(path);
    const link = page.locator("main").getByRole("link", { name });
    await expect(link).toHaveAttribute("href", HBDI);
  });

  test(`${path} has the anchor the form links to`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator("h2#newsletter")).toHaveText("Newsletter");
  });
}
