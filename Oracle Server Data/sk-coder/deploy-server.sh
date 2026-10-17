#!/bin/bash

echo "SK-Coder Oracle Server Deployment"
echo "=================================="

echo ""
echo "This script will:"
echo "1. Sync code to server"
echo "2. Configure NGINX"
echo "3. Build Docker images"
echo "4. Start services"
echo ""

read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    exit 1
fi

SERVER="ubuntu@149.118.51.151"
KEY="web-key.key"
PROJECT_DIR="/opt/sk-coder"

echo ""
echo "Step 1: Syncing files to server..."
rsync -avz --exclude 'node_modules' --exclude '.git' --exclude 'dist' -e "ssh -i $KEY" . $SERVER:$PROJECT_DIR

echo ""
echo "Step 2: Fixing NGINX configuration..."
ssh -i $KEY $SERVER << 'EOF'
    sudo rm -f /etc/nginx/sites-enabled/sk-coder-owner*
    sudo rm -f /etc/nginx/conf.d/sk-coder.conf
    sudo cp /opt/sk-coder/deploy/sk-coder-consolidated.nginx.conf /etc/nginx/sites-available/sk-coder.conf
    sudo ln -sf /etc/nginx/sites-available/sk-coder.conf /etc/nginx/sites-enabled/sk-coder.conf
    sudo nginx -t
EOF

echo ""
echo "Step 3: Creating admin password..."
ssh -i $KEY $SERVER << 'EOF'
    if [ ! -f /etc/nginx/sk-coder-owner.htpasswd ]; then
        sudo htpasswd -bc /etc/nginx/sk-coder-owner.htpasswd admin "ChangeMeImmediately123!"
    fi
EOF

echo ""
echo "Step 4: Building Docker images on server..."
ssh -i $KEY $SERVER << 'EOF'
    cd /opt/sk-coder
    docker compose build
EOF

echo ""
echo "Step 5: Starting services..."
ssh -i $KEY $SERVER << 'EOF'
    cd /opt/sk-coder
    docker compose down
    docker compose up -d
    docker compose ps
EOF

echo ""
echo "Step 6: Waiting for services to start..."
sleep 10

echo ""
echo "Step 7: Testing deployment..."
ssh -i $KEY $SERVER << 'EOF'
    echo "Backend health check:"
    curl -f http://127.0.0.1:3001/api/healthz && echo " ✅ OK" || echo " ❌ Failed"
    
    echo ""
    echo "Frontend check:"
    curl -f http://127.0.0.1:8080/ > /dev/null && echo " ✅ OK" || echo " ❌ Failed"
    
    echo ""
    echo "NGINX check:"
    sudo nginx -t
EOF

echo ""
echo "=================================="
echo "Deployment complete!"
echo ""
echo "Access points:"
echo "  HTTPS:    https://sk-coder.site"
echo "  Health:   https://sk-coder.site/api/healthz"
echo "  Admin:    https://admin.sk-coder.site"
echo ""
echo "IMPORTANT: Change admin password immediately!"
echo "Run: ssh -i $KEY $SERVER 'sudo htpasswd /etc/nginx/sk-coder-owner.htpasswd admin'"
