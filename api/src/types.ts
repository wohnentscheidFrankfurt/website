export type Config = {
  port: number; siteOrigin: string; tokenSecret: string; from: string; to: string;
  smtp: { host: string; port: number; tls: "starttls" | "none"; user?: string; password?: string };
  limits: { perIp: number; perAddress: number; total: number };
};

/** The language of the page the visitor signed up on. The API does not import from src/. */
export type Lang = "de" | "en";

export type Mailer = {
  sendConfirmation(address: string, link: string, lang: Lang): Promise<void>;
  sendNotification(address: string, confirmedAt: Date, lang: Lang): Promise<void>;
};
