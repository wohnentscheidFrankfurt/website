# Make the newsletter QR codes

The QR codes for flyers lead to the short addresses `/newsletter` and `/en/newsletter`. Caddy redirects them to the
sign-up form (`architecture.md`, Server). The files are not in the repo.

1. Install the tools once: `brew install qrencode zbar`.
2. Make the German code as SVG (for print) and PNG:
   ```bash
   qrencode -l L -m 4 -t SVG --svg-path -o newsletter-qr-de.svg https://wohnentscheid-frankfurt.de/newsletter
   qrencode -l L -m 4 -s 32 -t PNG -o newsletter-qr-de.png https://wohnentscheid-frankfurt.de/newsletter
   ```
   The English code: the same with `-en` and `https://wohnentscheid-frankfurt.de/en/newsletter`.
3. Read the PNG back: `zbarimg -q --raw newsletter-qr-de.png`. It prints the address.
4. Scan the printed proof with a phone. It must open the form.

Level L keeps the code small: 29 modules plus 4 on each side. The PNG has 1184 px, enough for 5 cm at 600 dpi.
Print the short address below the code, for people without a scanner.
