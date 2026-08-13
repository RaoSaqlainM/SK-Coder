# SK Coder Oracle and Vercel Deployment Guide

This deployment separates the static IDE frontend from the isolated execution service. Deploy the Vite frontend to Vercel at `app.example.com` and the Docker-backed backend to an Oracle Cloud Ubuntu instance at `api.example.com`. Replace both example hostnames before deployment.

> The backend is deliberately placed on the Oracle instance because its execution isolation requires Docker and local operating-system control. The frontend remains a static Vite deployment.

## Deployment topology

| Component | Destination | Public address | Responsibility |
|---|---|---|---|
| React and Vite frontend | Vercel | `https://app.example.com` | Editor, browser execution, UI, IndexedDB fallback |
| Isolated execution backend | Oracle Cloud Ubuntu | `https://api.example.com` | Docker-sandboxed commands, temporary storage, WebSocket terminal |
| Nginx | Oracle Cloud Ubuntu | `https://api.example.com` | TLS termination and reverse proxy |
| Workspace storage | Oracle volume | Private host path | 140 GB capacity, 100 GB offload threshold, 72-hour expiry |

## 1. Create and secure the Oracle instance

Create an Ubuntu compute instance in Oracle Cloud with a public IPv4 address and SSH key. Connect over SSH as documented by Oracle. Create an NSG for the instance and allow inbound TCP `22` only from the administrator’s fixed IP range, plus TCP `80` and `443` from the internet. Do not expose port `8787`: the compose configuration binds it to `127.0.0.1` and Nginx is its only public entry point.

Oracle recommends network security groups for component-specific security postures and requires that instance firewall rules align with the OCI rules. [1]

```bash
ssh ubuntu@YOUR_ORACLE_PUBLIC_IP
sudo apt-get update
sudo apt-get install -y ca-certificates curl git nginx certbot python3-certbot-nginx ufw
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu
sudo systemctl enable --now docker nginx
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

Sign out and reconnect after adding the Docker group.

## 2. Configure the API service

```bash
sudo mkdir -p /opt/sk-coder/data/storage /opt/sk-coder/data/tmp
sudo chown -R ubuntu:ubuntu /opt/sk-coder
cd /opt/sk-coder
git clone https://github.com/RaoSaqlainM/SK-Coder.git .
cat > .env <<'EOF'
CORS_ORIGINS=https://app.example.com
ADMIN_TOKEN=REPLACE_WITH_A_LONG_RANDOM_VALUE
SK_CODER_HOST_DATA_DIR=/opt/sk-coder/data
EOF
openssl rand -hex 32
docker compose up -d --build
docker compose ps
curl http://127.0.0.1:8787/api/health
```

Put the generated `openssl` value into `ADMIN_TOKEN`, then restrict the `.env` file with `chmod 600 .env`. The compose service mounts the Docker socket so it can create restricted child containers. This is a privileged host capability: keep the backend private behind Nginx, restrict SSH access, do not give untrusted users shell access to the Oracle instance, and keep the project repository write-restricted.

The backend removes expired uploads hourly and on startup. The `DELETE /api/storage/cleanup` endpoint is reserved for an administrator request with `X-Admin-Token`.

## 3. Connect the custom API domain and issue TLS

At the DNS provider, create an `A` record for `api.example.com` pointing to the Oracle instance public IPv4 address. Wait until DNS resolves, then install the supplied Nginx configuration and request a certificate.

```bash
sudo cp nginx.conf /etc/nginx/sites-available/sk-coder-api
sudo sed -i 's/api.example.com/api.YOUR_DOMAIN/g' /etc/nginx/sites-available/sk-coder-api
sudo ln -s /etc/nginx/sites-available/sk-coder-api /etc/nginx/sites-enabled/sk-coder-api
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d api.YOUR_DOMAIN
sudo systemctl enable --now certbot.timer
```

## 4. Deploy the static frontend to Vercel

Import `RaoSaqlainM/SK-Coder` into Vercel as a Vite project. Set the production build command to `npm run build` and the output directory to `dist`. Add these production environment variables in the Vercel dashboard:

| Variable | Production value |
|---|---|
| `VITE_API_URL` | `https://api.YOUR_DOMAIN` |
| `VITE_WS_URL` | `wss://api.YOUR_DOMAIN/api/ws/terminal` |
| `VITE_GITHUB_CLIENT_ID` | OAuth application client ID, if GitHub Device Flow is enabled |

Add `app.YOUR_DOMAIN` in Vercel’s domain settings and create the DNS records Vercel presents. The included `vercel.json` supplies the SPA fallback rewrite required for direct navigation to frontend routes. Vercel documents the `VITE_` prefix for build-time variables and its SPA fallback pattern. [2]

## 5. Connect SK Coder to the backend

Open **Settings → Storage** in SK Coder. Keep **Use Temporary Cloud Storage** enabled and set the backend URL to `https://api.YOUR_DOMAIN`. Imported workspaces are uploaded to temporary server storage while current use is below 100 GB. At or above that threshold, the browser saves the latest workspace snapshot to IndexedDB. Server copies expire after 72 hours.

## 6. Production verification and operations

```bash
curl -fsS https://api.YOUR_DOMAIN/api/health
curl -fsS https://api.YOUR_DOMAIN/api/exec/runtimes
docker compose logs --tail=100 backend
docker compose pull
docker compose up -d --build
```

Confirm HTTPS for both custom domains, run an HTML preview, a Python browser execution, a Node.js Wandbox execution, a Java Wandbox execution, and an Oracle terminal command. Review Docker image updates and Ubuntu security updates regularly.

## References

[1] [Oracle Cloud Infrastructure: Security Rules](https://docs.oracle.com/en-us/iaas/Content/Network/Concepts/securityrules.htm)

[2] [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite)

[3] [Vercel Rewrites](https://vercel.com/docs/routing/rewrites)
