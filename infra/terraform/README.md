# Infrastructure — Terraform

Provisions the Hetzner VPS and Cloudflare DNS records for **my-hub**.

## Resources created

| Resource                | Details                                                      |
| ----------------------- | ------------------------------------------------------------ |
| `hcloud_server`         | CPX22 — 3 vCPU AMD, 4 GB RAM, 80 GB SSD, Ubuntu 24.04        |
| `hcloud_ssh_key`        | Your personal public key registered with Hetzner             |
| `hcloud_firewall`       | Allow TCP 22, 80, 443 inbound; block everything else         |
| `cloudflare_record` × 4 | A + AAAA records for `hub.alexiuc.dev` and `mcp.alexiuc.dev` |

## Prerequisites

- [Terraform](https://developer.hashicorp.com/terraform/install) ≥ 1.6
- A [Hetzner Cloud](https://console.hetzner.cloud) project with an API token (Read+Write)
- A [Cloudflare API token](https://dash.cloudflare.com/profile/api-tokens) with `Zone → DNS → Edit` for `alexiuc.dev`
- Two SSH key pairs (see below)

## SSH keys setup

```powershell
# Personal key — for your laptop → server (ubuntu user)
ssh-keygen -t ed25519 -C "alex-laptop" -f "$env:USERPROFILE\.ssh\id_ed25519_myhub"

# Deploy key — for GitHub Actions (deploy user)
ssh-keygen -t ed25519 -C "github-actions-deploy" -f "$env:USERPROFILE\.ssh\id_ed25519_deploy"
```

Add the **deploy private key** (`id_ed25519_deploy`) as GitHub Secret `VPS_SSH_KEY`.

---

## First-time setup (server already exists)

The server was created manually in the Hetzner console. You need to **import** it into
Terraform state before running `terraform apply`, otherwise Terraform will try to create
a duplicate server.

### Step 1 — Find the resource IDs

In the [Hetzner Console](https://console.hetzner.cloud):

- **Server ID**: Servers → `my-hub` → the numeric ID is in the page URL:
  `https://console.hetzner.cloud/projects/.../servers/**12345678**/overview`
- **SSH Key ID**: Security → SSH Keys → click the key → ID is in the URL

### Step 2 — Initialize and import

```bash
cd infra/terraform

# Download providers
terraform init

# Import the existing SSH key
terraform import hcloud_ssh_key.admin <SSH_KEY_ID>

# Import the existing server
terraform import hcloud_server.main <SERVER_ID>
```

### Step 3 — Apply remaining resources

The firewall and DNS records don't exist yet — `terraform apply` will create them:

```bash
terraform plan    # should show: 0 to destroy, create firewall + 4 DNS records
terraform apply
terraform output  # get the server IPv4
```

### Step 4 — Wait for cloud-init to finish

cloud-init runs automatically on first boot and takes ~3–5 minutes. SSH in and verify:

```bash
ssh root@<SERVER_IPV4>

cloud-init status        # wait until: status: done
docker --version         # Docker installed?
id deploy                # deploy user exists + in docker group?
ufw status               # 22/80/443 open?
ls -la /opt/my-hub       # directory owned by deploy?
```

### Step 5 — Clone repo and create .env

```bash
ssh root@<SERVER_IPV4>

sudo -u deploy git clone https://github.com/alexalexiuc/my-hub /opt/my-hub
sudo -u deploy cp /opt/my-hub/.env.example /opt/my-hub/infra/.env
sudo nano /opt/my-hub/infra/.env    # fill in all secrets
```

### Step 6 — Set GitHub Secrets

In the repo: **Settings → Secrets and variables → Actions**

| Secret        | Value                                                |
| ------------- | ---------------------------------------------------- |
| `VPS_HOST`    | server IPv4 from `terraform output server_ipv4`      |
| `VPS_USER`    | `deploy`                                             |
| `VPS_SSH_KEY` | contents of `~/.ssh/id_ed25519_deploy` (private key) |

### Step 7 — First deploy

Push to `main` to trigger GitHub Actions, or run manually on the server:

```bash
cd /opt/my-hub && sudo -u deploy docker compose -f infra/docker-compose.yml up -d
```

Traefik will issue Let's Encrypt certificates on the first request to each domain.

---

## Usage (fresh server)

If provisioning a brand-new server from scratch (no import needed):

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars  # fill in secrets
terraform init
terraform plan
terraform apply   # creates server + firewall + DNS (~1 min; cloud-init runs ~2-3 min after)
terraform output
```

Then follow Steps 5–7 above (cloud-init handles Steps 4 automatically).

---

## Connecting from Windows (SSH)

Add to `C:\Users\Alex\.ssh\config`:

```
Host myhub
    HostName <SERVER_IPV4>
    User root
    IdentityFile ~/.ssh/id_ed25519_myhub
    ServerAliveInterval 60
```

Then: `ssh myhub`

---

## Connecting DBeaver to PostgreSQL

PostgreSQL is on Docker's internal network — port 5432 is **never exposed** on the host.
Use DBeaver's built-in SSH tunnel:

1. New Connection → PostgreSQL
2. **Main tab**: Host `localhost` · Port `5432` · DB `myhub` · User `myhub` · Password from `.env`
3. **SSH tab**: Enable tunnel · Host `<SERVER_IPV4>` · Port `22` · User `root` · Auth: Public Key → `~/.ssh/id_ed25519_myhub`
4. Test tunnel → Test Connection

> `AllowTcpForwarding yes` is set in the SSH hardening config, which is what makes this work.

---

## What's gitignored

| File/Dir            | Reason                                                  |
| ------------------- | ------------------------------------------------------- |
| `terraform.tfvars`  | Contains API tokens and SSH keys                        |
| `terraform.tfstate` | Contains resource IDs — store locally, back up manually |
| `.terraform/`       | Provider binaries — auto-downloaded by `terraform init` |

---

## Rebuilding the server

If you ever need to recreate the server:

1. Comment out `lifecycle { prevent_destroy = true }` in `main.tf`
2. Run `terraform destroy -target=hcloud_server.main`
3. Run `terraform apply` to recreate — cloud-init runs automatically on first boot
4. Wait ~3–5 min, then verify with `cloud-init status`
5. Update GitHub Secret `VPS_HOST` if the IPv4 changed
6. Repeat Steps 5–7 from the first-time setup above
