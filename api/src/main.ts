import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createApp } from "./app.ts";
import { loadConfig } from "./config.ts";
import { createMailer } from "./mail.ts";

function readCredential(name: string): string | undefined {
  const dir = process.env.CREDENTIALS_DIRECTORY;
  if (!dir) return undefined;
  try {
    return readFileSync(join(dir, name), "utf8");
  } catch {
    return undefined;
  }
}

const config = loadConfig(process.env, readCredential);
const handler = createApp({ config, mailer: createMailer(config), now: Date.now, log: (line) => console.log(line) });
const server = createServer(handler);
server.listen(config.port, "127.0.0.1", () => console.log(`listening ${config.port}`));
process.on("SIGTERM", () => server.close(() => process.exit(0)));
