# 🎯 EXACT STEPS TO DEPLOY

## What to do RIGHT NOW:

---

## STEP 1: Set Password and JWT Secret (LOCAL MACHINE)

Open terminal and run:

```bash
cd "D:\Projects\projects\my-first-app\SK-Coder\sk-code-main"

# Generate JWT secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output (long string).

Now open `.env.production` in a text editor and set:

```bash
ADMIN_PASSWORD=YourPasswordHere
JWT_SECRET=<paste-the-generated-string>
```

Save the file.

---

## STEP 2: Upload to Server

### Option A: Using WinSCP (Easiest for Windows)

1. Download WinSCP: https://winscp.net/
2. Open WinSCP
3. Enter connection details:
   - Host: `149.118.51.151`
   - Username: `ubuntu`
   - Key file: `web-key.key`
4. Connect
5. Navigate to `/home/ubuntu/` on right side
6. Drag and drop entire `sk-code-main` folder from left to right

### Option B: Using Command Line

```bash
# Open PowerShell or Git Bash
cd "D:\Projects\projects\my-first-app"

# Upload (will ask for key passphrase)
scp -i web-key.key -r SK-Coder/sk-code-main ubuntu@149.118.51.151:/home/ubuntu/
```

Wait for upload to complete (may take 5-10 minutes).

---

## STEP 3: Connect to Server

Open terminal:

```bash
ssh -i web-key.key ubuntu@149.118.51.151
```

---

## STEP 4: Make Scripts Executable

```bash
cd /home/ubuntu/sk-code-main
chmod +x DEPLOY_TO_ORACLE.sh
chmod +x setup.sh
chmod +x deploy-local.sh
chmod +x deploy-server.sh
```

---

## STEP 5: Install Docker (if not installed)

```bash
# Check if Docker is installed
docker --version

# If not installed, run:
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-plugin
sudo usermod -aG docker ubuntu

# Logout and login again for group change
exit

# Reconnect
ssh -i web-key.key ubuntu@149.118.51.151
```

---

## STEP 6: Verify Files Are Uploaded

```bash
cd /home/ubuntu/sk-code-main
ls -la
```

Should show:
- backend/
- frontend/
- deploy/
- docker-compose.yml
- .env.production
- DEPLOY_TO_ORACLE.sh

---

## STEP 7: Check .env.production

```bash
cat .env.production | grep ADMIN
```

Should show your password and JWT secret.

---

## STEP 8: Deploy!

### Option A: One-Command Deploy (Recommended)

```bash
./DEPLOY_TO_ORACLE.sh
```

This will:
1. Build backend
2. Build frontend  
3. Build Docker images
4. Start containers
5. Configure NGINX

Wait 5-10 minutes.

---

### Option B: Manual Step-by-Step

If DEPLOY_TO_ORACLE.sh doesn't work, run these manually:

```bash
# Install pnpm
npm install -g pnpm

# Build backend
cd backend
pnpm install
pnpm run build
cd ..

# Build frontend
cd frontend
pnpm install
pnpm run build
cd ..

# Build Docker images
docker compose build

# Start services
docker compose up -d

# Check status
docker ps
```

---

## STEP 9: Verify Deployment

### Check Containers
```bash
docker ps
```

Should show 2+ containers:
- sk-coder-backend
- sk-coder-runtime

### Check Backend Health
```bash
curl http://localhost:3001/api/healthz
```

Should return: `{"status":"ok"}`

### Check Logs
```bash
docker compose logs -f
```

Press `Ctrl+C` to exit.

---

## STEP 10: Configure NGINX (if needed)

```bash
# Check if NGINX config exists
sudo ls -la /etc/nginx/sites-available/

# If sk-coder not there, copy it
sudo mkdir -p /etc/nginx/sites-available
sudo cp deploy/sk-coder-consolidated.nginx.conf /etc/nginx/sites-available/sk-coder

# Enable site
sudo ln -sf /etc/nginx/sites-available/sk-coder /etc/nginx/sites-enabled/

# Test NGINX config
sudo nginx -t

# Restart NGINX
sudo systemctl restart nginx
```

---

## STEP 11: Test in Browser

Open browser and go to:

### Frontend
```
https://sk-coder.site
```

Should show SK-Coder app.

### Admin Login
```
https://admin.sk-coder.site/login
```

Should show beautiful login page.

Enter:
- Username: `Admin-SK`
- Password: `<your-configured-password>`

Should redirect to dashboard.

---

## STEP 12: Success!

If you see:
- ✅ https://sk-coder.site loads
- ✅ https://admin.sk-coder.site/login shows
- ✅ Login works
- ✅ Admin dashboard shows

**Congratulations! Your app is live! 🎉**

---

## 🔧 IF SOMETHING FAILS

### Backend won't start:
```bash
# Check logs
docker compose logs backend

# Rebuild
docker compose build backend
docker compose up -d backend
```

### Frontend won't load:
```bash
# Check if built
ls -la frontend/dist/

# Rebuild if needed
cd frontend && pnpm run build && cd ..
docker compose build frontend
docker compose up -d
```

### Login fails:
```bash
# Check environment variables
docker exec -it sk-coder-backend env | grep ADMIN

# Should show:
ADMIN_USERNAME=Admin-SK
ADMIN_PASSWORD=<your-password>
JWT_SECRET=<your-secret>

# If missing, restart:
docker compose down
docker compose up -d
```

### NGINX errors:
```bash
# Test config
sudo nginx -t

# Check error logs
sudo tail -f /var/log/nginx/error.log

# Restart
sudo systemctl restart nginx
```

---

## 📝 QUICK REFERENCE

```bash
# SSH to server
ssh -i web-key.key ubuntu@149.118.51.151

# Go to app
cd /home/ubuntu/sk-code-main

# View logs
docker compose logs -f

# Restart all
docker compose restart

# Stop all
docker compose down

# Start all
docker compose up -d

# Rebuild all
docker compose build --no-cache && docker compose up -d
```

---

## ✅ CHECKLIST

Before deployment:
- [ ] Set ADMIN_PASSWORD in .env.production
- [ ] Set JWT_SECRET in .env.production
- [ ] Upload sk-code-main to server

After deployment:
- [ ] https://sk-coder.site loads
- [ ] https://admin.sk-coder.site/login shows
- [ ] Login works
- [ ] Dashboard shows

---

## 🚀 THAT'S IT!

Just follow these 12 steps and your app will be live!

**Most important:**
1. Set password in .env.production
2. Upload folder to server
3. Run `./DEPLOY_TO_ORACLE.sh`
4. Open browser and login!

**You got this! 🎯**
