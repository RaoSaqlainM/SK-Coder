#!/bin/bash

echo "=== SK-Coder Three-Phase Fix Script ==="
echo ""
echo "This script will fix:"
echo "  PHASE 1: Terminal stability"
echo "  PHASE 2: Code runner execution"  
echo "  PHASE 3: Preview system (video/PDF) and APK"
echo ""

SERVER="ubuntu@149.118.51.151"
KEY="web-key.key"

echo "[PHASE 1] Terminal Diagnostics..."
echo "Checking runtime container..."
ssh -i "$KEY" "$SERVER" "sudo docker ps | grep skcoder-"

echo ""
echo "Checking session creation..."
ssh -i "$KEY" "$SERVER" "sudo docker logs sk-code-main-backend-1 --tail 20 | grep 'session'"

echo ""
echo "Checking WebSocket endpoint..."
ssh -i "$KEY" "$SERVER" "curl -v --max-time 5 http://localhost:3001/api/ws/terminal 2>&1 | head -20"

echo ""
echo "[PHASE 2] Code Runner Diagnostics..."
echo "Testing Python execution..."
curl -X POST https://sk-coder.site/api/execute/python \
  -H "Content-Type: application/json" \
  -d '{"code":"print(\"Hello\")"}' 2>&1 | head -10

echo ""
echo "[PHASE 3] Checking preview and APK..."
echo "Checking APK tools in container..."
ssh -i "$KEY" "$SERVER" "sudo docker run --rm sk-coder-apk:oracle-arm64 apktool --version" 2>&1 | head -5

echo ""
echo "=== Diagnostics Complete ==="
echo ""
echo "Next: Apply fixes based on diagnostics"
