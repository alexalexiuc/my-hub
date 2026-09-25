# Builds every deployable image in a single BuildKit session.
#
# Why bake instead of one `docker build` per image:
#   - Targets build in parallel.
#   - The Dockerfiles share an identical prefix (fetch -> install -> shared build),
#     which BuildKit runs once and reuses across all targets.
#   - Each image gets its own GitHub Actions cache scope. With a single default
#     scope every image's cache export overwrites the previous one's.
#
# CI: .github/workflows/deploy.yml (group "prod") and e2e.yml (group "staging").
# Local: `docker buildx bake --load hub` builds one image into the local daemon.

variable "IMAGE_PREFIX" {
  default = "ghcr.io/local/my-hub"
}

# Moving tag pushed alongside the immutable sha tag: "latest" (prod) or "staging-latest".
variable "TAG" {
  default = "latest"
}

# Full commit SHA; adds a `sha-<7 chars>` tag and the OCI revision label when set.
variable "SHA" {
  default = ""
}

# Repository URL for the OCI source label, which links GHCR packages to the repo.
variable "SOURCE_URL" {
  default = ""
}

# Set to any non-empty value in GitHub Actions to read/write the gha layer cache.
variable "GHA_CACHE" {
  default = ""
}

group "default" {
  targets = ["migrate", "worker", "mcp-server", "hub"]
}

group "prod" {
  targets = ["migrate", "worker", "mcp-server", "hub"]
}

group "staging" {
  targets = ["migrate", "worker", "mcp-server", "hub", "e2e-seeds"]
}

function "tags" {
  params = [name]
  result = compact([
    "${IMAGE_PREFIX}-${name}:${TAG}",
    notequal(SHA, "") ? "${IMAGE_PREFIX}-${name}:sha-${substr(SHA, 0, 7)}" : "",
  ])
}

function "cache_from" {
  params = [name]
  result = notequal(GHA_CACHE, "") ? ["type=gha,scope=${name}"] : []
}

function "cache_to" {
  params = [name]
  result = notequal(GHA_CACHE, "") ? ["type=gha,scope=${name},mode=max"] : []
}

target "_common" {
  context = "."
  labels = {
    "org.opencontainers.image.source"   = SOURCE_URL
    "org.opencontainers.image.revision" = SHA
  }
}

target "migrate" {
  inherits   = ["_common"]
  dockerfile = "packages/shared/Dockerfile.migrate"
  tags       = tags("migrate")
  cache-from = cache_from("migrate")
  cache-to   = cache_to("migrate")
}

target "worker" {
  inherits   = ["_common"]
  dockerfile = "packages/worker/Dockerfile"
  tags       = tags("worker")
  cache-from = cache_from("worker")
  cache-to   = cache_to("worker")
}

target "mcp-server" {
  inherits   = ["_common"]
  dockerfile = "packages/mcp-server/Dockerfile"
  tags       = tags("mcp-server")
  cache-from = cache_from("mcp-server")
  cache-to   = cache_to("mcp-server")
}

target "hub" {
  inherits   = ["_common"]
  dockerfile = "packages/hub/Dockerfile"
  tags       = tags("hub")
  cache-from = cache_from("hub")
  cache-to   = cache_to("hub")
}

target "e2e-seeds" {
  inherits   = ["_common"]
  dockerfile = "packages/e2e/Dockerfile"
  tags       = tags("e2e-seeds")
  cache-from = cache_from("e2e-seeds")
  cache-to   = cache_to("e2e-seeds")
}
