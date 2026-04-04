#!/bin/sh
# Forge Vuln-Cisco Sidecar — Setup Script
# Retrieves the API key for connecting to the Forge frontend.

CONTAINER="forge-vuln-cisco"

echo ""
echo "=== Forge Cisco Vulnerability Scanner — Setup ==="
echo ""

# Check if container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo "ERROR: Container '${CONTAINER}' is not running."
  echo "Start the stack first: docker compose up -d"
  exit 1
fi

# Wait for the key file to be generated (first boot takes a moment)
echo "Checking for API key..."
for i in 1 2 3 4 5; do
  KEY=$(docker exec "$CONTAINER" cat /data/api-key.txt 2>/dev/null)
  if [ -n "$KEY" ]; then
    break
  fi
  sleep 1
done

if [ -z "$KEY" ]; then
  echo "ERROR: API key not found. The container may still be starting."
  echo "Try again in a few seconds: ./sidecar/vuln-cisco/setup.sh"
  exit 1
fi

echo ""
echo "Container:  ${CONTAINER} (running)"
echo "API Key:    ${KEY}"
echo ""
echo "=== Environment Variable ==="
echo ""
echo "  FORGE_CORS_ORIGIN  The Forge frontend URL (NPM proxy address)."
echo "                     Default: https://forge.lbruton.cc"
echo "                     Set this in the Portainer stack environment if your"
echo "                     frontend hostname differs from the default."
echo ""
echo "=== To connect in Forge ==="
echo ""
echo "  1. Open Forge in your browser"
echo "  2. Click Plugins in the sidebar"
echo "  3. Click + to add a plugin"
echo "  4. Endpoint: your sidecar NPM proxy URL (e.g. https://forge-vuln-cisco.lbruton.cc)"
echo "  5. API Key:  (paste the key above)"
echo "  6. Click Connect"
echo ""
echo "Health check: curl -s -H 'Authorization: Bearer ${KEY}' https://forge-vuln-cisco.lbruton.cc/forge/health | python3 -m json.tool"
echo ""
