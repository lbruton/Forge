#!/bin/sh
set -e

# Ensure the data directory is writable by the forge user.
# Named Docker volumes may retain root ownership from prior builds.
if [ "$(id -u)" = "0" ]; then
  if [ -d /data ] && [ "$(stat -c %u /data 2>/dev/null || stat -f %u /data)" != "1000" ]; then
    echo "entrypoint: fixing /data ownership for forge user" >&2
    chown -R forge:forge /data || echo "entrypoint: WARNING — failed to chown /data" >&2
  fi
  exec gosu forge "$@"
fi

# Already running as non-root (e.g. --user or K8s runAsUser) — skip gosu
exec "$@"
