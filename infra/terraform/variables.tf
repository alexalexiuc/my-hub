# ── Hetzner Cloud ─────────────────────────────────────────────────────────────

variable "hcloud_token" {
  description = "Hetzner Cloud API token (Read+Write). Generate at console.hetzner.cloud → Security → API Tokens."
  type        = string
  sensitive   = true
}

variable "server_name" {
  description = "Name for the Hetzner server resource."
  type        = string
  default     = "my-hub"
}

variable "server_type" {
  description = "Hetzner server type. cpx22 = 3 vCPU AMD, 4 GB RAM, 80 GB SSD."
  type        = string
  default     = "cpx22"
}

variable "server_location" {
  description = "Hetzner datacenter location. nbg1=Nuremberg, fsn1=Falkenstein, hel1=Helsinki."
  type        = string
  default     = "nbg1"
}

variable "server_image" {
  description = "OS image slug for the server."
  type        = string
  default     = "ubuntu-24.04"
}

variable "ssh_key_name" {
  description = "Name for the SSH key resource in Hetzner. Must exactly match the existing key name when importing (Security → SSH Keys in the console)."
  type        = string
  default     = "my-hub-admin"
}

variable "ssh_public_key" {
  description = "Your personal SSH public key (for ubuntu user on the server)."
  type        = string
}

variable "deploy_ssh_public_key" {
  description = "SSH public key for the GitHub Actions deploy user. Generate a separate key: ssh-keygen -t ed25519 -C 'github-actions-deploy'. Add the private key as GitHub Secret VPS_SSH_KEY."
  type        = string
  # Example: "ssh-ed25519 AAAAC3... github-actions-deploy"
}

# ── Cloudflare ────────────────────────────────────────────────────────────────

variable "cloudflare_api_token" {
  description = "Cloudflare API token with Zone:DNS:Edit permission scoped to alexiuc.dev. Generate at dash.cloudflare.com → My Profile → API Tokens."
  type        = string
  sensitive   = true
}

variable "cloudflare_zone_id" {
  description = "Cloudflare Zone ID for alexiuc.dev. Found at dash.cloudflare.com → alexiuc.dev → Overview → right sidebar."
  type        = string
}
