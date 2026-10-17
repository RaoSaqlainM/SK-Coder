#!/bin/bash
set -e
echo "[1/4] Creating .env file on server..."
ssh -i web-key.key ubuntu@149.118.51.151 'cd ~/sk-coder && cat > .env << '\EOF'
ADMIN_USERNAME=Admin-SK
ADMIN_PASSWORD=@King4444
JWT_SECRET=2cfe0c5186746457c6debc108c508bdd88a5fa1dfc64d4e5fbe9d136ede543ef
RUNTIME_IMAGE=sk-coder-runtime:oracle-arm64
GUI_RUNTIME_IMAGE=sk-coder-gui:oracle-arm64
APK_RUNTIME_IMAGE=sk-coder-apk:oracle-arm64
WORKSPACE_HOST_PATH=/var/lib/sk-coder/workspaces
WORKSPACE_MAX_BYTES=42949672960
SESSION_MAX_COUNT=100
ALLOWED_ORIGINS=https://sk-coder.site,https://www.sk-coder.site,https://admin.sk-coder.site,https://api.sk-coder.site
EOF'''
