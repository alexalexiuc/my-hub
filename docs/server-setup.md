# Hetzner Cloud VM — Server Setup Guide

This guide walks you through provisioning and hardening a Hetzner Cloud VM so
that the GitHub Actions deployment pipeline works and the server is properly
secured.

---

## 1. Create the VM on Hetzner Cloud

1. Log in to [console.hetzner.cloud](https://console.hetzner.cloud).
2. Create a new **Project** (e.g. `my-hub`).
3. Click **Add Server** and choose:
   - **Location** — any EU region close to you (e.g. Nuremberg `nbg1`)
   - **Image** — `Ubuntu 24.04 LTS`
   - **Type** — `CX32` (4 vCPU / 8 GB RAM) is the recommended tier; `CX22`
     works if budget is tight
   - **SSH Key** — paste your **personal** public key (the one you use from
     your workstation) — Hetzner will inject it for the `root` user
   - **Firewall** — create and attach a new firewall (see §3 below)
   - **Hostname** — e.g. `my-hub-prod`
4. Note the **public IPv4** address assigned to the server.

---

## 2. Initial SSH login and system update

```bash
ssh root@<SERVER_IP>
apt update && apt upgrade -y
```

---

## 3. Firewall rules

Configure the firewall at **both** the Hetzner Cloud level (network firewall)
and inside the VM with UFW (host firewall). Using both provides defence in
depth.

### 3a. Hetzner Cloud Firewall

In the Hetzner console → **Firewalls** → create a firewall with these **inbound** rules:

| Protocol | Port(s)  | Source        | Purpose               |
|----------|----------|---------------|-----------------------|
| TCP      | 22       | `0.0.0.0/0`  | SSH                   |
| TCP      | 80       | `0.0.0.0/0`  | HTTP (redirected to HTTPS by Traefik) |
| TCP      | 443      | `0.0.0.0/0`  | HTTPS                 |

> **Note on SSH exposure:** GitHub Actions runners use dynamically allocated
> IPs from a large pool, so restricting port 22 to a fixed range is not
> practical for automated deployments.  The key-only auth configured in §4
> and fail2ban (recommended below) mitigate brute-force risk.

Block **all other inbound ports** (including 5432 — PostgreSQL must never be
reachable from outside the Docker network).

Attach the firewall to the server you just created.

### 3b. UFW (host firewall)

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw --force enable
ufw status verbose
```

---

## 4. Harden SSH (key-only access, no passwords)

```bash
# Edit /etc/ssh/sshd_config
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config

systemctl restart ssh
```

Install **fail2ban** to automatically ban IPs that repeatedly fail SSH login:

```bash
apt install -y fail2ban
systemctl enable --now fail2ban
```

> **Tip:** keep your current SSH session open while you test a second
> connection from a new terminal to confirm you can still log in before
> closing the first.

---

## 5. Create a dedicated deploy user

Running the stack as `root` is not recommended. Create a dedicated user that
the GitHub Actions runner will SSH into:

```bash
adduser --disabled-password --gecos "" deploy
# Add to the docker group so it can run docker commands
usermod -aG docker deploy
```

Generate a **dedicated CI SSH key pair** (do not reuse your personal key):

```bash
# Run this on your local machine, NOT on the server
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/my-hub-deploy -N ""
# This creates:
#   ~/.ssh/my-hub-deploy      (private key  → VPS_SSH_KEY secret in GitHub)
#   ~/.ssh/my-hub-deploy.pub  (public key   → goes into authorized_keys below)
```

Add the public key to the `deploy` user's `authorized_keys`:

```bash
mkdir -p /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
# Paste the contents of ~/.ssh/my-hub-deploy.pub (the PUBLIC key)
echo "ssh-ed25519 AAAA... github-actions-deploy" >> /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh
```

---

## 6. Install Docker

```bash
# Install Docker Engine via the official convenience script
# (suitable for personal/hobby servers; for production hardening see
# https://docs.docker.com/engine/install/ubuntu/ for the apt repository method)
curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
# Optionally inspect the script before running:
#   less /tmp/get-docker.sh
sh /tmp/get-docker.sh

# Start and enable Docker
systemctl enable --now docker

# Verify
docker version
```

Docker Compose v2 is bundled with Docker Engine as the `docker compose`
subcommand — no separate installation needed.

---

## 7. Clone the repository

The deploy workflow SSHs in and runs `git pull origin main` inside
`/opt/my-hub`, so the repo must already exist there before the first
automated deploy.

```bash
# As root or a user with sudo
mkdir -p /opt/my-hub
git clone https://github.com/alexalexiuc/my-hub.git /opt/my-hub
chown -R deploy:deploy /opt/my-hub
```

If the repository is **private**, either:

- Use a [GitHub Deploy Key](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/managing-deploy-keys#deploy-keys)
  added to the repo and stored in `/home/deploy/.ssh/`, or
- Pass a `GITHUB_TOKEN` / fine-grained PAT via `git credential store`
  (less preferred).

---

## 8. Authenticate with GitHub Container Registry (GHCR)

The deploy workflow runs `docker compose pull` which fetches pre-built images
from GHCR (`ghcr.io/alexalexiuc/...`).

Create a **[Personal Access Token (classic)](https://github.com/settings/tokens)**
with the `read:packages` scope, then log in as the `deploy` user:

```bash
su - deploy
echo "<YOUR_GHCR_TOKEN>" | docker login ghcr.io -u alexalexiuc --password-stdin
```

Docker saves credentials in `~/.docker/config.json`.  They persist across
reboots and will be used by every `docker compose pull` invocation.

---

## 9. Create the `.env` file

The Docker Compose stack reads secrets from `/opt/my-hub/.env`.  This file is
gitignored and must be created manually on the server.

```bash
su - deploy
cp /opt/my-hub/.env.example /opt/my-hub/.env
nano /opt/my-hub/.env   # or your editor of choice
```

Fill in every variable:

| Variable                | Notes                                              |
|-------------------------|----------------------------------------------------|
| `POSTGRES_PASSWORD`     | Strong random password, e.g. `openssl rand -hex 32` |
| `NEXTAUTH_SECRET`       | 32-byte random string: `openssl rand -base64 32`   |
| `GITHUB_CLIENT_ID`      | From your GitHub OAuth App                        |
| `GITHUB_CLIENT_SECRET`  | From your GitHub OAuth App                        |
| `NEXTAUTH_URL`          | `https://admin.alexiuc.dev`                       |
| `ALLOWED_GITHUB_USERS`  | Your GitHub username(s), comma-separated           |

---

## 10. Prepare the Traefik ACME directory

Traefik stores Let's Encrypt certificates in a volume mapped to
`/etc/traefik/acme/acme.json` inside the container.  The Docker volume handles
this automatically, but the file **permissions must be 600** or Traefik will
refuse to write to it.

The `traefik_acme` named volume is created automatically by Docker Compose on
first run.  If you ever need to pre-create it manually:

```bash
# Only needed if you mount a host directory instead of a named volume
# The named volume approach in docker-compose.yml does not require this
mkdir -p /opt/my-hub/infra/traefik/acme
touch /opt/my-hub/infra/traefik/acme/acme.json
chmod 600 /opt/my-hub/infra/traefik/acme/acme.json
```

---

## 11. DNS records

Point the following DNS A records at your server's public IP in Cloudflare
(or wherever your domain is managed):

| Record              | Type | Value          |
|---------------------|------|----------------|
| `admin.alexiuc.dev` | A    | `<SERVER_IP>`  |
| `mcp.alexiuc.dev`   | A    | `<SERVER_IP>`  |

Set the Cloudflare proxy status to **DNS only** (grey cloud) while you first
bring the stack up.  Traefik handles TLS directly; Cloudflare proxying can be
re-enabled later if desired.

---

## 12. First deploy (manual)

```bash
su - deploy
cd /opt/my-hub
docker compose -f infra/docker-compose.yml pull
docker compose -f infra/docker-compose.yml up -d
docker compose -f infra/docker-compose.yml ps
```

Check logs if any container fails to start:

```bash
docker compose -f infra/docker-compose.yml logs --tail=50 <service>
```

---

## 13. Configure GitHub Actions secrets

Open **Settings → Secrets and variables → Actions** in the
`alexalexiuc/my-hub` repository and add the following **repository secrets**:

| Secret name     | Value                                                   |
|-----------------|---------------------------------------------------------|
| `VPS_HOST`      | Public IPv4 address of the server                      |
| `VPS_USER`      | `deploy` (or whichever user you created in §5)         |
| `VPS_SSH_KEY`   | Contents of the **private** key `~/.ssh/my-hub-deploy` (generated in §5). Paste the full key including `-----BEGIN...` / `-----END...` lines and preserve newlines. |

The deploy workflow also uses the built-in `GITHUB_TOKEN` secret
(auto-provided by GitHub) to log in to GHCR and push/pull images — no
additional setup needed.

The `deploy` job is scoped to the `production` **environment** in the workflow.
You can optionally create that environment in
**Settings → Environments → New environment → production** and require manual
approval before production deploys.

---

## 14. Verify automated deployment

Push a commit to `main`.  The `Deploy` workflow will:

1. Build and push images to GHCR.
2. SSH into the server as `deploy`.
3. Run `git pull origin main` → `docker compose pull` → `docker compose up -d`.

Watch the Actions tab to confirm all steps pass.

---

## Security checklist

- [x] SSH password authentication disabled
- [x] Root login restricted to key-only (`prohibit-password`)
- [x] fail2ban installed to block repeated SSH login failures
- [x] Hetzner Cloud Firewall allows only ports 22, 80, 443
- [x] UFW mirrors those rules inside the VM
- [x] PostgreSQL bound only to the internal Docker network (never exposed on host)
- [x] All traffic served over HTTPS — Traefik redirects HTTP → HTTPS
- [x] Let's Encrypt TLS via Traefik ACME (auto-renewed)
- [x] TLS 1.2+ enforced, modern cipher suites only (see `infra/traefik/dynamic/security.yml`)
- [x] Security headers set: HSTS (2 years), X-Frame-Options DENY, nosniff, XSS filter, CSP
- [x] Rate limiting middleware configured in Traefik
- [x] Docker images pulled from GHCR, not built on the server
- [x] `.env` file gitignored; secrets never committed to source control
- [x] Deploy user has minimal privileges (no sudo, only `docker` group membership)
