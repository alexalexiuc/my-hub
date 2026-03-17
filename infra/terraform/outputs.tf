output "server_id" {
  description = "Hetzner server resource ID."
  value       = hcloud_server.main.id
}

output "server_ipv4" {
  description = "Server primary IPv4 address. DNS A records point here. Update GitHub Secret VPS_HOST to this value."
  value       = hcloud_server.main.ipv4_address
}

output "server_ipv6" {
  description = "Server IPv6 address. DNS AAAA records point here."
  value       = hcloud_server.main.ipv6_address
}

output "ssh_command" {
  description = "SSH command to connect to the server as the ubuntu admin user."
  value       = "ssh root@${hcloud_server.main.ipv4_address}"
}

output "hub_url" {
  description = "Production URL for the hub admin panel (live after first deploy + TLS cert issuance)."
  value       = "https://hub.alexiuc.dev"
}

output "mcp_url" {
  description = "Production URL for the MCP server (live after first deploy + TLS cert issuance)."
  value       = "https://mcp.alexiuc.dev"
}

output "next_steps" {
  description = "Post-apply checklist."
  value       = <<-EOT
    Next steps after terraform apply:
    1. SSH in:         ssh root@${hcloud_server.main.ipv4_address}
                       (wait ~2-3 min for cloud-init to finish)
    2. Clone repo:     sudo -u deploy git clone https://github.com/alexalexiuc/my-hub /opt/my-hub
    3. Create .env:    sudo -u deploy cp /opt/my-hub/.env.example /opt/my-hub/.env
                       sudo nano /opt/my-hub/.env  (fill in all secrets)
    4. GitHub Secrets: VPS_HOST=${hcloud_server.main.ipv4_address}  VPS_USER=deploy  VPS_SSH_KEY=<deploy private key>
    5. First deploy:   push to main branch (triggers GitHub Actions)
  EOT
}
