#!/bin/bash

echo "========================================="
echo "SK-Coder Oracle Server Deployment"
echo "========================================="
echo ""
echo "This script will deploy SK-Coder to your Oracle server."
echo "Server: ubuntu@149.118.51.151"
echo ""

if [ ! -f "web-key.key" ]; then
    echo "ERROR: web-key.key not found in current directory!"
    echo "Please place your SSH key file in the current directory."
    exit 1
fi

chmod 600 web-key.key

read -p "Continue with deployment? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
fi

echo ""
echo "========================================"
echo "Step 1: Creating .env file on server..."
echo "========================================"
echo ""

ssh -i web-key.key ubuntu@149.118.51.151 << 'ENDSSH'
sudo mkdir -p /opt/sk-coder
sudo chown ubuntu:ubuntu /opt/sk-coder
ENDSSH

scp -i web-key.key .env.production ubuntu@149.118.51.151:/opt/sk-coder/.env

echo "✅ .env file uploaded"
echo ""

echo "========================================="
echo "Step 2: Syncing code to server..."
echo "========================================="
echo ""

rsync -avz --progress \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude 'dist' \
  --exclude '*.log' \
  --exclude 'web-key.key' \
  -e "ssh -i web-key.key" \
  . ubuntu@149.118.51.151:/opt/sk-coder/

echo "✅ Code synced"
echo ""

echo "========================================="
echo "Step 3: Installing dependencies..."
echo "========================================="
echo ""

ssh -i web-key.key ubuntu@149.118.51.151 << 'ENDSSH'
cd /opt/sk-coder/backend
npm install --production
cd /opt/sk-coder/frontend
npm install --production
ENDSSH

echo "✅ Dependencies installed"
echo ""

echo "========================================="
echo "Step 4: Building application..."
echo "========================================="
echo ""

ssh -i web-key.key ubuntu@149.118.51.151 << 'ENDSSH'
cd /opt/sk-coder/backend
npm run build
cd /opt/sk-coder/frontend
npm run build
ENDSSH

echo "✅ Application built"
echo ""

echo "========================================="
echo "Step 5: Building Docker images..."
echo "========================================="
echo ""

ssh -i web-key.key ubuntu@149.118.51.151 << 'ENDSSH'
cd /opt/sk-coder
docker compose build --no-cache
ENDSSH

echo "✅ Docker images built"
echo ""

echo "========================================="
echo "Step 6: Stopping old containers..."
echo "========================================="
echo ""

ssh -i web-key.key ubuntu@149.118.51.151 << 'ENDSSH'
cd /opt/sk-coder
docker compose down --remove-orphans
ENDSSH

echo "✅ Old containers stopped"
echo ""

echo "========================================="
echo "Step 7: Starting new containers..."
echo "========================================="
echo ""

ssh -i web-key.key ubuntu@149.118.51.151 << 'ENDSSH'
cd /opt/sk-coder
docker compose up -d
ENDSSH

echo "✅ Containers started"
echo ""

echo "========================================="
echo "Step 8: Configuring NGINX..."
echo "========================================="
echo ""

ssh -i web-key.key ubuntu@149.118.51.151 << 'ENDSSH'
sudo rm -f /etc/nginx/sites-enabled/sk-coder-owner*
sudo rm -f /etc/nginx/conf.d/sk-coder.conf
sudo cp /opt/sk-coder/deploy/sk-coder-consolidated.nginx.conf /etc/nginx/sites-available/sk-coder.conf
sudo ln -sf /etc/nginx/sites-available/sk-coder.conf /etc/nginx/sites-enabled/sk-coder.conf
sudo nginx -t
ENDSSH

echo "✅ NGINX configured"
echo ""

echo "========================================="
echo "Step 9: Creating admin password..."
echo "========================================="
echo ""

ssh -i web-key.key ubuntu@149.118.51.151 << 'ENDSSH'
if [ ! -f /etc/nginx/sk-coder-owner.htpasswd ]; then
    echo "Creating admin user..."
    sudo htpasswd -bc /etc/nginx/sk-coder-owner.htpasswd admin "SKCoder2026!"
    echo "⚠️  IMPORTANT: Change the admin password immediately!"
    echo "   Run: ssh -i web-key.key ubuntu@149.118.51.151 'sudo htpasswd /etc/nginx/sk-coder-owner.htpasswd admin'"
fi
ENDSSH

echo ""
echo "========================================="
echo "Step 10: Reloading NGINX..."
echo "========================================="
echo ""

ssh -i web-key.key ubuntu@149.118.51.151 << 'ENDSSH'
sudo systemctl reload nginx
ENDSSH

echo "✅ NGINX reloaded"
echo ""

echo "========================================="
echo "Step 11: Waiting for services..."
echo "========================================="
echo ""

sleep 10

echo "========================================="
echo "Step 12: Testing deployment..."
echo "========================================="
echo ""

ssh -i web-key.key ubuntu@149.118.51.151 << 'ENDSSH'
echo "Testing backend health..."
curl -f http://127.0.0.1:3001/api/healthz && echo " ✅ Backend OK" || echo " ❌ Backend FAILED"

echo ""
echo "Testing frontend..."
curl -f http://127.0.0.1:8080/ > /dev/null && echo " ✅ Frontend OK" || echo " ❌ Frontend FAILED"

echo ""
echo "Testing public endpoint..."
curl -f https://sk-coder.site/api/healthz && echo " ✅ Public endpoint OK" || echo " ❌ Public endpoint FAILED"

echo ""
echo "Checking containers..."
docker ps | grep sk-coder
ENDSSH

echo ""
echo "========================================="
echo "✅ DEPLOYMENT COMPLETE!"
echo "========================================="
echo ""
echo "Access points:"
echo "  🌐 Public:     https://sk-coder.site"
echo "  🔧 Admin:      https://admin.sk-coder.site"
echo "  ❤️  Health:     https://sk-coder.site/api/healthz"
echo ""
echo "Admin credentials:"
echo "  👤 Username: admin"
echo "  🔑 Password: SKCoder2026!"
echo ""
echo "⚠️  IMPORTANT:"
echo "  1. Change admin password immediately:"
echo "     ssh -i web-key.key ubuntu@149.118.51.151 'sudo htpasswd /etc/nginx/sk-coder-owner.htpasswd admin'"
echo ""
echo "  2. Change ADMIN_DASHBOARD_TOKEN in .env"
echo ""
echo "  3. Monitor logs:"
echo "     ssh -i web-key.key ubuntu@149.118.51.151 'docker compose -f /opt/sk-coder/docker-compose.yml logs -f'"
echo ""
echo "Your SK-Coder is now ready for millions of users! 🚀"
