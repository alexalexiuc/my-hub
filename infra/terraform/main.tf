# ── SSH Key ───────────────────────────────────────────────────────────────────
# Registers your personal public key with Hetzner.
# Hetzner automatically injects it into root's authorized_keys on server creation.

resource "hcloud_ssh_key" "admin" {
  name       = var.ssh_key_name
  public_key = var.ssh_public_key
}

# ── Server ────────────────────────────────────────────────────────────────────

resource "hcloud_server" "main" {
  name        = var.server_name
  server_type = var.server_type
  image       = var.server_image
  location    = var.server_location

  ssh_keys     = [hcloud_ssh_key.admin.id]
  firewall_ids = [hcloud_firewall.main.id]

  # cloud-init runs once on first boot:
  # - installs Docker CE + compose plugin
  # - creates the 'deploy' user for GitHub Actions
  # - hardens SSH config
  # - sets up UFW + fail2ban
  # - creates /opt/my-hub directory
  user_data = templatefile("${path.module}/cloud-init.yaml", {
    deploy_ssh_public_key = var.deploy_ssh_public_key
  })

  labels = {
    project = "my-hub"
    env     = "production"
  }

  # prevent_destroy: guards against accidental terraform destroy.
  # To destroy intentionally: comment out this block first.
  #
  # ignore_changes:
  #   user_data — cloud-init only runs on first boot; Hetzner API doesn't expose
  #               it after creation so Terraform would always see a diff and try
  #               to recreate the server. Manage via cloud-init on new servers,
  #               or the manual setup script (see README) on existing ones.
  #   image     — after creation Hetzner stores the numeric image ID internally;
  #               the human-readable slug (e.g. "ubuntu-24.04") causes a perpetual
  #               diff. Safe to ignore — image can't be changed in-place anyway.
  #   ssh_keys  — managed at creation time; changes would require recreation.
  lifecycle {
    prevent_destroy = true  # protects against accidental destruction
    ignore_changes = [user_data, image, ssh_keys]
  }
}
