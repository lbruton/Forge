#!/bin/sh
set -e

# Verify the data volume is writable by the forge user.
# Named Docker volumes may retain root ownership from prior builds.
# If this check fails, fix it from the host:
#   docker exec -u root forge-vuln-cisco chown -R forge:forge /data
if [ ! -w /data ]; then
  echo "FATAL: /data is not writable by user $(id -un) (UID $(id -u))." >&2
  echo "Fix with: docker exec -u root forge-vuln-cisco chown -R forge:forge /data" >&2
  exit 1
fi

exec "$@"
