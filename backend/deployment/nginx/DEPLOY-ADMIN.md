# Deploy appAdmin on the same domain as the backend

Serve the admin portal and API from **one nginx site**:

| URL | Served by |
|-----|-----------|
| `https://api.vpayafrica.phantommetrics.gm/` | appAdmin SPA (static files) |
| `https://api.vpayafrica.phantommetrics.gm/login` | appAdmin SPA |
| `https://api.vpayafrica.phantommetrics.gm/api/*` | Node backend (port 3001) |
| `https://api.vpayafrica.phantommetrics.gm/uploads/*` | Node backend |
| `https://api.vpayafrica.phantommetrics.gm/health` | Node backend |

The admin app calls `/api/...` with **relative URLs** (no separate API host).

---

## 1. Build the admin app (local or CI)

From the repo root:

```bash
cd appAdmin
npm ci
npm run build
```

Production build uses `appAdmin/.env.production` (`VITE_API_URL` empty → same-origin `/api`).

Output is in `appAdmin/dist/`.

---

## 2. Upload static files to the server

On the server, create the web root once:

```bash
sudo mkdir -p /var/www/vpay-admin
sudo chown -R "$USER":www-data /var/www/vpay-admin
```

From your machine (replace `user` and `server`):

```bash
rsync -av --delete appAdmin/dist/ user@server:/var/www/vpay-admin/
```

Or copy manually, then on the server:

```bash
sudo chown -R www-data:www-data /var/www/vpay-admin
sudo find /var/www/vpay-admin -type d -exec chmod 755 {} \;
sudo find /var/www/vpay-admin -type f -exec chmod 644 {} \;
```

Helper script from repo root:

```bash
bash backend/deployment/deploy-admin.sh user@your-server
```

---

## 3. Install nginx config

Copy the combined API + admin config:

```bash
sudo cp backend/deployment/nginx/vpay.africa-api.conf /etc/nginx/sites-available/api.vpayafrica.conf
sudo ln -sf /etc/nginx/sites-available/api.vpayafrica.conf /etc/nginx/sites-enabled/
```

**If Certbot already added HTTPS**, open the live config and ensure the **443** `server` block uses the same `location` blocks — especially:

- `/api/` → `proxy_pass http://127.0.0.1:3001`
- `/uploads/` → `proxy_pass http://127.0.0.1:3001`
- `/` → `try_files $uri $uri/ /index.html` with `root /var/www/vpay-admin`

Remove any old catch-all like `location / { proxy_pass http://127.0.0.1:3001; }`.

Test and reload:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

Issue or renew SSL if needed:

```bash
sudo certbot --nginx -d api.vpayafrica.phantommetrics.gm
```

---

## 4. Backend environment (on the server)

In `backend/.env` (or PM2 env):

```bash
PORT=3001
ADMIN_APP_URL=https://api.vpayafrica.phantommetrics.gm
# Keep mobile/dev origins; add production admin origin if you use CORS elsewhere
CORS_ORIGINS=http://localhost:5173,http://localhost:8081,https://api.vpayafrica.phantommetrics.gm
```

Restart backend:

```bash
pm2 restart vpay-africa-backend --update-env
```

---

## 5. Verify

```bash
# Backend direct
curl -s http://127.0.0.1:3001/health

# Through nginx
curl -s -o /dev/null -w "health: %{http_code}\n" https://api.vpayafrica.phantommetrics.gm/health
curl -s -o /dev/null -w "admin html: %{http_code}\n" https://api.vpayafrica.phantommetrics.gm/
curl -s -o /dev/null -w "admin login route: %{http_code}\n" https://api.vpayafrica.phantommetrics.gm/login
```

Open `https://api.vpayafrica.phantommetrics.gm/login` in a browser and sign in.

---

## Updating the admin after code changes

```bash
cd appAdmin && npm run build
rsync -av --delete dist/ user@server:/var/www/vpay-admin/
```

No nginx reload needed for static-only updates. Users with the PWA installed may need a refresh; service worker files are sent with `no-cache`.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `/login` returns JSON 404 | `location /` still proxies to Node — use SPA `try_files` |
| API calls fail (404/HTML) | Missing or wrong `location /api/` block |
| Blank page, 200 on `/` | Empty `/var/www/vpay-admin` — run build + rsync |
| Mixed content errors | Use HTTPS for both admin and `ADMIN_APP_URL` |
| Push notification links wrong | Set `ADMIN_APP_URL` in backend `.env` |
