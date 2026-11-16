// Checks of "Mitmachen" on the start page and the band "Bleib informiert" above the footer on every page.
import { test, expect } from "@playwright/test";

const DESKTOP = "desktop-chrome";
const ADDRESS = "info@wohnentscheid-frankfurt.de";
const SIGNAL = "https://signal.group/#CjQKIIiNsPhSGdlNpSkehrM5mYB13XqwFJ2rm7IonLVXxOz3EhB5ayvfqtF6wFS1DHmWpuiQ";
const JOIN_TEXT =
  "Du willst aktiv werden, weißt aber nicht genau, wie Du Dich einbringen kannst? " +
  "Schreib uns gerne eine Mail, wir nehmen dann Kontakt zu Dir auf :)!";

const join = (page) => page.locator("main section#mitmachen");
const band = (page) => page.locator("#bleib-informiert");

// The heading's top lies below the sticky header's bottom, and the heading is in view.
// The jump may land after the URL changes (a new page loads, fonts arrive): poll until the heading stands still there.
async function expectBelowHeader(page) {
  const heading = join(page).getByRole("heading", { name: "Mitmachen" });
  let last;
  await expect.poll(async () => {
    const header = await page.locator("header").boundingBox();
    const box = await heading.boundingBox();
    const still = box.y === last;
    last = box.y;
    return still && box.y >= header.y + header.height && box.y + box.height <= page.viewportSize().height;
  }).toBe(true);
}

test.describe("Mitmachen", () => {
  // Last block of main. On "/" the map teaser stands between the flyer (or the event rows) and "Mitmachen".
  // "/en/" has no teaser, so there it follows the flyer section directly.
  for (const [home, before] of [["/", "section.map-teaser"], ["/en/", "section[data-next]"]]) {
    test(`sits on ${home} as the last block, after ${before}`, async ({ page }) => {
      await page.goto(home);
      const section = page.locator(`main section#${home === "/" ? "mitmachen" : "get-involved"}`);
      await expect(section).toHaveCount(1);
      const order = await section.evaluate((el, sel) => ({
        last: el === document.querySelector("main").lastElementChild,
        after: Boolean(el.previousElementSibling?.matches(sel)),
      }), before);
      expect(order).toEqual({ last: true, after: true });
    });
  }

  test("has heading, text and the mail button", async ({ page }) => {
    await page.goto("/");
    const heading = join(page).getByRole("heading", { level: 2, name: "Mitmachen" });
    await expect(heading).toBeVisible();
    expect(await heading.evaluate((el) => getComputedStyle(el).textTransform)).toBe("uppercase");
    await expect(join(page).locator("p")).toHaveText(JOIN_TEXT);
    const button = join(page).getByRole("link", { name: "Jetzt mitmachen" });
    await expect(button).toBeVisible();
    await expect(button).toHaveAttribute("href", `mailto:${ADDRESS}?subject=Mitmachen`);
    // A black button, centred in the page.
    const style = await button.evaluate((el) => {
      const s = getComputedStyle(el);
      return { bg: s.backgroundColor, color: s.color, family: s.fontFamily, stretch: parseFloat(s.fontStretch) };
    });
    expect(style.bg).toBe("rgb(17, 17, 17)");
    expect(style.color).toBe("rgb(255, 255, 255)");
    expect(style.family).toContain("Archivo");
    expect(style.stretch).toBeGreaterThanOrEqual(80);
    const box = await button.boundingBox();
    const width = page.viewportSize().width;
    expect(Math.abs(box.x + box.width / 2 - width / 2)).toBeLessThanOrEqual(2);
    // As high as the global .button.
    expect(Math.round(box.height)).toBe(48);
  });

  test("is not on the events page", async ({ page }) => {
    await page.goto("/veranstaltungen/");
    await expect(page.locator("#mitmachen")).toHaveCount(0);
  });

  test("desktop bar links to it and never marks it current", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== DESKTOP, "desktop bar");
    const item = page.locator("nav.desktop-nav").getByRole("link", { name: "Mitmachen" });
    for (const path of ["/", "/veranstaltungen/"]) {
      await page.goto(path);
      await expect(item).toHaveAttribute("href", "/#mitmachen");
      await expect(item).not.toHaveAttribute("aria-current", /.*/);
    }
    // The items in order: Veranstaltungen, then Mitmachen.
    await expect(page.locator("nav.desktop-nav a")).toHaveText(["Veranstaltungen", "Mitmachen"]);
    // From the events page to the start page, the heading below the sticky header.
    await item.click();
    await expect(page).toHaveURL(/\/#mitmachen$/);
    await expectBelowHeader(page);
    await expect(item).not.toHaveAttribute("aria-current", /.*/);
    // From the start page itself.
    await page.goto("/");
    await item.click();
    await expect(page).toHaveURL(/\/#mitmachen$/);
    await expectBelowHeader(page);
  });

  test("phone menu links to it and closes", async ({ page }, testInfo) => {
    if (testInfo.project.name === DESKTOP) await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.locator("#menu-button").click();
    const menu = page.locator("#menu");
    await expect(menu).toBeVisible();
    await expect(menu.locator("a")).toHaveText(["Startseite", "Veranstaltungen", "Mitmachen", "Show the English version"]);
    const item = menu.getByRole("link", { name: "Mitmachen" });
    await expect(item).toHaveAttribute("href", "/#mitmachen");
    await expect(item).not.toHaveAttribute("aria-current", /.*/);
    // A jump inside the start page loads no new page. The menu must close by itself.
    await item.click();
    await expect(page).toHaveURL(/\/#mitmachen$/);
    await expect(page.locator("#menu-button")).toHaveAttribute("aria-expanded", "false");
    await expect(menu).toBeHidden();
    expect(await page.evaluate(() => document.querySelector("main").inert)).toBe(false);
    await expectBelowHeader(page);
  });

  test("footer link Schreib uns leads to it", async ({ page }) => {
    await page.goto("/veranstaltungen/");
    const link = page.locator("footer").getByRole("link", { name: "Schreib uns" });
    await expect(link).toHaveAttribute("href", "/#mitmachen");
    await link.click();
    await expect(page).toHaveURL(/\/#mitmachen$/);
    await expectBelowHeader(page);
  });

  test("a direct link puts the heading below the header", async ({ page }) => {
    // The browser's own jump to the fragment, no scroll by the test.
    await page.goto("/#mitmachen");
    await expectBelowHeader(page);
  });
});

for (const path of ["/", "/veranstaltungen/"]) {
  test.describe(`Bleib informiert on ${path}`, () => {
    test("is a black band directly before the footer", async ({ page }) => {
      await page.goto(path);
      await expect(band(page)).toHaveCount(1);
      expect(await band(page).evaluate((el) => el.nextElementSibling?.tagName)).toBe("FOOTER");
      const style = await band(page).evaluate((el) => {
        const s = getComputedStyle(el);
        return { bg: s.backgroundColor, color: s.color, marginBottom: s.marginBottom };
      });
      expect(style).toEqual({ bg: "rgb(17, 17, 17)", color: "rgb(255, 255, 255)", marginBottom: "0px" });
      // It flows into the footer's black bar: no gap.
      const bandBox = await band(page).boundingBox();
      const bar = await page.locator("footer .footer-bar").boundingBox();
      expect(Math.abs(bar.y - (bandBox.y + bandBox.height))).toBeLessThanOrEqual(1);
    });

    test("has the texts", async ({ page }) => {
      await page.goto(path);
      await expect(band(page).getByRole("heading", { level: 2 })).toHaveText("Bleib informiert");
      await expect(band(page).getByRole("heading", { level: 3 })).toHaveText(["Per Mail", "Per Signal"]);
      await expect(band(page).locator("p")).toHaveText([
        "Ab und zu ein Newsletter. Kein Spam, jederzeit abmeldbar.",
        "Du bekommst eine Mail zum Bestätigen. Mehr dazu im Datenschutz.",
        `Oder schreib an ${ADDRESS}`,
        "Kurze Infos und Termine in unserer Signal-Gruppe.",
      ]);
    });

    test("form posts the address to the API", async ({ page }) => {
      await page.goto(path);
      const form = band(page).locator("form");
      await expect(form).toHaveCount(1);
      await expect(form).toHaveAttribute("method", /^post$/i);
      await expect(form).toHaveAttribute("action", "/api/anmelden");
      const field = band(page).getByLabel("Deine Mail-Adresse");
      await expect(field).toHaveCount(1);
      await expect(field).toHaveAttribute("type", "email");
      await expect(field).toHaveAttribute("name", "email");
      await expect(field).toHaveAttribute("autocomplete", "email");
      await expect(field).toHaveAttribute("required", "");
      await expect(field).toBeVisible();
      await expect(band(page).getByRole("button", { name: "Eintragen" })).toBeVisible();
      const privacy = band(page).getByRole("link", { name: "Datenschutz" });
      await expect(privacy).toHaveAttribute("href", "/datenschutz/#newsletter");
      const address = band(page).getByRole("link", { name: ADDRESS });
      await expect(address).toHaveAttribute("href", `mailto:${ADDRESS}`);
      await expect(address).toHaveText(ADDRESS);
    });

    test("honeypot is off-screen, unfocusable and hidden from screen readers", async ({ page }, testInfo) => {
      await page.goto(path);
      const trap = band(page).locator('input[name="website"]');
      await expect(trap).toHaveCount(1);
      await expect(trap).toHaveAttribute("tabindex", "-1");
      await expect(trap).toHaveAttribute("autocomplete", "off");
      const wrapper = band(page).locator('[aria-hidden="true"]:has(input[name="website"])');
      await expect(wrapper).toHaveCount(1);
      expect(await wrapper.evaluate((el) => getComputedStyle(el).display)).not.toBe("none");
      const box = await wrapper.boundingBox();
      expect(box.x + box.width <= 0 || box.y + box.height <= 0 || box.x >= page.viewportSize().width).toBe(true);
      await expect(band(page).getByRole("textbox")).toHaveCount(1);
      await band(page).getByLabel("Deine Mail-Adresse").focus();
      await page.keyboard.press("Tab");
      expect(await page.evaluate(() => document.activeElement.name)).not.toBe("website");
      // Safari's Tab skips buttons by default. Elsewhere the button is next.
      if (testInfo.project.name !== "webkit-iphone") {
        await expect(band(page).getByRole("button", { name: "Eintragen" })).toBeFocused();
      }
    });

    test("Signal button and QR code", async ({ page }, testInfo) => {
      await page.goto(path);
      const button = band(page).getByRole("link", { name: "Signal-Gruppe beitreten" });
      await expect(button).toBeVisible();
      await expect(button).toHaveAttribute("href", SIGNAL);
      const qr = band(page).getByRole("img", { name: "QR-Code zur Signal-Gruppe des Wohnentscheids" });
      await expect(band(page).locator("img")).toHaveCount(1);
      if (testInfo.project.name === DESKTOP) {
        await expect(qr).toBeVisible();
        await qr.scrollIntoViewIfNeeded();
        await expect.poll(() => qr.evaluate((el) => el.complete && el.naturalWidth > 0)).toBe(true);
        const box = await qr.boundingBox();
        expect(box.width).toBeGreaterThanOrEqual(120);
        expect(box.width).toBeLessThanOrEqual(160);
        // On white, so a phone camera reads it on the black band.
        expect(await qr.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(255, 255, 255)");
      } else {
        await expect(qr).toBeHidden();
      }
    });

    // Each QR pixel lands on whole device pixels: the browser shows the file unscaled, at 1x and at 2x.
    test("QR code is drawn unscaled", async ({ page }) => {
      await page.setViewportSize({ width: 1000, height: 900 });
      await page.goto(path);
      const dpr = await page.evaluate(() => devicePixelRatio);
      test.skip(dpr > 2, "the QR code comes in 1x and 2x");
      const qr = band(page).locator("img.qr");
      await qr.scrollIntoViewIfNeeded();
      await expect.poll(() => qr.evaluate((el) => el.complete && el.naturalWidth > 0)).toBe(true);
      // naturalWidth divides by the srcset density. A plain image of the chosen file gives its real pixels.
      const size = await qr.evaluate(async (el) => {
        const r = el.getBoundingClientRect();
        const file = new Image();
        file.src = el.currentSrc;
        await file.decode();
        return { width: r.width, height: r.height, natural: file.naturalWidth, naturalHeight: file.naturalHeight };
      });
      expect(size.width).toBe(122);
      expect(size.height).toBe(122);
      expect(size.natural).toBe(122 * dpr);
      expect(size.naturalHeight).toBe(122 * dpr);
    });

    test("buttons are white with black text", async ({ page }) => {
      await page.goto(path);
      for (const [role, name] of [["button", "Eintragen"], ["link", "Signal-Gruppe beitreten"]]) {
        const style = await band(page).getByRole(role, { name }).evaluate((el) => {
          const s = getComputedStyle(el);
          return { bg: s.backgroundColor, color: s.color, family: s.fontFamily, case: s.textTransform,
            stretch: parseFloat(s.fontStretch), height: el.getBoundingClientRect().height };
        });
        expect(style.bg).toBe("rgb(255, 255, 255)");
        expect(style.color).toBe("rgb(17, 17, 17)");
        expect(style.family).toContain("Archivo");
        expect(style.case).toBe("none");
        expect(style.stretch).toBeGreaterThanOrEqual(80);
        expect(Math.round(style.height)).toBe(48);
      }
      const h2 = await band(page).locator("h2").evaluate((el) => {
        const s = getComputedStyle(el);
        return { case: s.textTransform, stretch: parseFloat(s.fontStretch) };
      });
      expect(h2.case).toBe("uppercase");
      expect(h2.stretch).toBeLessThanOrEqual(75);
    });

    test("focus rings are white on the band", async ({ page }) => {
      await page.goto(path);
      await expect(band(page).locator("a")).toHaveCount(3);
      const field = band(page).getByLabel("Deine Mail-Adresse");
      for (const link of [...(await band(page).locator("a").all()), field, band(page).getByRole("button")]) {
        await link.focus();
        const ring = await link.evaluate((el) => {
          const s = getComputedStyle(el);
          return { visible: el.matches(":focus-visible"), style: s.outlineStyle, color: s.outlineColor,
            width: parseFloat(s.outlineWidth) };
        });
        expect(ring).toEqual({ visible: true, style: "solid", color: "rgb(255, 255, 255)", width: ring.width });
        expect(ring.width).toBeGreaterThanOrEqual(2);
      }
    });

    test("desktop puts three columns in a row, phones stack them", async ({ page }) => {
      await page.goto(path);
      const tops = await band(page).evaluate((el) =>
        [el.querySelector("h2"), ...el.querySelectorAll("h3")].map((h) => Math.round(h.getBoundingClientRect().top)));
      const xs = await band(page).evaluate((el) =>
        [el.querySelector("h2"), ...el.querySelectorAll("h3")].map((h) => Math.round(h.getBoundingClientRect().left)));
      if (page.viewportSize().width >= 900) {
        expect(xs[0]).toBeLessThan(xs[1]);
        expect(xs[1]).toBeLessThan(xs[2]);
        expect(Math.abs(tops[1] - tops[2])).toBeLessThanOrEqual(1);
      } else {
        expect(tops[0]).toBeLessThan(tops[1]);
        expect(tops[1]).toBeLessThan(tops[2]);
      }
    });
  });
}

test("the open phone menu makes the band inert too", async ({ page }, testInfo) => {
  if (testInfo.project.name === DESKTOP) await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.locator("#menu-button").click();
  await expect(page.locator("#menu")).toBeVisible();
  expect(await band(page).evaluate((el) => el.inert)).toBe(true);
  await page.keyboard.press("Escape");
  expect(await band(page).evaluate((el) => el.inert)).toBe(false);
});

test("Mitmachen button has an ink focus ring", async ({ page }) => {
  await page.goto("/");
  const button = join(page).getByRole("link", { name: "Jetzt mitmachen" });
  await button.focus();
  const ring = await button.evaluate((el) => {
    const s = getComputedStyle(el);
    return { style: s.outlineStyle, color: s.outlineColor };
  });
  expect(ring).toEqual({ style: "solid", color: "rgb(17, 17, 17)" });
});

const AFTER = {
  "/danke/": { title: "Fast geschafft – Wohnentscheid Frankfurt", h1: "Fast geschafft",
    p: ["Schau in dein Postfach und bestätige deine Anmeldung. Der Link gilt 72 Stunden.",
      "Keine Mail da? Schau auch im Spam-Ordner nach."] },
  "/fehler/": { title: "Das hat nicht geklappt – Wohnentscheid Frankfurt", h1: "Das hat nicht geklappt",
    p: [`Versuch es später noch mal oder schreib uns an ${ADDRESS}.`] },
  "/en/thanks/": { title: "Almost done – Wohnentscheid Frankfurt", h1: "Almost done",
    p: ["Look in your inbox and confirm your sign-up. The link is valid for 72 hours.",
      "No email? Also look in your spam folder."] },
  "/en/error/": { title: "That did not work – Wohnentscheid Frankfurt", h1: "That did not work",
    p: [`Try again later or write to us at ${ADDRESS}.`] },
};

for (const [path, want] of Object.entries(AFTER)) {
  test(`${path} has its texts and no band`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveTitle(want.title);
    await expect(page.locator("h1")).toHaveText(want.h1);
    await expect(page.locator("main.prose, main .prose").locator("p")).toHaveText(want.p);
    await expect(page.locator("#bleib-informiert")).toHaveCount(0);
    await expect(page.locator("#stay-informed")).toHaveCount(0);
    await expect(page.locator("footer")).toBeVisible();
  });
}

test("/fehler/ offers a mailto with subject and body", async ({ page }) => {
  await page.goto("/fehler/");
  const href = await page.locator("main").getByRole("link", { name: ADDRESS }).getAttribute("href");
  expect(href.startsWith(`mailto:${ADDRESS}?`)).toBe(true);
  const params = new URLSearchParams(href.slice(href.indexOf("?") + 1));
  expect(params.get("subject")).toBe("Bleib informiert");
  expect(params.get("body")).toBe("Bitte tragt mich in euren Newsletter ein.");
  expect(href).not.toContain("+");
});

test("/en/error/ offers a mailto with subject and body", async ({ page }) => {
  await page.goto("/en/error/");
  const href = await page.locator("main").getByRole("link", { name: ADDRESS }).getAttribute("href");
  expect(href.startsWith(`mailto:${ADDRESS}?`)).toBe(true);
  const params = new URLSearchParams(href.slice(href.indexOf("?") + 1));
  expect(params.get("subject")).toBe("Stay informed");
  expect(params.get("body")).toBe("Please add me to your newsletter.");
  expect(href).not.toContain("+");
});

test.describe("English start page: Get involved and Stay informed", () => {
  const section = (page) => page.locator("main section#get-involved");
  const stay = (page) => page.locator("#stay-informed");

  test("Get involved has the text and the mail button", async ({ page }) => {
    await page.goto("/en/");
    await expect(page.locator("#mitmachen")).toHaveCount(0);
    await expect(section(page).getByRole("heading", { level: 2, name: "Get involved" })).toBeVisible();
    await expect(section(page).locator("p")).toHaveText(
      "You want to get active, but you are not sure how you can help? Write to us by email, and we will contact you :)!");
    const button = section(page).getByRole("link", { name: "Get involved now" });
    await expect(button).toBeVisible();
    await expect(button).toHaveAttribute("href", `mailto:${ADDRESS}?subject=Get%20involved`);
  });

  test("the band has English texts, the English form action and privacy link", async ({ page }) => {
    await page.goto("/en/");
    await expect(page.locator("#bleib-informiert")).toHaveCount(0);
    await expect(stay(page)).toHaveCount(1);
    expect(await stay(page).evaluate((el) => el.nextElementSibling?.tagName)).toBe("FOOTER");
    await expect(stay(page).getByRole("heading", { level: 2, name: "Stay informed" })).toBeVisible();
    await expect(stay(page).getByRole("heading", { level: 3 })).toHaveText(["By email", "On Signal"]);
    await expect(stay(page).getByText("A newsletter now and then. No spam. You can unsubscribe at any time.")).toBeVisible();
    await expect(stay(page).getByLabel("Your email address")).toBeVisible();
    await expect(stay(page).getByRole("button", { name: "Sign up" })).toBeVisible();
    await expect(stay(page).locator("form")).toHaveAttribute("action", "/api/en/signup");
    await expect(stay(page).locator("form")).toHaveAttribute("method", "post");
    await expect(stay(page).getByText("You will get an email to confirm. More about this under")).toBeVisible();
    await expect(stay(page).getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/en/privacy/#newsletter");
    await expect(stay(page).getByText("Or write to")).toBeVisible();
    await expect(stay(page).getByRole("link", { name: ADDRESS })).toHaveAttribute("href", `mailto:${ADDRESS}`);
    await expect(stay(page).getByRole("link", { name: "Join the Signal group" })).toHaveAttribute("href", SIGNAL);
    if (page.viewportSize().width >= 900) {
      await expect(stay(page).locator("img.qr")).toHaveAttribute("alt", "QR code for the Signal group of Wohnentscheid Frankfurt");
    }
  });

  test("the menu item and the footer link jump to the English block", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== DESKTOP, "desktop bar");
    await page.goto("/en/events/");
    const item = page.locator("nav.desktop-nav").getByRole("link", { name: "Get involved" });
    await expect(item).toHaveAttribute("href", "/en/#get-involved");
    await expect(item).not.toHaveAttribute("aria-current", /.*/);
    await expect(page.locator("nav.desktop-nav a")).toHaveText(["Events", "Get involved"]);
    await item.click();
    await expect(page).toHaveURL(/\/en\/#get-involved$/);
    const heading = section(page).getByRole("heading", { name: "Get involved" });
    await expect(heading).toBeInViewport();
    const header = await page.locator("header").boundingBox();
    expect((await heading.boundingBox()).y).toBeGreaterThanOrEqual(header.y + header.height);
  });

  test("the phone menu links to the English block and closes", async ({ page }, testInfo) => {
    if (testInfo.project.name === DESKTOP) await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/en/");
    await page.locator("#menu-button").click();
    const item = page.locator("#menu").getByRole("link", { name: "Get involved" });
    await expect(item).toHaveAttribute("href", "/en/#get-involved");
    await item.click();
    await expect(page).toHaveURL(/\/en\/#get-involved$/);
    await expect(page.locator("#menu-button")).toHaveAttribute("aria-expanded", "false");
    expect(await page.evaluate(() => document.querySelector("[data-band]").inert)).toBe(false);
  });
});
