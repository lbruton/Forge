#!/bin/sh
# Ensure the data directory is writable by the forge user.
# Named Docker volumes may retain root ownership from prior builds.
chown -R forge:forge /data 2>/dev/null || true

exec gosu forge uvicorn main:app --host 0.0.0.0 --port 8400
