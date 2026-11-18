#!/usr/bin/env bash
set -euo pipefail

revision="${1:-$(git rev-parse HEAD)}"
if [[ ! "$revision" =~ ^[0-9a-f]{40}$ ]]; then
  echo 'Expected a full Git commit SHA' >&2
  exit 2
fi

cd "$(dirname "${BASH_SOURCE[0]}")/.."
image="dify-app-hub:trial-${revision:0:12}"
output=offline-image
archive=dify-app-hub-linux-amd64.tar.gz

docker buildx build --platform linux/amd64 --load \
  --provenance=false --sbom=false \
  --label "org.opencontainers.image.revision=$revision" \
  --tag "$image" --file Dockerfile .

test "$(docker image inspect --format '{{.Os}}/{{.Architecture}}' "$image")" = linux/amd64
docker run --rm --network none --entrypoint node "$image" -e '
  const { existsSync } = require("node:fs");
  for (const path of ["/app/server.js", "/app/db/migrate.ts", "/docker-entrypoint.sh"]) {
    if (!existsSync(path)) throw new Error("Missing required image file: " + path);
  }
  require.resolve("drizzle-orm/mysql2/migrator");
  require.resolve("mysql2/promise");
'

mkdir -p "$output"
docker save "$image" | gzip -1 > "$output/$archive"
(
  cd "$output"
  sha256sum "$archive" > "$archive.sha256"
  sha256sum -c "$archive.sha256"
  printf '%s\n' "$image" > image.txt
)
