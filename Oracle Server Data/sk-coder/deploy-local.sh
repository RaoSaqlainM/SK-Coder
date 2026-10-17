#!/bin/bash

echo "SK-Coder Deployment Script"
echo "============================"

echo ""
echo "Step 1: Installing dependencies..."
cd backend && npm install
cd ../frontend && npm install
cd ..

echo ""
echo "Step 2: Building backend..."
cd backend && npm run build
cd ..

echo ""
echo "Step 3: Building frontend..."
cd frontend && npm run build
cd ..

echo ""
echo "Step 4: Building Docker images..."
docker compose build

echo ""
echo "Step 5: Starting services..."
docker compose up -d

echo ""
echo "Step 6: Checking service status..."
docker compose ps

echo ""
echo "Step 7: Testing backend health..."
sleep 5
curl -f http://127.0.0.1:3001/api/healthz && echo " ✅ Backend OK" || echo " ❌ Backend Failed"

echo ""
echo "Step 8: Testing frontend..."
curl -f http://127.0.0.1:8080/ > /dev/null && echo " ✅ Frontend OK" || echo " ❌ Frontend Failed"

echo ""
echo "============================"
echo "Deployment complete!"
echo ""
echo "Access points:"
echo "  Frontend: http://localhost:8080"
echo "  Backend:  http://localhost:3001"
echo "  Health:   http://localhost:3001/api/healthz"
