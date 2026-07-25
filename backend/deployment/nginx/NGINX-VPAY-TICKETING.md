# nginx for vPay + Ticketing (Apache → nginx migration)

Both apps run on **one nginx** instance. They are **separate sites** (different domains), not mixed on the same `server_name`.

| App | Domain | Stack | nginx role |
|-----|--------|-------|------------|
| **vPay** | `api.vpayafrica.phantommetrics.gm` | Node API + React admin | Proxy `/api/` → port 3001; serve admin static files |
| **Ticketing** | `aps-ticketing.apswallet.gm` | PHP (was Apache2) | Serve PHP files via **php-fpm** |

Stopping Apache is fine **only if** nginx replaces everything Apache did (static files + PHP via php-fpm).

---

## Why ticketing broke

Apache ran PHP with **mod_php**. nginx does **not** run PHP itself — it forwards `.php` requests to **php-fpm**. If you only installed nginx for vPay and copied the wrong `root`, ticketing will show vPay Admin or 404.

---

## One-time server setup

```bash
# nginx (if not installed)
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx

# php-fpm (required for ticketing — match your PHP version)
sudo apt install -y php-fpm php-cli php-mysql php-xml php-mbstring php-curl php-zip php-gd
sudo systemctl enable --now php8.2-fpm   # or php8.1-fpm — check: ls /run/php/

# Stop Apache so it does not fight nginx for ports 80/443
sudo systemctl stop apache2
sudo systemctl disable apache2

# Remove nginx default site if it steals traffic
sudo rm -f /etc/nginx/sites-enabled/default
```

---

## Step 1 — Recover ticketing paths from Apache

```bash
# Old document root and aliases
grep -rE 'DocumentRoot|Alias|Directory' /etc/apache2/sites-enabled/ 2>/dev/null

# Where PHP files live
sudo find /var/www -name index.php 2>/dev/null | head -20
```

Note the directory that contains ticketing’s `index.php` and whether URLs use `/ticketing/` (subdir) or domain root.

---

## Step 2 — vPay nginx site

```bash
sudo cp backend/deployment/nginx/vpay.africa-api.conf \
  /etc/nginx/sites-available/api.vpayafrica.conf
sudo ln -sf /etc/nginx/sites-available/api.vpayafrica.conf /etc/nginx/sites-enabled/
```

Ensure backend is running:

```bash
pm2 list
curl -s http://127.0.0.1:3001/health
```

Admin static files:

```bash
sudo mkdir -p /var/www/vpay-admin
# rsync appAdmin/dist/ from your machine (see DEPLOY-ADMIN.md)
```

---

## Step 3 — Ticketing nginx site (PHP)

```bash
sudo cp backend/deployment/nginx/ticketing.example.conf \
  /etc/nginx/sites-available/ticketing.config
```

Edit and set:

1. **`root`** — same path Apache used (often `/var/www/html` if app is at `/ticketing/`)
2. **`fastcgi_pass`** — your php-fpm socket: `ls /run/php/*.sock`

```bash
sudo nano /etc/nginx/sites-available/ticketing.config
sudo ln -sf /etc/nginx/sites-available/ticketing.config /etc/nginx/sites-enabled/
```

**Must not** contain `root /var/www/vpay-admin` or `proxy_pass http://127.0.0.1:3001`.

---

## Step 4 — Enable sites and SSL

```bash
sudo nginx -t && sudo systemctl reload nginx

sudo certbot --nginx -d api.vpayafrica.phantommetrics.gm
sudo certbot --nginx -d aps-ticketing.apswallet.gm
```

After Certbot, confirm **both** port 443 server blocks still have the correct `location` rules (Certbot sometimes simplifies configs).

### HTTP works but HTTPS shows vPay Admin

If `curl http://aps-ticketing.../ticketing/` returns **404** but `curl https://...` returns **vPay Admin**, port 80 uses `ticketing.config` but **port 443 has no block** for `aps-ticketing.apswallet.gm` — HTTPS falls through to the vPay site.

Fix:

```bash
# Check which server block handles HTTPS for ticketing
sudo nginx -T 2>/dev/null | grep -A2 'server_name aps-ticketing'

# Should show BOTH listen 80 AND listen 443 ssl for aps-ticketing.apswallet.gm
# If 443 is missing:
sudo certbot --nginx -d aps-ticketing.apswallet.gm
sudo nginx -t && sudo systemctl reload nginx

curl -s https://aps-ticketing.apswallet.gm/ticketing/ | grep '<title>'
```

Purge **Cloudflare cache** if the domain is proxied (responses show `server: cloudflare`).

### Wrong root with `/ticketing/` prefix

If `root /var/www/ticketing` and `location /ticketing/`, nginx looks for files at `/var/www/ticketing/ticketing/` — which does not exist → **404**.

Use **`alias /var/www/ticketing/`** instead (see [ticketing.example.conf](./ticketing.example.conf) Option B).

---

## Step 5 — Verify

```bash
# vPay
curl -s https://api.vpayafrica.phantommetrics.gm/health
curl -s https://api.vpayafrica.phantommetrics.gm/login | grep '<title>'
# → vPay Admin

# Ticketing (must NOT show vPay Admin)
curl -s https://aps-ticketing.apswallet.gm/ticketing/ | grep -E '<title>|ticketing' -i
curl -s -o /dev/null -w "%{http_code}\n" https://aps-ticketing.apswallet.gm/ticketing/dashboard

# Services
sudo systemctl status nginx php8.2-fpm
pm2 list
```

---

## Enabled sites should look like

```text
/etc/nginx/sites-enabled/
  api.vpayafrica.conf   → vPay only
  ticketing.config      → ticketing PHP only
  (no default)
  (no duplicate server_name)
```

Check:

```bash
ls -la /etc/nginx/sites-enabled/
sudo nginx -T 2>/dev/null | grep -E 'server_name|root |fastcgi_pass|proxy_pass'
```

---

## Troubleshooting

| Problem | Likely cause | Fix |
|---------|--------------|-----|
| Ticketing shows **vPay Admin** | `ticketing.config` uses `/var/www/vpay-admin` | Point `root` at PHP app; use php-fpm |
| Ticketing **502** / blank PHP | php-fpm not running, wrong socket, or bad `alias` PHP block | Use `root /var/www` config below; check error log |
| CSS/JS/images broken, HTML OK | App links to `/public/...` but nginx only serves `/ticketing/public/` | Add `location /public/` block (see below) |

### Styles/CSS not loading (content works, no styling)

Ticketing HTML uses **root-absolute** asset paths:

```html
<link href="/public/session/css/style.css">
```

Those resolve to `https://aps-ticketing.apswallet.gm/public/...`, **not** `/ticketing/public/...`.
Without a nginx rule, `/public/` hits `location / { return 404; }`.

Add to **both** port 80 and 443 blocks in `ticketing.config`:

```nginx
location /public/ {
    root /var/www/ticketing;
    try_files $uri =404;
    expires 30d;
    access_log off;
}

location ~* ^/ticketing/.+\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|map)$ {
    root /var/www;
    try_files $uri =404;
    expires 30d;
    access_log off;
}
```

Verify:

```bash
curl -sI https://aps-ticketing.apswallet.gm/public/session/css/style.css
# → HTTP 200, content-type: text/css

curl -sI https://aps-ticketing.apswallet.gm/public/session/vendor/jquery/jquery.min.js
# → HTTP 200, content-type: application/javascript

sudo nginx -t && sudo systemctl reload nginx
```

Purge Cloudflare cache if assets still missing after fix.

### JavaScript loads but does not run / features broken

**1. Check file sizes on the server** (empty JS files load as 200 but do nothing):

```bash
ls -la /var/www/ticketing/public/session/js/main.js
wc -c /var/www/ticketing/public/session/js/main.js
```

If `main.js` is **0 bytes**, restore it from backup or the original ticketing deploy — nginx cannot fix an empty file.

**2. Cloudflare** (domain is proxied): disable **Rocket Loader** and **Auto Minify JavaScript** in Cloudflare → Speed → Optimization. Both break jQuery-heavy apps. Purge cache after changes.

**3. Browser DevTools** → Network → filter JS. Every script should be **200** with type `application/javascript`, not `text/html` (PHP error page).

**4. Dashboard / inner pages** may load JS from other paths (`/ticketing/assets/`, etc.). The static `location ~* \.(js|css|...)$` block above covers those under `/ticketing/`.

**5. PHP app base URL** — if AJAX calls fail after Apache migration, set the app’s base URL to `https://aps-ticketing.apswallet.gm/ticketing/` in its PHP config (`.env`, `config.php`, etc.).
| **Download** instead of running PHP | Missing `location ~ \.php$` | Add fastcgi block from example config |
| vPay **502** on `/api/` | Node not on 3001 | `pm2 restart vpay-africa-backend` |
| Port **80 in use** | Apache still running | `sudo systemctl stop apache2` |

### Ticketing returns 502 (Cloudflare or nginx)

A **502** after fixing HTTPS usually means nginx reached php-fpm but **PHP failed** — often a broken `alias` + `fastcgi` block.

**1. Check logs on the server:**

```bash
sudo tail -30 /var/log/nginx/error.log
sudo systemctl status php8.2-fpm
ls /run/php/*.sock
ls -la /var/www/ticketing/index.php
```

**2. Replace ticketing.config** with the simpler `root`-based config ([ticketing.example.conf](./ticketing.example.conf)):

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name aps-ticketing.apswallet.gm;

    root /var/www;
    index index.php;

    location = / {
        return 301 /ticketing/;
    }

    location /ticketing/ {
        try_files $uri $uri/ /ticketing/index.php?$query_string;
    }

    location ~ ^/ticketing/.+\.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/run/php/php8.2-fpm.sock;
    }

    location / {
        return 404;
    }
}
```

Apply the **same** `location` blocks inside the **443** server block Certbot created (edit `/etc/nginx/sites-available/ticketing.config` — Certbot adds `listen 443 ssl` to the same file).

**3. Fix socket version** if needed (`php8.1-fpm.sock` vs `php8.2-fpm.sock`):

```bash
ls /run/php/*.sock
sudo systemctl restart php8.2-fpm
```

**4. Fix permissions:**

```bash
sudo chown -R www-data:www-data /var/www/ticketing
sudo find /var/www/ticketing -type d -exec chmod 755 {} \;
sudo find /var/www/ticketing -type f -exec chmod 644 {} \;
```

**5. Reload and test origin directly** (bypass Cloudflare cache):

```bash
sudo nginx -t && sudo systemctl reload nginx
curl -sI -H "Host: aps-ticketing.apswallet.gm" http://127.0.0.1/ticketing/
curl -s http://127.0.0.1/ticketing/ -H "Host: aps-ticketing.apswallet.gm" | head -5
```

Then purge **Cloudflare cache** for the domain.

### Test php-fpm directly

```bash
echo '<?php phpinfo();' | sudo tee /var/www/html/ticketing/phpinfo-test.php
curl -s https://aps-ticketing.apswallet.gm/ticketing/phpinfo-test.php | head -5
sudo rm /var/www/html/ticketing/phpinfo-test.php   # remove after test
```

---

## Summary

```
                    ┌─────────────────────────────────────┐
   Browser          │            nginx (:443)              │
        │           │                                      │
        ├──────────►│  api.vpayafrica...  → vPay site      │
        │           │    /api/*  ──────────► Node :3001    │
        │           │    /*      ──────────► /var/www/vpay-admin
        │           │                                      │
        └──────────►│  aps-ticketing...   → ticketing site │
                    │    /ticketing/* ───► php-fpm + PHP files
                    └─────────────────────────────────────┘

Apache2: stopped/disabled — nginx + php-fpm handle everything
```

See also: [DEPLOY-ADMIN.md](./DEPLOY-ADMIN.md), [ticketing.example.conf](./ticketing.example.conf).
