// Reads mails from the Mailpit of the test setup (SMTP 1026, HTTP 8026).
const BASE = "http://127.0.0.1:8026";

// Finds a mail to `to` with `subject` whose text contains `contains`.
// Polls until `timeoutMs` has passed. Returns { from, text } or null.
export async function findMail({ to, subject, contains, timeoutMs = 5000 }) {
  const query = `to:"${to}" subject:"${subject}"`;
  const deadline = Date.now() + timeoutMs;
  do {
    const search = await fetch(`${BASE}/api/v1/search?query=${encodeURIComponent(query)}`);
    const { messages = [] } = await search.json();
    for (const { ID } of messages) {
      const mail = await (await fetch(`${BASE}/api/v1/message/${ID}`)).json();
      const text = mail.Text ?? "";
      if (contains === undefined || text.includes(contains)) {
        return { from: `"${mail.From.Name}" <${mail.From.Address}>`, text };
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  } while (Date.now() < deadline);
  return null;
}
