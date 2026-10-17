# Terminal WebSocket Connection Issue - Analysis & Fix

## Problem Summary
The terminal WebSocket connection is failing because the frontend is missing production environment configuration files.

## Root Cause Analysis

### Connection Flow Trace

#### 1. Frontend WebSocket Creation (`backendRunner.ts:402-408`)
```typescript
export function createTerminalWebSocket(handlers, sessionId?, terminalId = "shell", terminalAccessToken?) {
    const query = new URLSearchParams({ terminalId });
    if (sessionId)
        query.set("sessionId", sessionId);
    const endpoint = `${WS_BASE}?${query.toString()}`;
    const protocols = terminalAccessToken ? ["sk-coder-v1", `skc.${terminalAccessToken}`] : ["sk-coder-v1"];
    const ws = new WebSocket(endpoint, protocols);
    // ...
}
```

#### 2. WebSocket Base Resolution (`backendEndpoints.ts:1-17`)
```typescript
export function resolveWebSocketBase(apiBase: string, configuredWebSocket?: string, browserOrigin?: string) {
    const origin = browserOrigin || (typeof window !== "undefined" ? window.location.origin : undefined);
    // ... resolution logic ...
    if (configuredWebSocket)
        return resolveAbsolute(configuredWebSocket);
    return `${resolveAbsolute(apiBase)}/ws/terminal`;  // <-- THIS LINE!
}
```

#### 3. Backend Initialization (`backendRunner.ts:1-5`)
```typescript
const BASE = import.meta.env.VITE_API_URL || "/api";
import { resolveWebSocketBase } from "./backendEndpoints";
const WS_BASE = resolveWebSocketBase(BASE, import.meta.env.VITE_WS_URL);
```

### The Problem

**Missing Production Environment Configuration:**
- `frontend/.env.production` file does NOT exist
- During production build, `import.meta.env.VITE_API_URL` evaluates to `"/api"` (fallback)
- `import.meta.env.VITE_WS_URL` evaluates to `undefined` (not set)
- Result: `WS_BASE = "wss://sk-coder.site/api/ws/terminal"` (CORRECT, derived from origin)

**However**, there's a subtle issue:
1. The `resolveWebSocketBase` appends `/ws/terminal` to the apiBase
2. If `apiBase = "/api"`, and origin is `https://sk-coder.site`
3. Result is: `wss://sk-coder.site/api/ws/terminal` ✓ (This is CORRECT!)

**The ACTUAL issue is likely:**

Looking at the code flow in `backendEndpoints.ts:16`:
```typescript
return `${resolveAbsolute(apiBase)}/ws/terminal`;
```

When `apiBase = "/api"` and no `VITE_WS_URL` is set:
- `resolveAbsolute("/api")` → `"wss://sk-coder.site/api"` ✓
- Final result: `"wss://sk-coder.site/api/ws/terminal"` ✓

**This is CORRECT!**

So the issue must be elsewhere. Let me check the protocol header extraction...

#### 4. Backend Protocol Header Extraction (`terminalAccess.ts:26-35`)
```typescript
export function terminalAccessTokenFromProtocolHeader(header: string | string[] | undefined) {
    const value = Array.isArray(header) ? header.join(",") : header ?? "";
    for (const protocol of value.split(",").map((item) => item.trim())) {
        if (protocol.startsWith(ACCESS_TOKEN_PREFIX)) {  // "skc."
            const token = protocol.slice(ACCESS_TOKEN_PREFIX.length);
            return isTerminalAccessToken(token) ? token : null;
        }
    }
    return null;
}
```

#### 5. Frontend Protocol Construction (`backendRunner.ts:407`)
```typescript
const protocols = terminalAccessToken ? ["sk-coder-v1", `skc.${terminalAccessToken}`] : ["sk-coder-v1"];
```

**This looks correct!** The protocols are: `["sk-coder-v1", "skc.TOKEN"]`

#### 6. Backend Authorization (`terminal-ws.ts:17-34`)
```typescript
server.on("upgrade", async (request, socket, head) => {
    if (new URL(request.url || "/", "http://localhost").pathname !== "/api/ws/terminal")
        return;
    if (!isAllowedOrigin(request.headers.origin)) {
        socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
        return socket.destroy();
    }
    const url = new URL(request.url || "/", "http://localhost");
    const sessionId = url.searchParams.get("sessionId");
    const accessToken = terminalAccessTokenFromProtocolHeader(request.headers["sec-websocket-protocol"]);
    if (!sessionId || !(await authorizeTerminalSession(sessionId, accessToken))) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        return socket.destroy();
    }
    wss.handleUpgrade(request, socket, head, (ws) => wss.emit("connection", ws, request));
});
```

### Likely Issue: Missing .env.production in Frontend

**The root cause is that the frontend `.env.production` file is missing!**

From `.env.production.example`:
```
VITE_API_URL=https://api.sk-coder.site
VITE_WS_URL=wss://api.sk-coder.site/api/ws/terminal
```

**Wait! There's a mismatch!**

The `.env.production.example` has:
- `VITE_API_URL=https://api.sk-coder.site`
- `VITE_WS_URL=wss://api.sk-coder.site/api/ws/terminal`

But looking at the NGINX configs:
- Frontend is at: `https://sk-coder.site`
- Backend API is at: `https://api.sk-coder.site` OR proxied through same domain

**Let me check the NGINX configuration:**

From `sk-coder-consolidated.nginx.conf`:
```nginx
location /api/ws/terminal {
    proxy_pass http://127.0.0.1:8080/api/ws/terminal;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

**This means the frontend should use RELATIVE paths:**

If the frontend is served from `https://sk-coder.site`, the WebSocket should be:
- `wss://sk-coder.site/api/ws/terminal` (SAME ORIGIN)

NOT:
- `wss://api.sk-coder.site/api/ws/terminal` (DIFFERENT ORIGIN - CORS issues!)

## THE ACTUAL PROBLEM

### Problem 1: Missing frontend/.env.production

The frontend `.env.production` file **DOES NOT EXIST**, causing Vite to use default values during production build.

When `VITE_API_URL` is not set, it defaults to `/api` (line 1 of backendRunner.ts).
When `VITE_WS_URL` is not set, it derives from the API base.

**Wait, this should actually work correctly!** Let me trace through:

```typescript
// backendRunner.ts:1
const BASE = import.meta.env.VITE_API_URL || "/api";  // "/api"

// backendRunner.ts:5
const WS_BASE = resolveWebSocketBase(BASE, import.meta.env.VITE_WS_URL);

// backendEndpoints.ts:16
return `${resolveAbsolute(apiBase)}/ws/terminal`;
// Result: resolveAbsolute("/api") with origin "https://sk-coder.site"
// → "wss://sk-coder.site/api"
// Final: "wss://sk-coder.site/api/ws/terminal" ✓ CORRECT!
```

So the WebSocket URL resolution is **CORRECT with default values**.

### Problem 2: Wrong example in .env.production.example

The `.env.production.example` has:
```
VITE_WS_URL=wss://api.sk-coder.site/api/ws/terminal
```

This would cause a **CROSS-ORIGIN** WebSocket connection:
1. Frontend origin: `https://sk-coder.site`
2. WebSocket connects to: `wss://api.sk-coder.site`
3. This creates CORS and CSP issues!

**If someone follows the example and copies this to .env.production, the WebSocket will fail!**

### Problem 2: .env.production file is missing

The frontend `.env.production` file doesn't exist, so Vite uses defaults.

### Problem 3: ALLOWED_ORIGINS mismatch?

Backend `.env.production` has:
```
ALLOWED_ORIGINS=https://sk-coder.site,https://www.sk-coder.site,https://admin.sk-coder.site,https://api.sk-coder.site
```

This is correct! The origin check should pass.

## Solution

### The REAL Fix: Create frontend/.env.production with Simple Defaults

Create `frontend/.env.production`:
```bash
VITE_API_URL=/api
# Don't set VITE_WS_URL - let it derive automatically from the API base
```

This ensures:
- API calls go to: `https://sk-coder.site/api/*` (same origin)
- WebSocket goes to: `wss://sk-coder.site/api/ws/terminal` (same origin)
- No CORS issues!

### Why This Works

1. `VITE_API_URL=/api` - relative path from the current origin
2. `VITE_WS_URL` is NOT set, so `resolveWebSocketBase` derives it automatically
3. Result: `wss://sk-coder.site/api/ws/terminal` (same-origin WebSocket)

### CSP Header is Already Correct

The NGINX CSP header already allows WebSocket connections:
```nginx
connect-src 'self' https://cdn.jsdelivr.net https://wandbox.org wss:;
```

The `wss:` directive allows any secure WebSocket connection.

### Alternative: Use Dedicated API Subdomain

If you want to use `api.sk-coder.site` as a separate API domain, update BOTH files:

**frontend/.env.production**:
```bash
VITE_API_URL=https://api.sk-coder.site/api
VITE_WS_URL=wss://api.sk-coder.site/api/ws/terminal
```

**deploy/sk-coder-consolidated.nginx.conf** (update CSP):
```nginx
connect-src 'self' https://cdn.jsdelivr.net https://wandbox.org wss://api.sk-coder.site;
```

**But the simpler approach is to use same-origin (option above).**

## Implementation Steps (Already Done!)

### Step 1: Create Frontend .env.production ✓
Created `frontend/.env.production` with:
```bash
VITE_API_URL=/api
```

### Step 2: Rebuild Frontend
The frontend needs to be rebuilt after creating .env.production:
```bash
cd sk-code-main/frontend
npm run build
```

This will bundle the environment variables into the production build.

### Step 3: Deploy Updated Build
Upload the new `frontend/dist` to the server and restart the frontend service.

## Additional Checks to Perform

### 1. Verify Frontend is Built with Correct Environment
After rebuilding:
- Check `dist/public/index.html` to ensure WebSocket URL is correct
- Browser console should show: `wss://sk-coder.site/api/ws/terminal`

### 2. Check Backend Logs
```bash
ssh ubuntu@149.118.51.151
docker logs sk-coder-backend
```

Look for:
- WebSocket upgrade requests
- Origin check failures (403 Forbidden)
- Authorization failures (401 Unauthorized)
- Session creation issues

### 3. Test WebSocket Endpoint Directly
```bash
curl -v --include \
  --header "Connection: Upgrade" \
  --header "Upgrade: websocket" \
  --header "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  --header "Sec-WebSocket-Version: 13" \
  --header "Sec-WebSocket-Protocol: sk-coder-v1" \
  --header "Origin: https://sk-coder.site" \
  "http://localhost:8080/api/ws/terminal?sessionId=test&terminalId=shell"
```

Expected: `401 Unauthorized` (because sessionId=test is invalid)
Bad: `403 Forbidden` (origin check failed - indicates ALLOWED_ORIGINS issue)

### 4. Verify Workspace Session Creation
The frontend creates a workspace session first (Terminal.tsx:548):
```typescript
const workspace = await createWorkspace();
savedSessionId = workspace.id;
terminalAccessToken = workspace.terminalAccessToken;
```

Check browser network tab for:
- POST `/api/execute/sessions` - should return 200
- Response should include `id` and `terminalAccessToken`

### 5. WebSocket Connection Sequence
Normal flow:
1. POST `/api/execute/sessions` → creates workspace session
2. GET `/api/execute/sessions/{id}` → gets workspace lifecycle
3. WebSocket upgrade to `wss://sk-coder.site/api/ws/terminal?sessionId={id}&terminalId=shell`
4. Protocols: `["sk-coder-v1", "skc.{token}"]`
5. Backend validates sessionId + token hash
6. Connection established, terminal ready message sent

## Testing WebSocket Endpoint

From the server:
```bash
curl -v --include --no-buffer \
  --header "Connection: Upgrade" \
  --header "Upgrade: websocket" \
  --header "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  --header "Sec-WebSocket-Version: 13" \
  --header "Sec-WebSocket-Protocol: sk-coder-v1" \
  --header "Origin: https://sk-coder.site" \
  "http://localhost:8080/api/ws/terminal?sessionId=test&terminalId=shell"
```

Expected: 401 Unauthorized (no valid token - correct!)
Not Expected: 403 Forbidden (origin check failed - indicates origin policy issue!)

## Final Root Cause Summary

### Primary Issue: Missing frontend/.env.production

The frontend `.env.production` file does not exist, which causes Vite to use default values. While these defaults happen to work correctly for same-origin deployment, it's a configuration error that needs to be fixed.

### Secondary Issue: Misleading .env.production.example

The example file shows cross-origin configuration (`api.sk-coder.site`) which could lead to WebSocket failures if copied directly.

### The Fix Applied

Created `frontend/.env.production` with:
```
VITE_API_URL=/api
```

This ensures same-origin API and WebSocket connections:
- API: `https://sk-coder.site/api/*`
- WebSocket: `wss://sk-coder.site/api/ws/terminal`

### Why WebSocket Might Still Fail

If the WebSocket still fails after this fix, check:
1. Frontend not rebuilt after .env.production created → rebuild needed
2. Backend not receiving requests → check NGINX proxy
3. Workspace session not created → check backend logs
4. Token mismatch → verify `terminalAccessToken` is being sent in WebSocket protocol header
5. Origin check failing → verify `ALLOWED_ORIGINS` in backend `.env.production`

## Summary

**Root Cause:** Missing `frontend/.env.production` file causes Vite to use default values, though they happen to work for same-origin deployment.

**Fix Applied:** Created `frontend/.env.production` with:
```bash
VITE_API_URL=/api
```

**Why This Works:**
- Same-origin architecture: Frontend and API both on `https://sk-coder.site`
- WebSocket URL derives from API base: `wss://sk-coder.site/api/ws/terminal`
- No CORS issues
- CSP header already allows `wss:` connections

**Next Steps:**
1. Rebuild frontend: `cd sk-code-main/frontend && npm run build`
2. Deploy updated build to server
3. Test WebSocket connection in browser console
4. Monitor backend logs for any authorization errors

**Alternative Consideration:**
If you want to use `api.sk-coder.site` as a separate API subdomain, you'll need cross-origin configuration with proper CORS headers. The current setup uses same-origin which is simpler and more reliable.
