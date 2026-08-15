# SK Coder

SK Coder is a **browser-first, mobile-first web IDE**. Phase 1 focuses on project editing, ZIP and folder import, local workspace persistence, HTML preview, browser-backed Python, Wandbox-first Node.js, Bash execution, a virtual workspace terminal, optional GitHub workflows, and an Oracle-ready backend for temporary storage and server workloads.

The project is designed around a local-first model. A workspace is saved in browser IndexedDB before any optional backend snapshot attempt, so the core editor and virtual filesystem remain useful during backend outages.

## Phase 1 capabilities

| Area | Included in Phase 1 |
|---|---|
| Workspace | Create, rename, move, delete, import, merge, replace, export, drag-and-drop, and binary asset preservation |
| Persistence | Local IndexedDB save and restore; optional temporary backend snapshot |
| Preview | HTML/CSS/JS preview, imported asset inlining, preview runtime error forwarding |
| Terminal | Shell, Python, Node, and Bash tabs; user-added terminal sessions can be closed |
| Browser filesystem | `ls`, `cd`, `pwd`, `mkdir`, `rm`, `cat`, `cp`, `mv`, `echo`, `grep`, and `find` |
| Execution | Pyodide Python, Wandbox-first Node.js with browser fallback, cloud Bash, optional Oracle runtime |
| GitHub | Existing device flow, Codespaces readiness state, repository staging, commit/push, and pull |
| Mobile | Responsive layout, visible Explorer actions, and touch-oriented navigation |

Compiled-language runners for C/C++, Java, Go, Rust, PHP, and similar toolchains are intentionally deferred to Phase 2. The UI explains this instead of exposing a nonfunctional terminal tab.

## Local development

```bash
npm install
npm run dev
```

The application runs through Vite. The standard scripts are:

```bash
npm run lint
npm test -- --run
npx tsc -b --noEmit
npm run build
```

The project uses React, TypeScript, Vite, Tailwind CSS, Zustand, Monaco, xterm, JSZip, Pyodide, and Vitest. The production build is configured with manual chunks for Monaco, React, and Babel.

## Workspace persistence and retention

SK Coder saves the active file tree to IndexedDB under the browser’s site storage. Importing a project preserves text files and binary files such as PNG images. The preview builder can inline known binary assets referenced by an HTML entry file.

When a compatible backend is configured, the client saves locally first and can upload a temporary serialized workspace snapshot. Backend defaults are:

| Setting | Default |
|---|---:|
| Temporary server storage capacity target | 140 GB |
| Offload threshold | 100 GB |
| Temporary snapshot retention | Up to 72 hours |
| Per-upload cap | 100 MB |

When the server reaches the offload threshold or becomes unavailable, the client retains the workspace in IndexedDB instead of treating server storage as guaranteed. This is a temporary convenience path, not backup storage. Export projects or use a private Git repository for durable recovery.

## Execution model

The IDE uses execution tiers appropriate to each feature.

1. **Browser:** HTML preview, local virtual filesystem operations, Pyodide Python, and compatible JavaScript fallback.
2. **Wandbox:** primary route for standalone Node.js work.
3. **Cloud Bash:** Bash script execution where configured.
4. **Oracle backend:** optional Docker-isolated project workloads and temporary workspace storage on a deployment you control.

The browser terminal does not run arbitrary host shell commands. Its filesystem commands mutate the Zustand workspace state, which also updates Explorer and IndexedDB persistence. That separation avoids confusing a browser workspace with a user’s actual operating-system filesystem.

## GitHub and Codespaces

The Cloud Shell view uses GitHub device authorization through `VITE_GITHUB_CLIENT_ID`. The Git workspace panel uses the locally stored token to stage selected workspace files, create Git blobs and a commit through the GitHub API, update the selected branch, and pull a branch tree into the active workspace.

Set the GitHub OAuth client ID in the deployment environment:

```bash
VITE_GITHUB_CLIENT_ID=your_github_oauth_client_id
```

Codespaces are listed and started inside the panel. When a Codespace becomes ready, SK Coder shows an in-app readiness state and connection URL. It does not automatically open a Codespaces terminal in a new tab.

## Optional backend

The backend lives in `backend/` and is intended for an Oracle Free Tier deployment where Docker is available. It provides health, execution, temporary storage, storage status, and WebSocket terminal endpoints.

```bash
cd backend
npm install
npm test
npm start
```

Review `.env.example`, `docker-compose.yml`, `nginx.conf`, and `DEPLOY_ORACLE.md` before production deployment. Docker is required for isolated backend execution and is not expected to run in every local development environment.

## Production deployment

1. Provision an Oracle Free Tier instance and install Docker Engine, Docker Compose, Nginx, and a TLS certificate tool.
2. Configure the backend environment variables, allowed origins, cleanup authorization, and storage directory permissions.
3. Build the frontend with `npm run build`.
4. Deploy the backend with the included Compose configuration and route the public domain through Nginx.
5. Set `VITE_API_URL`, `VITE_WS_URL`, and `VITE_GITHUB_CLIENT_ID` in the frontend deployment environment.
6. Verify `/api/health`, `/api/storage/status`, execution failure behavior when Docker is unavailable, temporary storage cleanup, and WebSocket origin rules.

See `DEPLOY_ORACLE.md` for the deployment sequence and `QA_LOG.md` for validation evidence.

## Security and privacy

SK Coder does not require a Phase 1 account. Optional AI keys and GitHub tokens are held in browser storage and are used only for the actions a user initiates. Code sent to AI providers, execution runners, GitHub, or a configured backend is subject to the respective provider’s policies.

Do not place production secrets, customer data, private keys, or regulated data in an untrusted runner, prompt, public repository, or shared browser profile. Use the [Privacy Policy](./src/pages/Privacy.tsx) and [Terms of Service](./src/pages/Terms.tsx) as the product’s user-facing legal pages, and keep store data-safety disclosures aligned with the actual build configuration.

## Quality checks

The test suite covers workspace path changes, preview refresh, Wandbox routing, binary import and preview handling, browser workspace commands, and GitHub tree transforms. Before release, run lint, tests, strict TypeScript, and a production build. Test the browser UI at 375 px, 768 px, and desktop widths, and test the backend separately on an Oracle host with Docker.

## License and contributions

Review the repository’s license status before reuse or redistribution. Contributions should include focused tests where behavior changes, preserve the approved VS Code-style dark layout, avoid embedding credentials, and keep user-facing documentation current.
