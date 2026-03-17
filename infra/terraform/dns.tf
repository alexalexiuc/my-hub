# Dual-stack DNS records — both A (IPv4) and AAAA (IPv6) for each subdomain.
#
# proxied = false: Traefik uses Let's Encrypt HTTP-01 ACME challenge, which
# requires direct server access on port 80. Cloudflare CDN proxy would interfere.
# TLS is handled entirely by Traefik + Let's Encrypt.

locals {
  server_ipv4 = hcloud_server.main.ipv4_address
  # Hetzner assigns a /64 IPv6 block; the server's address is the first host address.
  server_ipv6 = hcloud_server.main.ipv6_address
}

# ── hub.alexiuc.dev ──────────────────────────────────────────────────────────

resource "cloudflare_record" "hub_a" {
  zone_id = var.cloudflare_zone_id
  name    = "hub"
  type    = "A"
  content = local.server_ipv4
  ttl     = 300
  proxied = false
  comment = "my-hub Next.js admin panel (IPv4)"
}

resource "cloudflare_record" "hub_aaaa" {
  zone_id = var.cloudflare_zone_id
  name    = "hub"
  type    = "AAAA"
  content = local.server_ipv6
  ttl     = 300
  proxied = false
  comment = "my-hub Next.js admin panel (IPv6)"
}

# ── mcp.alexiuc.dev ──────────────────────────────────────────────────────────

resource "cloudflare_record" "mcp_a" {
  zone_id = var.cloudflare_zone_id
  name    = "mcp"
  type    = "A"
  content = local.server_ipv4
  ttl     = 300
  proxied = false
  comment = "my-hub Fastify MCP server (IPv4)"
}

resource "cloudflare_record" "mcp_aaaa" {
  zone_id = var.cloudflare_zone_id
  name    = "mcp"
  type    = "AAAA"
  content = local.server_ipv6
  ttl     = 300
  proxied = false
  comment = "my-hub Fastify MCP server (IPv6)"
}
