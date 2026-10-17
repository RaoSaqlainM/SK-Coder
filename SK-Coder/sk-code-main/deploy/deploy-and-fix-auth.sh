#!/bin/bash

set -e

echo "=== SK-Coder Deployment Script ==="

SERVER="ubuntu@149.118.51.151"
KEY="web-key.key"

echo "[1/6] Creating .env file on server..."
ssh -i "$KEY" "$SERVER" << 'ENDSSH'
cd ~/sk-coder

if [ -f .env ]; then
  echo ".env already exists, backing up..."
  cp .env ".env.backup.$(date +%s)"
fi

cat > .env << 'EOF'
ADMIN_USERNAME=Admin-SK
ADMIN_PASSWORD=@King4444
JWT_SECRET=2cfe0c5186746457c6debc108c508bdd88a5fa1dfc64d4e5fbe9d136ede543ef
ADMIN_DASHBOARD_TOKEN=$(openssl rand -hex 16)
RUNTIME_IMAGE=sk-coder-runtime:oracle-arm64
GUI_RUNTIME_IMAGE=sk-coder-gui:oracle-arm64
APK_RUNTIME_IMAGE=sk-coder-apk:oracle-arm64
WORKSPACE_HOST_PATH=/var/lib/sk-coder/workspaces
WORKSPACE_MAX_BYTES=42949672960
SESSION_MAX_COUNT=100
ALLOWED_ORIGINS=https://sk-coder.site,https://www.sk-coder.site,https://admin.sk-coder.site,https://api.sk-coder.site
EOF

echo ".env file created successfully"
ENDSSH

echo "[2/6] Pulling latest code..."
ssh -i "$KEY" "$SERVER" "cd ~/sk-coder && git pull origin main || git pull origin master || true"

echo "[3/6] Stopping containers..."
ssh -i "$KEY" "$SERVER" "cd ~/sk-coder && sudo docker compose down"

echo "[4/6] Starting containers..."
ssh -i "$KEY" "$SERVER" "cd ~/sk-coder && sudo docker compose up -d"

echo "[5/6] Waiting for backend..."
sleep 15

echo "[6/6] Testing health..."
health_response=$(ssh -i "$KEY" "$SERVER" "curl -s https://sk-coder.site/api/healthz")

if [ "$health_response" = '{"status":"ok"}' ]; then
  echo "✓ Backend health check passed"
else
  echo "✗ Backend health check failed: $health_response"
  exit 1
fi

echo ""
echo "=== Deployment Complete ==="
echo "Login at: https://sk-coder.site/login"
echo "Username: Admin-SK"
echo "Password: @King4444"
