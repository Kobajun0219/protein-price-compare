# AWS Lightsail Deploy Guide (Low Cost)

This guide targets a low-cost single-instance deployment on AWS Lightsail.

## Architecture

- 1 Lightsail Linux instance
- Backend: Node.js + Express (systemd)
- Frontend: Vite build output served by Nginx
- Database: PostgreSQL on the same instance

This is the cheapest practical setup for early-stage release.

## 1. Create Lightsail resources

1. Create an instance (Ubuntu LTS).
2. Start with the smallest plan.
3. Add a static IP and attach it to the instance.
4. Open networking ports: 22, 80, 443.

## 2. Connect and install base packages

```bash
sudo apt update
sudo apt -y upgrade
sudo apt -y install nginx postgresql postgresql-contrib git curl ufw
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt -y install nodejs
node -v
npm -v
```

## 3. Clone app and install dependencies

```bash
git clone <your-repository-url> app
cd app
npm install
npm --prefix backend install
npm --prefix frontend install
```

## 4. Create PostgreSQL database

```bash
sudo -u postgres psql
```

Inside psql:

```sql
CREATE USER protein_user WITH PASSWORD 'strong_password_here';
CREATE DATABASE protein_compare OWNER protein_user;
GRANT ALL PRIVILEGES ON DATABASE protein_compare TO protein_user;
\q
```

## 5. Configure backend environment

Create backend env file:

```bash
cat > backend/.env << 'EOF'
DATABASE_URL="postgresql://protein_user:strong_password_here@localhost:5432/protein_compare?schema=public"
RAKUTEN_APP_ID="your_rakuten_app_id"
RAKUTEN_AFFILIATE_ID=""
RAKUTEN_KEYWORD="プロテイン"
PORT=4000
EOF
```

## 6. Run Prisma migration and seed

```bash
npm --prefix backend run prisma:generate
npm --prefix backend run prisma:deploy
npm --prefix backend run prisma:seed
```

## 7. Build frontend and set API URL

```bash
cat > frontend/.env.production << 'EOF'
VITE_API_URL="https://your-domain-or-ip"
EOF

npm --prefix frontend run build
```

## 8. Configure backend as systemd service

```bash
sudo tee /etc/systemd/system/protein-backend.service > /dev/null << 'EOF'
[Unit]
Description=Protein Compare Backend
After=network.target

[Service]
Type=simple
WorkingDirectory=/home/ubuntu/app/backend
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=3
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable protein-backend
sudo systemctl start protein-backend
sudo systemctl status protein-backend --no-pager
```

## 9. Configure Nginx (frontend + API reverse proxy)

```bash
sudo tee /etc/nginx/sites-available/protein-app > /dev/null << 'EOF'
server {
    listen 80;
    server_name _;

    root /home/ubuntu/app/frontend/dist;
    index index.html;

    location / {
        try_files $uri /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:4000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/protein-app /etc/nginx/sites-enabled/protein-app
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

## 10. Optional HTTPS with Let's Encrypt

If you have a domain:

```bash
sudo apt -y install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

## 11. Rakuten Allowed websites

Because backend calls Rakuten API, register your backend domain in Rakuten Allowed websites.

Example:

```text
https://your-domain.com
```

## 12. Smoke test

```bash
curl http://localhost:4000/api/health
curl http://localhost:4000/api/products
curl -X POST http://localhost:4000/api/sync \
  -H "Content-Type: application/json" \
  -d '{"provider":"rakuten","keyword":"プロテイン","hits":10,"pages":1}'
```

## 13. Low-cost operations tips

- Run one instance only while traffic is small.
- Keep PostgreSQL on the same host at first.
- Backup DB daily with pg_dump.
- Scale out only after usage increases.
