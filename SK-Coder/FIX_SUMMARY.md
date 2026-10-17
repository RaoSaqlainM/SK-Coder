# Terminal WebSocket Connection - Quick Fix Summary

## Root Cause
Missing `frontend/.env.production` file causes WebSocket connection configuration issues.

## Fix Applied
Created `sk-code-main/frontend/.env.production` with:
```bash
VITE_API_URL=/api
```

## What This Fixes
1. **WebSocket URL**: Correctly resolves to `wss://sk-coder.site/api/ws/terminal` (same-origin)
2. **API URL**: Uses `/api` for same-origin API requests
3. **No CORS issues**: Everything serves from `https://sk-coder.site`

## Next Steps Required

### 1. Rebuild Frontend
```bash
cd sk-code-main/frontend
npm run build
```

### 2. Deploy to Server
Upload the rebuilt `frontend/dist` directory to the server.

### 3. Test Connection
Open browser console and verify WebSocket connects to:
- `wss://sk-coder.site/api/ws/terminal?sessionId={id}&terminalId=shell`

### 4. Monitor Backend Logs
```bash
ssh ubuntu@149.118.51.151
docker logs -f sk-coder-backend
```

Look for:
- `[INFO] WebSocket upgrade request received`
- `[INFO] Session created: {id}`
- Any 401/403 errors

## Connection Flow
```
Frontend (https://sk-coder.site)
  ↓
1. POST /api/execute/sessions → Creates workspace
  Returns: { id, terminalAccessToken }
  ↓
2. WebSocket: wss://sk-coder.site/api/ws/terminal?sessionId={id}&terminalId=shell
  Headers: Sec-WebSocket-Protocol: sk-coder-v1, skc.{token}
  ↓
3. Backend validates:
  - sessionId exists
  - token hash matches
  - origin is allowed (https://sk-coder.site)
  ↓
4. Connection established
```

## If Still Failing

Check these common issues:

1. **403 Forbidden** → Origin check failing
   - Verify `ALLOWED_ORIGINS=https://sk-coder.site` in backend `.env.production`
   - Check NGINX is passing `Origin` header correctly

2. **401 Unauthorized** → Session/token mismatch
   - Verify workspace session was created (step 1)
   - Check `terminalAccessToken` is being sent in WebSocket protocol header

3. **Connection timeout** → NGINX WebSocket proxy issue
   - Check NGINX error logs: `tail -f /var/log/nginx/error.log`
   - Verify WebSocket upgrade headers are being passed

4. **Session not created** → Backend error
   - Check backend logs for POST `/api/execute/sessions` errors
   - Verify Docker runtime is running

## Files Modified
- ✅ `sk-code-main/frontend/.env.production` (created)
- 📝 `SK-Coder/WEBSOCKET_FIX_ANALYSIS.md` (detailed analysis)
