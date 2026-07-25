# Hosting vPay alongside other apps on one server

**Ticketing is a PHP app** (previously Apache2). nginx serves it via **php-fpm**, not Node.  
Full guide: [NGINX-VPAY-TICKETING.md](./NGINX-VPAY-TICKETING.md)

If ticketing (or other) requests show up in vPay logs as 404s — e.g. `GET /ticketing/dashboard` — nginx is sending traffic to the vPay backend (`127.0.0.1:3001`) that belongs to another app.

vPay only serves `/health`, `/api/*`, and `/uploads/*`. Everything else correctly returns 404 from vPay; the fix is nginx routing, not the Node app.

---

## Quick diagnosis (run on the server)

```bash
# 1. Which processes listen on which ports?
sudo ss -tlnp | grep -E ':80|:443|:3001|:3000|:4000|:5000'

# 2. What nginx thinks each site does
sudo nginx -T 2>/dev/null | grep -E 'server_name|listen |proxy_pass|default_server'

# 3. Enabled sites
ls -la /etc/nginx/sites-enabled/

# 4. PM2 apps and ports
pm2 list
pm2 show vpay-africa-backend   # check PORT / script env

# 5. Direct backend health (bypass nginx)
curl -s http://127.0.0.1:3001/health
```

Interpretation:

| Symptom | Likely cause |
|--------|----------------|
| `/ticketing/*` in vPay logs | Catch-all nginx site proxies everything to port 3001 |
| vPay API 502/504 | Backend not running or wrong port in nginx |
| Both apps down | Broken nginx config (`nginx -t` fails) or port conflict |
| Wrong app on HTTPS | Certbot attached SSL to the wrong `server` block |

---

## Fix: separate apps by domain (recommended)

Each app gets its own `server_name`. vPay API should **only** answer for its API subdomain.

**vPay** — copy from this repo:

```bash
sudo cp backend/deployment/nginx/vpay.africa-api.conf /etc/nginx/sites-available/vpay-api.conf
sudo ln -sf /etc/nginx/sites-available/vpay-api.conf /etc/nginx/sites-enabled/
```

**Ticketing** — separate file, separate port (example: 4000):

```nginx
# /etc/nginx/sites-available/ticketing.conf
server {
    listen 80;
    listen [::]:80;
    server_name ticketing.yourdomain.com;   # <-- ticketing domain, NOT the vPay API domain

    location / {
        proxy_pass http://127.0.0.1:4000;  # <-- ticketing app's port
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable, test, reload:

```bash
sudo ln -sf /etc/nginx/sites-available/ticketing.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Issue certificates per domain:

```bash
sudo certbot --nginx -d api.vpayafrica.phantommetrics.gm
sudo certbot --nginx -d ticketing.yourdomain.com
```

---

## Fix: same domain, path-based routing

If ticketing lives at `https://yourdomain.com/ticketing/` on the **same** hostname as something else, use explicit `location` blocks. Order matters: specific paths before catch-all.

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Ticketing app FIRST
    location /ticketing/ {
        proxy_pass http://127.0.0.1:4000/;   # trailing slash strips /ticketing prefix
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # vPay API (if on same host — prefer api subdomain instead)
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Other app or static site — NOT vPay unless intended
    location / {
        proxy_pass http://127.0.0.1:OTHER_PORT;
        # or: root /var/www/main-site; try_files $uri $uri/ /index.html;
    }
}
```

**Do not** put `proxy_pass http://127.0.0.1:3001` in a catch-all `location /` on a shared hostname unless that host is API-only.

---

## Remove the default-site trap

If `/etc/nginx/sites-enabled/default` proxies to vPay (or is the only site), **every** request to the server IP hits vPay:

```bash
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

Also check for `default_server` on the vPay block — remove it unless this machine is API-only:

```bash
sudo nginx -T 2>/dev/null | grep default_server
```

---

## Port checklist

| App | Typical port | Env |
|-----|-------------|-----|
| vPay backend | 3001 | `PORT=3001` in `backend/.env` or PM2 |
| Ticketing (example) | 4000, 5000, etc. | that app's config |

Verify no two Node apps bind the same port:

```bash
pm2 list
sudo ss -tlnp | grep node
```

Restart vPay after env changes:

```bash
pm2 restart vpay-africa-backend --update-env
```

---

## Verify after fix

```bash
# vPay (should be 200)
curl -s http://127.0.0.1:3001/health
curl -s -o /dev/null -w "%{http_code}\n" https://api.vpayafrica.phantommetrics.gm/health

# Ticketing (should NOT hit vPay — check ticketing port directly)
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:4000/
curl -s -o /dev/null -w "%{http_code}\n" https://ticketing.yourdomain.com/ticketing/dashboard

# vPay logs should stop showing /ticketing/* requests
pm2 logs vpay-africa-backend --lines 20
```

---

# Ticketing on its own domain (example: aps-ticketing.apswallet.gm)

Ticketing is a **PHP application** that used to run on **Apache2**. After moving to nginx:

1. **Keep Apache stopped** (or disabled) so it does not bind port 80/443
2. **Run php-fpm** — nginx cannot execute PHP without it
3. **Point `ticketing.config` at the PHP files** Apache used — not `/var/www/vpay-admin`, not port 3001

If ticketing shows **vPay Admin** at `https://aps-ticketing.apswallet.gm/ticketing/`, the ticketing nginx site is misconfigured.

**vPay** → `api.vpayafrica.phantommetrics.gm` → `/var/www/vpay-admin` + `/api/` → Node port 3001  
**Ticketing** → `aps-ticketing.apswallet.gm` → `/ticketing/` → **php-fpm** + PHP document root

Example config: [ticketing.example.conf](./ticketing.example.conf)  
Step-by-step: [NGINX-VPAY-TICKETING.md](./NGINX-VPAY-TICKETING.md)

```bash
# Find where Apache served ticketing from
grep -r DocumentRoot /etc/apache2/sites-enabled/

# php-fpm socket
ls /run/php/*.sock

sudo nano /etc/nginx/sites-available/ticketing.config
sudo nginx -t && sudo systemctl reload nginx

curl -s https://aps-ticketing.apswallet.gm/ticketing/ | grep '<title>'
# Should NOT say "vPay Admin"
```

---

## Common mistakes

1. **One nginx file proxies all traffic to 3001** — vPay becomes accidental default for every domain/path.
2. **Broken nginx config** — orphaned `location` blocks outside a `server { }` cause `nginx -t` to fail; nginx may not reload and old/wrong config keeps running.
3. **Certbot on wrong server block** — SSL works but routes to the wrong upstream.
4. **Ticketing and vPay share port 3001** — only one process can listen; PM2 may restart the wrong app.
