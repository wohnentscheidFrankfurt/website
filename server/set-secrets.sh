#!/usr/bin/env bash
# Put the secrets of the sign-up API on the server as encrypted systemd credentials.
# Run it yourself. It prints no secret: the password goes from the Keychain through a pipe into ssh.
# Run it again after a new info@ password. The token secret is only created when it is missing:
# a new one makes every pending confirmation link invalid.
# shellcheck disable=SC2029 # the paths are meant to expand here, on the client side
set -euo pipefail

SSH=wohnentscheid-admin
DIR=/etc/credstore.encrypted
SMTP="$DIR/wohnentscheid-api-smtp-password"
TOKEN="$DIR/wohnentscheid-api-token-secret"

ssh "$SSH" "install -d -m 700 $DIR"

# Check the Keychain item first. A failing pipe must never replace the live credential with an empty one.
security find-generic-password -s wohnentscheid-mail -a IONOS_PASSWORD >/dev/null
# The remote side refuses empty input, too.
security find-generic-password -s wohnentscheid-mail -a IONOS_PASSWORD -w | tr -d '\n' |
  ssh "$SSH" "pw=\$(cat) && test -n \"\$pw\" && printf %s \"\$pw\" | systemd-creds encrypt --name=smtp-password - $SMTP && chmod 600 $SMTP"

# One remote command: a failed ssh must not read as "missing" and replace the token secret.
ssh "$SSH" "test -e $TOKEN || (openssl rand -base64 32 | systemd-creds encrypt --name=token-secret - $TOKEN && chmod 600 $TOKEN)"

ssh "$SSH" "systemctl restart wohnentscheid-api"
echo "Secrets set."
