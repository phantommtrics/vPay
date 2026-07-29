# vPay — directPay internal partner integration

Server-to-server integration between vPay and directPay. Never expose `INTERNAL_PARTNER_API_SECRET` in the mobile app.

## Partner app

vPay uses `partnerApp: "vpay"` on provision:

- `platformBillingWaived: true`
- Auto **perpetual CORPORATE** subscription (`CONTRACT_INFINITE`, no platform invoices)
- Internal-partner checkout APIs for card funding (Wave / APS)

See also [directPay INTEGRATION_VPAY.md](../../directPay/docs/INTEGRATION_VPAY.md) in the sibling repo.

## vPay env (`backend/.env`)

| Variable | Purpose |
|----------|---------|
| `DIRECTPAY_API_BASE_URL` | directPay API origin (no trailing slash), e.g. `http://localhost:4000` |
| `INTERNAL_PARTNER_API_SECRET` | Must match directPay's secret |
| `INTERNAL_PARTNER_WEBHOOK_SECRET` | Verify inbound `X-Easypay-Signature` on `/api/webhooks/directpay` |
| `VPAY_PUBLIC_API_URL` | Public vPay API URL passed as per-business `webhookUrl` on provision |

## directPay env

| Variable | Purpose |
|----------|---------|
| `INTERNAL_PARTNER_API_SECRET` | Same value as vPay |
| `INTERNAL_PARTNER_WEBHOOK_URL` | Include `http://localhost:3001/api/webhooks/directpay` (comma-separated if multiple) |
| `INTERNAL_PARTNER_WEBHOOK_SECRET` | Same value as vPay |

Platform operator must configure Wave/APS gateway credentials for the platform `businessId` in directPay Merchant API.

## Platform merchant (one per vPay)

vPay uses **one** directPay merchant for all customer wallet top-ups. An admin provisions it once for a designated user (`Connect directPay merchant` in the admin portal, or `npm run admin:provision-directpay -- ops@example.com`). That user's `directPayBusinessId` is the platform merchant; other customers fund through it and receive credits on their own vPay wallets.

## Flow

1. User completes KYC → admin approves (`npm run admin:approve -- user@example.com` or `POST /api/admin/kyc/:userId/approve`). **Approve only updates KYC status** — it does not provision Stripe or directPay.
2. Optionally provision Stripe card: `npm run admin:provision -- user@example.com`
3. Provision the **platform** directPay merchant once: `npm run admin:provision-directpay -- ops@example.com` or `POST /api/admin/kyc/:userId/provision-directpay`
4. Any KYC-approved user opens **Fund** → `POST /api/fund/prepare` creates a funding order + directPay checkout order on the platform merchant.
4. User pays via Wave (launch URL) or APS (authorize + OTP).
5. directPay sends `payment.completed` webhook → funding order marked `PAID`.

## Admin commands

```bash
cd backend
npm run admin:approve -- user@example.com              # KYC approve only
npm run admin:provision -- user@example.com            # Stripe card, free (requires approved KYC)
npm run admin:provision -- user@example.com --charge   # Stripe card, debit user wallet first
npm run admin:provision-directpay -- user@example.com  # directPay merchant (requires approved KYC)
```

## Note on card balance

Webhook marks the funding order paid in vPay. Moving GMD proceeds into the user's Stripe USDC financial account is not automated in this pass — card balance may not update until a future treasury step.
