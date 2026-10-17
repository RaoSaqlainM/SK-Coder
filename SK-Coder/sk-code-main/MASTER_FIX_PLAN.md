# SK-Coder Ultimate Fix Plan

## Current Status (After WebSocket Fix)

✅ **WORKING:**
- Authentication: Login with Admin-SK/@King4444 works
- Login redirect: Goes to `/` (Index page) instead of `/admin` 
- WebSocket endpoint: Configured correctly at `/api/ws/terminal`
- Health check: `/api/healthz` returns `{"status":"ok"}`
- Containers: All running (backend, frontend, runtime, runtime-gui, runtime-apk)
- Frontend build: Successful with all assets

❌ **NOT WORKING:**

### 1. Terminal Reconnection Loop
**Symptom:** Terminal shows "Reconnecting to your workspace… WebSocket connection failed" repeatedly

**Root Cause:** Terminal needs a workspace session to connect, but session creation might be failing

**What needs verification:**
- Is workspace session being created successfully?
- Is terminalAccessToken being sent correctly?
- Are there network/permission issues?

**Fix Needed:**
- Check Terminal.tsx session creation flow
- Verify workspace backend logs
- Check if runtime containers can start
- Verify Docker network permissions

### 2. Code Runner Execution Failure  
**Symptom:** Cannot run simple files

**Root Cause:** To be determined

**Files to check:**
- `frontend/src/lib/executorChain.ts`
- `frontend/src/lib/backendRunner.ts`
- `backend/src/routes/execute.ts`
- Runtime container logs

**Potential issues:**
- Runtime containers not starting properly
- Executor chain not falling back correctly
- Language detection failing
- File staging not working

### 3. APK Metadata and Signing
**Symptom:** APK editor fails to fetch metadata and sign

**Root Cause:** To be determined

**Files to check:**
- `frontend/src/components/ide/ApkEditor.tsx`
- `backend/src/routes/apk.ts`
- `backend/src/lib/apkJobManager.ts`
- Runtime-APK container permissions

**Potential issues:**
- apktool not working correctly
- apksigner missing or misconfigured
- APK upload/fetch failing
- Metadata parsing broken

### 4. MCP Option
**Note:** User mentioned MCP option but it's not visible in SettingsPanel.tsx

**Action needed:**
- Confirm what "MCP" refers to
- Check AI settings for any MCP references
- May be referring to Model Context Protocol integration

---

## Fix Priority Order

### Priority 1: Terminal Stability (CRITICAL)
Without terminal, users cannot interact with the workspace. This makes the app unusable.

### Priority 2: Code Runner (CRITICAL)
Without code execution, the app cannot run code - core functionality broken.

### Priority 3: APK Editor (IMPORTANT)
APK editing and signing is a key feature that users expect to work.

### Priority 4: UI/UX Polish (NICE TO HAVE)
General polish, error messages, loading states.

---

## Investigation Steps

### Step 1: Terminal Diagnostics

```bash
# Check backend logs for terminal WebSocket issues
ssh ubuntu@149.118.51.151 "sudo docker logs sk-code-main-backend-1 | grep -i 'websocket\|terminal\|session'"

# Check if runtime containers can start
ssh ubuntu@149.118.51.151 "sudo docker ps | grep runtime"

# Test session creation
curl -X POST https://sk-coder.site/api/execute/sessions \
  -H "Content-Type: application/json" \
  -d '{"language":"python"}'
```

### Step 2: Code Runner Diagnostics

```bash
# Test code execution endpoint
curl -X POST https://sk-coder.site/api/execute/python \
  -H "Content-Type: application/json" \
  -d '{"code":"print(\"Hello World\")"}'

# Check runtime container status
ssh ubuntu@149.118.51.151 "sudo docker logs skcoder-runtime-xxx | tail -20"
```

### Step 3: APK Editor Diagnostics

```bash
# Test APK endpoint
curl -X GET https://sk-coder.site/api/apk/status

# Check APK runtime
ssh ubuntu@149.118.51.151 "sudo docker exec sk-coder-apk:oracle-arm64 apktool --version"
```

---

## Build Strategy

Given the large scope of issues:

1. **Create diagnostic script** to test all endpoints
2. **Run diagnostics** to identify exact failures
3. **Fix issues one by one** starting with terminal
4. **Test each fix** before moving to next
5. **Document all changes** for future reference

---

## Expected Outcome

After all fixes:
- Terminal connects stably with history persistence
- Code runner executes Python, JavaScript, and other languages
- APK editor fetches metadata and signs APKs
- All features work end-to-end
- Professional, stable user experience
