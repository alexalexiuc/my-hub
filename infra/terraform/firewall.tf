resource "hcloud_firewall" "main" {
  name = "${var.server_name}-firewall"

  # ── Inbound: allow only SSH, HTTP, HTTPS ─────────────────────────────────

  rule {
    direction   = "in"
    protocol    = "tcp"
    port        = "22"
    source_ips  = ["0.0.0.0/0", "::/0"]
    description = "SSH"
  }

  rule {
    direction   = "in"
    protocol    = "tcp"
    port        = "80"
    source_ips  = ["0.0.0.0/0", "::/0"]
    description = "HTTP — Traefik redirects to HTTPS and handles Let's Encrypt ACME challenges"
  }

  rule {
    direction   = "in"
    protocol    = "tcp"
    port        = "443"
    source_ips  = ["0.0.0.0/0", "::/0"]
    description = "HTTPS — Traefik TLS termination"
  }

  # ── Outbound: all traffic allowed (default when no outbound rules are set) ─
  # The server needs outbound access to: GHCR (docker pull), Let's Encrypt ACME,
  # apt repos, and GitHub (git pull).

  labels = {
    project = "my-hub"
  }
}
