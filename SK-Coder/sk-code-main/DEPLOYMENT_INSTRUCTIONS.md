# 🚀 DEPLOY SK-CODER TO ORACLE SERVER

## 📋 COMPLETE DEPLOYMENT PROCESS

---

## STEP 1: CONFIGURE PASSWORD AND JWT SECRET

### Option A: Edit .env.production file
Open `sk-code-main/.env.production` and set these values:

```bash
ADMIN_USERNAME=Admin-SK
ADMIN_PASSWORD=YourSecurePassword123!
JWT_SECRET=generate-using-node-command-below
```

### Option B: Generate JWT_SECRET
Run this command to generate a secure JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output and paste it as JWT_SECRET.

Example:
```bash
ADMIN_USERNAME=Admin-SK
ADMIN_PASSWORD=MyP@ssw0rd!2026
JWT_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0
```

---

## STEP 2: UPLOAD TO ORACLE SERVER

### Method A: Using SCP (Recommended)

Open your terminal and run:

```bash
# Navigate to project directory
cd "D:\Projects\projects\my-first-app"

# Upload entire sk-code-main folder to server
scp -i web-key.key -r SK-Coder/sk-code-main ubuntu@149.118.51.151:/home/ubuntu/
```

This will upload the folder to `/home/ubuntu/sk-code-main`

---

### Method B: Using SFTP

1. Connect to server:
```bash
sftp -i web-key.key ubuntu@149.118.51.151
```

2. Create directory:
```bash
mkdir /home/ubuntu/sk-coder-app
```

3. Upload files:
```bash
put -r "D:\Projects\projects\my-first-app\SK-Coder\sk-code-main" /home/ubuntu/sk-coder-app/
```

---

## STEP 3: SSH INTO SERVER AND DEPLOY

### Connect to Server
```bash
ssh -i web-key.key ubuntu@149.118.51.151
```

### Navigate to Folder
```bash
cd /home/ubuntu/sk-code-main
```

### Set Permissions
```bash
chmod +x DEPLOY_TO_ORACLE.sh
chmod +x deploy-local.sh
chmod +x deploy-server.sh
```

### Configure .env (if not done earlier)
```bash
nano .env.production
```

Set:
```bash
ADMIN_USERNAME=Admin-SK
ADMIN_PASSWORD=<your-password>
JWT_SECRET=<generated-secret>
```

Save: `Ctrl+O`, Enter, `Ctrl+X`

---

## STEP 4: RUN DEPLOYMENT SCRIPT

### Option A: Full Deployment (Recommended)
```bash
./DEPLOY_TO_ORACLE.sh
```

This will:
1. Install Docker (if not installed)
2. Install Docker Compose
3. Build backend
4. Build frontend
5. Build Docker images
6. Start containers
7. Configure NGINX

---

### Option B: Manual Deployment Step-by-Step

#### Step 4.1: Install Docker
```bash
sudo apt-get update
sudo apt-get install -y docker.io docker-compose
sudo usermod -aG docker ubuntu
```

Logout and login again for group changes.

#### Step 4.2: Build Backend
```bash
cd /home/ubuntu/sk-code-main/backend
npm install -g pnpm
pnpm install
pnpm run build
```

#### Step 4.3: Build Frontend
```bash
cd ../frontend
pnpm install
pnpm run build
```

#### Step 4.4: Build Docker Images
```bash
cd ..
docker-compose build
```

#### Step 4.5: Start Services
```bash
docker-compose up -d
```

---

## STEP 5: CONFIGURE NGINX

### Check NGINX Config
```bash
sudo nano /etc/nginx/sites-available/sk-coder
```

Should contain config from `deploy/sk-coder-consolidated.nginx.conf`

### Enable Site
```bash
sudo ln -sf /etc/nginx/sites-available/sk-coder /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## STEP 6: VERIFY DEPLOYMENT

### Check Running Containers
```bash
docker ps
```

Should show:
- sk-coder-backend
- sk-coder-runtime

### Check Logs
```bash
docker-compose logs -f
```

### Test Backend Health
```bash
curl http://localhost:3001/api/healthz
```

Should return: `{"status":"ok"}`

### Test Frontend
```bash
curl http://localhost:8080
```

Should return HTML.

---

## STEP 7: ACCESS YOUR APPLICATION

### Frontend
Open browser: `https://sk-coder.site`

### Admin Dashboard
Open browser: `https://admin.sk-coder.site`

### Login
- Username: `Admin-SK`
- Password: `<your-configured-password>`

---

## 🔧 TROUBLESHOOTING

### If containers won't start:
```bash
# Check logs
docker-compose logs

# Restart containers
docker-compose restart

# Rebuild if needed
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### If NGINX fails:
```bash
# Test config
sudo nginx -t

# Check error logs
sudo tail -f /var/log/nginx/error.log

# Restart NGINX
sudo systemctl restart nginx
```

### If backend won't connect:
```bash
# Check if backend is running
docker ps | grep backend

# Check backend logs
docker logs sk-coder-backend

# Check environment variables
docker exec -it sk-coder-backend env | grep ADMIN
```

---

## 🔐 SECURITY CHECKLIST

After deployment, verify:

- [ ] ADMIN_PASSWORD is set and secure
- [ ] JWT_SECRET is generated (not empty)
- [ ] HTTPS/SSL certificates are working
- [ ] httpOnly cookies are set
- [ ] Login works at `/login`
- [ ] Admin panel accessible after login
- [ ] Logout works correctly

---

## 📝 POST-DEPLOYMENT STEPS

### 1. Test Login
```bash
# Open browser
https://admin.sk-coder.site/login

# Enter credentials
Username: Admin-SK
Password: <your-password>

# Should redirect to dashboard
https://admin.sk-coder.site/admin
```

### 2. Test Script Management
```bash
# Navigate to Scripts
https://admin.sk-coder.site/admin/scripts

# Create a test script
Name: Test Analytics
Category: Analytics
Scope: Site-wide
Priority: 10
Code: <script>console.log('test');</script>

# Enable and verify
```

### 3. Monitor Logs
```bash
# Watch all logs
docker-compose logs -f

# Watch backend only
docker logs -f sk-coder-backend

# Watch NGINX
sudo tail -f /var/log/nginx/access.log
```

---

## 🎯 QUICK COMMANDS REFERENCE

```bash
# SSH to server
ssh -i web-key.key ubuntu@149.118.51.151

# Navigate to app
cd /home/ubuntu/sk-code-main

# View logs
docker-compose logs -f

# Restart all
docker-compose restart

# Stop all
docker-compose down

# Start all
docker-compose up -d

# Rebuild
docker-compose build --no-cache && docker-compose up -d

# Check status
docker ps
sudo nginx -t
curl http://localhost:3001/api/healthz
```

---

## ✅ SUCCESS INDICATORS

You know deployment succeeded when:

1. ✅ `docker ps` shows running containers
2. ✅ `curl http://localhost:3001/api/healthz` returns `{"status":"ok"}`
3. ✅ `curl http://localhost:8080` returns HTML
4. ✅ Browser opens `https://sk-coder.site`
5. ✅ Login page shows at `https://admin.sk-coder.site/login`
6. ✅ Login succeeds with Admin-SK and your password
7. ✅ Admin dashboard shows after login

---

## 📞 IF YOU NEED HELP

1. Check logs: `docker-compose logs -f`
2. Check NGINX: `sudo nginx -t`
3. Check containers: `docker ps`
4. Check environment: `cat .env.production`
5. Check passwords: Make sure ADMIN_PASSWORD and JWT_SECRET are set

---

## 🚀 YOU'RE READY!

Your SK-Coder application is now:
- ✅ Built and ready to deploy
- ✅ Configured with authentication
- ✅ Enhanced with all features
- ✅ Ready for Oracle server

**Just follow the steps above and you'll have a professional web application running!**

---

**DEPLOY NOW:**
1. Set ADMIN_PASSWORD and JWT_SECRET in .env.production
2. Upload sk-code-main folder to server
3. Run `./DEPLOY_TO_ORACLE.sh`
4. Open browser and login!

**That's it! 🎉**
