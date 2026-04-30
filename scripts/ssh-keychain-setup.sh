#!/usr/bin/env bash
# ABOUTME: Pull SSH key passphrase from 1Password and store it in macOS Keychain.
# ABOUTME: After running once, ssh-add loads the key from Keychain automatically.

set -euo pipefail

SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_ed25519}"
# Change this to match your 1Password item. Examples:
#   "SSH Key"              — item titled "SSH Key", field "password"
#   "GitHub SSH"           — item titled "GitHub SSH"
#   "op://Personal/SSH Key/password" — secret reference syntax
OP_ITEM="${OP_ITEM:-SSH Key}"
OP_FIELD="${OP_FIELD:-password}"

# --- preflight ---
command -v op >/dev/null 2>&1 || { echo "error: 1Password CLI (op) not found"; exit 1; }
[[ -f "$SSH_KEY" ]] || { echo "error: SSH key not found at $SSH_KEY"; exit 1; }

# --- ensure 1Password session ---
if ! op account list --format json 2>/dev/null | grep -q '"url"'; then
  echo "Sign in to 1Password first:  eval \$(op signin)"
  exit 1
fi

# --- fetch passphrase ---
echo "Fetching passphrase from 1Password item '$OP_ITEM'..."
PASSPHRASE="$(op item get "$OP_ITEM" --fields "$OP_FIELD" --reveal 2>/dev/null)" || {
  echo "error: could not fetch passphrase — check OP_ITEM='$OP_ITEM' and OP_FIELD='$OP_FIELD'"
  echo "  List your items:  op item list --format json | jq '.[].title'"
  exit 1
}

[[ -n "$PASSPHRASE" ]] || { echo "error: passphrase is empty"; exit 1; }

# --- add to agent + macOS Keychain ---
# SSH_ASKPASS trick: ssh-add reads from this program instead of tty
ASKPASS_SCRIPT="$(mktemp)"
chmod 700 "$ASKPASS_SCRIPT"
cat > "$ASKPASS_SCRIPT" <<SCRIPT
#!/bin/sh
echo "$PASSPHRASE"
SCRIPT

# Start agent if needed
if ! ssh-add -l >/dev/null 2>&1; then
  eval "$(ssh-agent -s)"
  echo "Started ssh-agent (pid $SSH_AGENT_PID)"
fi

# --apple-use-keychain stores the passphrase in macOS Keychain
# so future logins load it automatically via ssh-add --apple-load-keychain
DISPLAY=:0 SSH_ASKPASS="$ASKPASS_SCRIPT" SSH_ASKPASS_REQUIRE=force \
  ssh-add --apple-use-keychain "$SSH_KEY" 2>&1

rm -f "$ASKPASS_SCRIPT"

echo ""
echo "Done. Key loaded and passphrase stored in macOS Keychain."
echo "Add this to ~/.ssh/config to auto-load on login:"
echo ""
echo "  Host *"
echo "    UseKeychain yes"
echo "    AddKeysToAgent yes"
echo "    IdentityFile $SSH_KEY"
