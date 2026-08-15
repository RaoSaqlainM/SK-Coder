# Deploy SK Coder on Oracle Free Tier

This guide deploys the SK Coder frontend, API, Docker-isolated terminal service, and persistent workspace volume on one Oracle Linux or Ubuntu instance. The frontend and API are served from the same domain, so the application can retain its default `/api` backend setting. A custom backend origin is only needed when the API is intentionally hosted on another origin.

> The terminal service requires Docker on the Oracle host. It is not designed to run directly on the VM host process.

## 1. Prepare the server

Install Docker Engine, Docker Compose, Git, Node.js 22, and pnpm 9 on the Oracle instance. Configure the Oracle security list or network security group to permit TCP 80 and 443. Keep Docker’s API socket private to the host.

| Item | Recommended value | Purpose |
|---|---:|---|
| Workspace host path | `/srv/sk-coder/workspaces` | Persistent Docker-backed user workspaces |
| Global workspace capacity | `107374182400` bytes | 100 GB server-volume admission ceiling |
| Per-session capacity | `536870912` bytes | 512 MB storage ceiling per isolated session |
| Session expiry | `72` hours | Automatic cleanup of inactive workspaces |
| API bind address | `127.0.0.1:3000` | Keeps the terminal API behind the frontend proxy |
| Frontend bind address | `127.0.0.1:8080` | Lets the host reverse proxy terminate TLS |

```bash
sudo mkdir -p /srv/sk-coder/workspaces
sudo chown -R 1000:1000 /srv/sk-coder/workspaces
sudo chmod 700 /srv/sk-coder/workspaces
git clone https://github.com/RaoSaqlainM/SK-Coder.git /opt/sk-coder
cd /opt/sk-coder
cp .env.example .env
```

Edit `.env` and replace `https://your-domain.example` with the public HTTPS origin. Leave `SK_CODER_WORKSPACE_HOST_PATH` at `/srv/sk-coder/workspaces` unless a different attached data volume is mounted there.

## 2. Build the application and isolated runtime

The execution image includes Node.js 22, pnpm, Python 3 with pip, OpenJDK 21, Bash, Git, GCC/G++, Go, Rust, and Make. Build it before starting the backend, because the backend creates isolated containers from the `sk-coder-runtime:latest` image.

```bash
cd /opt/sk-coder
corepack enable
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm run build
docker build -t sk-coder-runtime:latest ./runtime
docker compose up -d --build
docker compose ps
```

Validate the services locally before exposing the site.

```bash
curl -sS http://127.0.0.1:3000/api/healthz
curl -sS http://127.0.0.1:8080/ | head
docker compose logs --tail=100 backend
```

The health response must be JSON with `{"status":"ok"}`. If it is not, do not point the public reverse proxy at the deployment.

## 3. Connect the custom domain and TLS

Create an A record for the chosen hostname that points to the Oracle instance public IP. Use a host-level reverse proxy such as Nginx or Caddy to terminate TLS and proxy all traffic to the Docker frontend at `127.0.0.1:8080`.

For Nginx, create a host configuration similar to the following after the certificate has been issued. Replace `ide.example.com` with the actual hostname.

```nginx
server {
  listen 80;
  server_name ide.example.com;
  return 301 https://$host$request_uri;
}

server {
  listen 443 ssl http2;
  server_name ide.example.com;
  ssl_certificate /etc/letsencrypt/live/ide.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/ide.example.com/privkey.pem;

  location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

The containerized frontend already proxies `/api/` and the terminal WebSocket to the backend service. The host reverse proxy therefore needs only to forward the public site to port 8080, including WebSocket upgrade headers when required by the installed Nginx version.

## 4. Configure SK Coder after deployment

Open the site through the custom HTTPS domain. In **Settings → Runtime**, keep **Use execution backend** enabled. Leave **Backend origin** empty when the frontend and API share the deployment domain. If a separate API origin is used, set its HTTPS origin without a trailing `/api`; SK Coder appends `/api` automatically.

| Runtime mode | Backend origin | Result |
|---|---|---|
| Standard Oracle deployment | Blank | Uses same-origin `/api` through Nginx |
| Separate Oracle API hostname | `https://api.example.com` | Uses `https://api.example.com/api` |
| Public fallback only | Disable the execution backend | Uses Piston/Wandbox and Pyodide where available |

The SK-Shell first synchronizes browser workspace files into the isolated session, then runs the requested command inside the session container. If the backend is unavailable, language execution transparently uses the available public fallback path instead of a simulated browser runtime.

## 5. Verify end-to-end execution

Create `hello.js` in the Explorer with the following content, then run `node hello.js` in SK-Shell.

```javascript
console.log("oracle-session-ok")
```

Repeat the check with Python and Java. Confirm that the terminal shows the isolated-workspace connection message, returns the expected output, and shows an exit status. Then use **SK-AI** to request a file write and verify that its **Approve** action is required before the file appears in the Explorer.

## 6. Operate safely

The deployment holds workspace files in `/srv/sk-coder/workspaces` and deletes sessions that have been inactive for 72 hours. New sessions are rejected when the global workspace area reaches 100 GB. The browser workspace remains local to the browser; when the server cannot accept a workspace, users can still retain files locally and use public single-file execution fallbacks.

Review disk usage and active Docker resources regularly.

```bash
sudo du -sh /srv/sk-coder/workspaces
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Size}}'
docker image ls sk-coder-runtime
docker compose logs --tail=200 backend
```

Do not publish the Docker socket, port 3000, `.env`, or the workspace host directory. Back up the application repository and configuration separately from expiring user workspaces.

## 7. Update and rollback

Pull a tested commit, rebuild the frontend and runtime, then restart the Compose services.

```bash
cd /opt/sk-coder
git pull --ff-only origin main
pnpm install --frozen-lockfile
pnpm run build
docker build -t sk-coder-runtime:latest ./runtime
docker compose up -d --build
```

If a release fails validation, restore the prior Git commit, rebuild the frontend and runtime, and restart the same Compose stack. Do not delete `/srv/sk-coder/workspaces` during a rollback unless intentionally clearing all active user sessions.
