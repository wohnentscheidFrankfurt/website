import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import type { Config, Lang, Mailer } from "./types.ts";

type Mail = { to: string; subject: string; text: string };

export function berlinDateTime(d: Date): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("de-DE", {
      timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(d).map((p) => [p.type, p.value]),
  );
  return `${parts.day}.${parts.month}.${parts.year}, ${parts.hour}:${parts.minute}`;
}

export function confirmationMail(address: string, link: string, lang: Lang = "de"): Mail {
  if (lang === "en") {
    return {
      to: address,
      subject: "Please confirm your sign-up",
      text: `Hello,

someone entered this address for the newsletter of Wohnentscheid Frankfurt.
Was it you? Then confirm here:

${link}

The link is valid for 72 hours. If it was not you, ignore this email. Then nothing happens.

Wohnentscheid Frankfurt
https://wohnentscheid-frankfurt.de/en/
`,
    };
  }
  return {
    to: address,
    subject: "Bitte bestätige deine Anmeldung",
    text: `Hallo,

jemand hat diese Adresse für den Newsletter des Wohnentscheids Frankfurt eingetragen.
Warst du das? Dann bestätige hier:

${link}

Der Link gilt 72 Stunden. Warst du es nicht, ignoriere diese Mail. Dann passiert nichts.

Wohnentscheid Frankfurt
https://wohnentscheid-frankfurt.de/
`,
  };
}

/** Always German: the mail is for the team. The English variant only names the English site. */
export function notificationMail(address: string, confirmedAt: Date, to: string, lang: Lang = "de"): Mail {
  const site = lang === "en" ? "die englische Website" : "die Website";
  return {
    to,
    subject: "Anmeldung Newsletter (Website)",
    text: `Neue Anmeldung über ${site}, bestätigt am ${berlinDateTime(confirmedAt)}: ${address}\n`,
  };
}

/** Short timeouts: a hanging SMTP server must not keep the visitor waiting for minutes. */
export function transportOptions(smtp: Config["smtp"]): SMTPTransport.Options {
  const timeouts = { connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 20_000 };
  return smtp.tls === "starttls"
    ? { host: smtp.host, port: smtp.port, secure: false, requireTLS: true, auth: { user: smtp.user, pass: smtp.password }, ...timeouts }
    : { host: smtp.host, port: smtp.port, secure: false, ignoreTLS: true, ...timeouts };
}

export function createMailer(config: Config): Mailer {
  const transport = nodemailer.createTransport(transportOptions(config.smtp));
  const from = `"Wohnentscheid Frankfurt" <${config.from}>`;
  return {
    async sendConfirmation(address, link, lang) {
      await transport.sendMail({ from, ...confirmationMail(address, link, lang) });
    },
    async sendNotification(address, confirmedAt, lang) {
      await transport.sendMail({ from, ...notificationMail(address, confirmedAt, config.to, lang) });
    },
  };
}
