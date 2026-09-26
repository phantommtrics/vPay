# Deploy the consumer web app

The customer site is separate from the admin portal.

| URL | Served by |
|-----|-----------|
| `https://customer.vpayafrica.phantommetrics.gm/` | Consumer web app (Expo static export) |
| `https://api.vpayafrica.phantommetrics.gm/api/*` | Existing Node API |

The web build calls the API on `api.vpayafrica.phantommetrics.gm`. It does not share the admin hostname.

---

## 1. DNS

Point an A record at the server:

```text
customer.vpayafrica.phantommetrics.gm  →  server IP
```

---

## 2. Build and upload

From the repo root:

```bash
bash backend/deployment/deploy-customer-web.sh user@your-server
```

With no host, the script only builds `mobile/dist` so you can upload it yourself.

The script sets `EXPO_PUBLIC_API_URL=https://api.vpayafrica.phantommetrics.gm` for the build. A local `mobile/.env` does not override that.

On the server, once:

```bash
sudo mkdir -p /var/www/vpay-customer
sudo chown -R "$USER":www-data /var/www/vpay-customer
```

---

## 3. nginx

```bash
sudo cp backend/deployment/nginx/customer.vpayafrica.conf \
  /etc/nginx/sites-available/customer.vpayafrica.conf
sudo ln -sf /etc/nginx/sites-available/customer.vpayafrica.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d customer.vpayafrica.phantommetrics.gm
```

This site only serves static files. Do not proxy `/api/` here.

---

## 4. Allow the new origin on the API

In `backend/.env` on the server, add the customer origin to `CORS_ORIGINS` (keep the existing origins):

```bash
CORS_ORIGINS=http://localhost:5173,http://localhost:8081,https://api.vpayafrica.phantommetrics.gm,https://customer.vpayafrica.phantommetrics.gm
```

Restart the API:

```bash
pm2 restart vpay-africa-backend --update-env
```

---

## 5. Verify

```bash
curl -s -o /dev/null -w "customer: %{http_code}\n" https://customer.vpayafrica.phantommetrics.gm/
curl -s -o /dev/null -w "api health: %{http_code}\n" https://api.vpayafrica.phantommetrics.gm/health
```

Open `https://customer.vpayafrica.phantommetrics.gm/` and sign in.

Later updates are the same script. nginx does not need a reload for a static-only upload.
