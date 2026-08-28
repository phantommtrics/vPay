# vPay → BiReport report pack

Paste each SQL block into the BiReport **Report Builder**. No seeding — create Saved Reports manually (or import via your usual catalog flow).

## Parameter syntax (biReports)

| Syntax | Meaning |
|---|---|
| `:dateFrom` / `:dateTo` | Date range (UI date picker; defaults month-start → today) |
| `:dateToExclusive` | Auto-expanded to **day after** `dateTo` — use for half-open ranges |
| `:dateToEnd` | Auto-expanded to `dateTo 23:59:59` |
| `:name` | Required filter |
| `:name?` | Optional filter |
| `:name[]` | Multi-value list for `IN (...)` |
| `[[ ... :name? ... ]]` | Entire block dropped when optional vars are empty |

**Date filter pattern (preferred):**

```sql
WHERE col >= :dateFrom::timestamptz
  AND col <  :dateToExclusive::timestamptz
```

After substitution this becomes `'2026-08-01'::timestamptz` (string literal + cast). Do **not** use Postgres `$1` binds.

**Suggested SavedReport fields**

- Categories used below: `OPERATIONAL`, `FINANCIAL`, `BALANCE`, `COMPLIANCE`, `CUSTOMERS`, `RECONCILIATION`, `AML`
- Visualizations: `TABLE_ONLY`, `BAR_CHART`, `LINE_CHART`, `PIE_CHART`
- Chart rule: **column 1 = label**, remaining numeric columns = series / pie values

---

## Insight dashboards (KPIs first)

Three **single-row scorecards** (one optimized query each) plus supporting charts. Prefer these over many tiny KPI queries — one scan per fact table, all metrics in one round-trip.

In BiReport you can either:
- show the scorecard as a **TABLE_ONLY** widget, or
- bind multiple KPI cards to the **same report**, each with a different `kpiColumn`

### Catalog

| Report | Kind | Category |
|---|---|---|
| `[vPay] Customer Insights Scorecard` | KPI / TABLE | CUSTOMERS |
| `[vPay] Chart — New Customers by Day` | LINE | CUSTOMERS |
| `[vPay] Chart — KYC Mix` | PIE | COMPLIANCE |
| `[vPay] Wallet Funding Insights Scorecard` | KPI / TABLE | FINANCIAL |
| `[vPay] Chart — Paid Funding Trend` | BAR | FINANCIAL |
| `[vPay] Chart — Funding Status Mix` | PIE | OPERATIONAL |
| `[vPay] Card Funding Insights Scorecard` | KPI / TABLE | FINANCIAL |
| `[vPay] Chart — Card Fund Trend` | LINE | FINANCIAL |
| `[vPay] Chart — Card Fund Status Mix` | PIE | OPERATIONAL |

**Suggested layout (12-col)**

```
Customer Insights
  Row 1: Customer Insights Scorecard (full width table / KPI strip)
  Row 2: New Customers by Day (wide) | KYC Mix (pie)

Wallet Funding Insights
  Row 1: Wallet Funding Insights Scorecard
  Row 2: Paid Funding Trend (wide) | Funding Status Mix (pie)

Card Funding Insights
  Row 1: Card Funding Insights Scorecard
  Row 2: Card Fund Trend (wide) | Card Fund Status Mix (pie)
```

**Scorecard kpiColumns**

| Scorecard | Columns for KPI cards |
|---|---|
| Customer | `active_customers`, `new_customers`, `kyc_pending`, `kyc_approved`, `kyc_rejected`, `customers_with_card`, `active_cards`, `carded_pct`, `blocked_customers`, `terminated_in_period` |
| Wallet funding | `paid_funding_gmd`, `paid_orders`, `funding_fee_gmd`, `gross_funding_gmd`, `avg_ticket_gmd`, `unique_funders`, `pending_orders`, `failed_orders`, `funding_success_pct`, `usd_estimate` |
| Card funding | `card_fund_usd`, `card_fund_gmd`, `card_fund_count`, `card_fund_fee_gmd`, `avg_fund_usd`, `unique_card_funders`, `pending_count`, `failed_count`, `card_fund_success_pct`, `avg_fx`, `stripe_credited_count` |

---

### A. `[vPay] Customer Insights Scorecard`

- **Description:** One-row customer / KYC / card conversion KPIs. Users scanned once; cards + KYC audits as scalar subqueries.
- **Viz:** `TABLE_ONLY` · **Params:** `:dateFrom`, `:dateTo`

```sql
WITH customers AS (
  SELECT
    u.id,
    u.account_status,
    u.kyc_status,
    u.created_at,
    u.terminated_at,
    EXISTS (
      SELECT 1
      FROM virtual_cards vc
      WHERE vc.user_id = u.id
        AND vc.status = 'ACTIVE'
    ) AS has_active_card
  FROM users u
  WHERE u.admin_user = false
),
user_kpis AS (
  SELECT
    COUNT(*) FILTER (WHERE account_status = 'ACTIVE')::bigint AS active_customers,
    COUNT(*) FILTER (
      WHERE created_at >= :dateFrom::timestamptz
        AND created_at < :dateToExclusive::timestamptz
    )::bigint AS new_customers,
    COUNT(*) FILTER (WHERE kyc_status = 'PENDING')::bigint AS kyc_pending,
    COUNT(*) FILTER (WHERE kyc_status = 'APPROVED')::bigint AS kyc_approved_snapshot,
    COUNT(*) FILTER (
      WHERE account_status = 'ACTIVE' AND has_active_card
    )::bigint AS customers_with_card,
    COUNT(*) FILTER (WHERE account_status = 'BLOCKED')::bigint AS blocked_customers,
    COUNT(*) FILTER (
      WHERE terminated_at >= :dateFrom::timestamptz
        AND terminated_at < :dateToExclusive::timestamptz
    )::bigint AS terminated_in_period,
    ROUND(
      100.0 * COUNT(*) FILTER (WHERE account_status = 'ACTIVE' AND has_active_card)
        / NULLIF(COUNT(*) FILTER (WHERE account_status = 'ACTIVE'), 0),
      2
    ) AS carded_pct
  FROM customers
),
kyc_period AS (
  SELECT
    COUNT(*) FILTER (WHERE action = 'APPROVED')::bigint AS kyc_approved,
    COUNT(*) FILTER (WHERE action = 'REJECTED')::bigint AS kyc_rejected
  FROM kyc_review_audits
  WHERE created_at >= :dateFrom::timestamptz
    AND created_at < :dateToExclusive::timestamptz
),
card_kpis AS (
  SELECT COUNT(*)::bigint AS active_cards
  FROM virtual_cards
  WHERE status = 'ACTIVE'
)
SELECT
  uk.active_customers,
  uk.new_customers,
  uk.kyc_pending,
  kp.kyc_approved,
  kp.kyc_rejected,
  uk.customers_with_card,
  ck.active_cards,
  uk.carded_pct,
  uk.blocked_customers,
  uk.terminated_in_period
FROM user_kpis uk
CROSS JOIN kyc_period kp
CROSS JOIN card_kpis ck;
```

### A-chart. `[vPay] Chart — New Customers by Day`

- **Viz:** `LINE_CHART` · **Label:** `day` · **Values:** `new_customers`

```sql
SELECT
  to_char(date_trunc('day', u.created_at), 'YYYY-MM-DD') AS day,
  COUNT(*)::bigint AS new_customers
FROM users u
WHERE u.admin_user = false
  AND u.created_at >= :dateFrom::timestamptz
  AND u.created_at < :dateToExclusive::timestamptz
GROUP BY 1
ORDER BY 1 ASC;
```

### A-chart. `[vPay] Chart — KYC Mix`

- **Viz:** `PIE_CHART` · **Label:** `kyc_status` · **Value:** `users`

```sql
SELECT
  u.kyc_status::text AS kyc_status,
  COUNT(*)::bigint AS users
FROM users u
WHERE u.admin_user = false
GROUP BY 1
ORDER BY users DESC;
```

---

### B. `[vPay] Wallet Funding Insights Scorecard`

- **Description:** One-row wallet top-up KPIs. `funding_orders` scanned once with FILTER aggregates (paid vs created-period).
- **Viz:** `TABLE_ONLY` · **Params:** `:dateFrom`, `:dateTo`

```sql
WITH bounds AS (
  SELECT
    :dateFrom::timestamptz AS d_from,
    :dateToExclusive::timestamptz AS d_to
),
orders AS (
  SELECT
    fo.status,
    fo.amount_gmd,
    fo.fee_gmd,
    fo.total_gmd,
    fo.usd_estimate,
    fo.user_id,
    fo.paid_at,
    fo.created_at,
    (fo.status = 'PAID'
      AND fo.paid_at >= b.d_from
      AND fo.paid_at < b.d_to) AS is_paid_in_period,
    (fo.created_at >= b.d_from
      AND fo.created_at < b.d_to) AS is_created_in_period
  FROM funding_orders fo
  CROSS JOIN bounds b
  WHERE
    (fo.status = 'PAID' AND fo.paid_at >= b.d_from AND fo.paid_at < b.d_to)
    OR (fo.created_at >= b.d_from AND fo.created_at < b.d_to)
)
SELECT
  COALESCE(ROUND(SUM(amount_gmd) FILTER (WHERE is_paid_in_period)::numeric, 2), 0) AS paid_funding_gmd,
  COUNT(*) FILTER (WHERE is_paid_in_period)::bigint AS paid_orders,
  COALESCE(ROUND(SUM(fee_gmd) FILTER (WHERE is_paid_in_period)::numeric, 2), 0) AS funding_fee_gmd,
  COALESCE(ROUND(SUM(total_gmd) FILTER (WHERE is_paid_in_period)::numeric, 2), 0) AS gross_funding_gmd,
  COALESCE(ROUND(AVG(amount_gmd) FILTER (WHERE is_paid_in_period)::numeric, 2), 0) AS avg_ticket_gmd,
  COUNT(DISTINCT user_id) FILTER (WHERE is_paid_in_period)::bigint AS unique_funders,
  COALESCE(ROUND(SUM(usd_estimate) FILTER (WHERE is_paid_in_period)::numeric, 2), 0) AS usd_estimate,
  COUNT(*) FILTER (WHERE is_created_in_period AND status = 'PENDING')::bigint AS pending_orders,
  COUNT(*) FILTER (WHERE is_created_in_period AND status = 'FAILED')::bigint AS failed_orders,
  COUNT(*) FILTER (WHERE is_created_in_period AND status = 'CANCELLED')::bigint AS cancelled_orders,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE is_created_in_period AND status = 'PAID')
      / NULLIF(
        COUNT(*) FILTER (WHERE is_created_in_period AND status IN ('PAID', 'FAILED')),
        0
      ),
    2
  ) AS funding_success_pct
FROM orders;
```

### B-chart. `[vPay] Chart — Paid Funding Trend`

- **Viz:** `BAR_CHART` · **Label:** `day` · **Values:** `net_gmd`, `fee_gmd`

```sql
SELECT
  to_char(date_trunc('day', fo.paid_at), 'YYYY-MM-DD') AS day,
  COUNT(*)::bigint AS paid_orders,
  ROUND(SUM(fo.amount_gmd)::numeric, 2) AS net_gmd,
  ROUND(SUM(fo.fee_gmd)::numeric, 2) AS fee_gmd
FROM funding_orders fo
WHERE fo.status = 'PAID'
  AND fo.paid_at >= :dateFrom::timestamptz
  AND fo.paid_at < :dateToExclusive::timestamptz
GROUP BY 1
ORDER BY 1 ASC;
```

### B-chart. `[vPay] Chart — Funding Status Mix`

- **Viz:** `PIE_CHART` · **Label:** `status` · **Value:** `order_count`

```sql
SELECT
  fo.status::text AS status,
  COUNT(*)::bigint AS order_count,
  ROUND(SUM(fo.total_gmd)::numeric, 2) AS total_gmd
FROM funding_orders fo
WHERE fo.created_at >= :dateFrom::timestamptz
  AND fo.created_at < :dateToExclusive::timestamptz
GROUP BY 1
ORDER BY order_count DESC;
```

---

### C. `[vPay] Card Funding Insights Scorecard`

- **Description:** One-row card-fund KPIs. Single pass over `card_fund_transactions` with FILTER aggregates.
- **Viz:** `TABLE_ONLY` · **Params:** `:dateFrom`, `:dateTo`

```sql
SELECT
  COALESCE(ROUND(SUM(amount_usd) FILTER (WHERE status = 'COMPLETED')::numeric, 2), 0) AS card_fund_usd,
  COALESCE(ROUND(SUM(amount_gmd) FILTER (WHERE status = 'COMPLETED')::numeric, 2), 0) AS card_fund_gmd,
  COUNT(*) FILTER (WHERE status = 'COMPLETED')::bigint AS card_fund_count,
  COALESCE(ROUND(SUM(fee_gmd) FILTER (WHERE status = 'COMPLETED')::numeric, 2), 0) AS card_fund_fee_gmd,
  COALESCE(ROUND(AVG(amount_usd) FILTER (WHERE status = 'COMPLETED')::numeric, 2), 0) AS avg_fund_usd,
  COUNT(DISTINCT user_id) FILTER (WHERE status = 'COMPLETED')::bigint AS unique_card_funders,
  COUNT(*) FILTER (WHERE status = 'PENDING')::bigint AS pending_count,
  COUNT(*) FILTER (WHERE status = 'FAILED')::bigint AS failed_count,
  COUNT(*) FILTER (WHERE status = 'COMPLETED' AND stripe_credited)::bigint AS stripe_credited_count,
  COALESCE(ROUND(AVG(exchange_rate) FILTER (WHERE status = 'COMPLETED')::numeric, 4), 0) AS avg_fx,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE status = 'COMPLETED')
      / NULLIF(COUNT(*) FILTER (WHERE status IN ('COMPLETED', 'FAILED')), 0),
    2
  ) AS card_fund_success_pct
FROM card_fund_transactions
WHERE created_at >= :dateFrom::timestamptz
  AND created_at < :dateToExclusive::timestamptz;
```

### C-chart. `[vPay] Chart — Card Fund Trend`

- **Viz:** `LINE_CHART` · **Label:** `day` · **Values:** `amount_usd`, `amount_gmd`

```sql
SELECT
  to_char(date_trunc('day', cft.created_at), 'YYYY-MM-DD') AS day,
  COUNT(*)::bigint AS tx_count,
  ROUND(SUM(cft.amount_usd)::numeric, 2) AS amount_usd,
  ROUND(SUM(cft.amount_gmd)::numeric, 2) AS amount_gmd,
  ROUND(SUM(cft.fee_gmd)::numeric, 2) AS fee_gmd
FROM card_fund_transactions cft
WHERE cft.status = 'COMPLETED'
  AND cft.created_at >= :dateFrom::timestamptz
  AND cft.created_at < :dateToExclusive::timestamptz
GROUP BY 1
ORDER BY 1 ASC;
```

### C-chart. `[vPay] Chart — Card Fund Status Mix`

- **Viz:** `PIE_CHART` · **Label:** `status` · **Value:** `tx_count`

```sql
SELECT
  cft.status::text AS status,
  COUNT(*)::bigint AS tx_count,
  ROUND(SUM(cft.amount_usd)::numeric, 2) AS amount_usd
FROM card_fund_transactions cft
WHERE cft.created_at >= :dateFrom::timestamptz
  AND cft.created_at < :dateToExclusive::timestamptz
GROUP BY 1
ORDER BY tx_count DESC;
```

---

## Full catalog (ops + finance + risk)

| # | Report name | Category | Viz | Schedule |
|---|---|---|---|---|
| 1 | `[vPay] Daily Ops Scorecard` | OPERATIONAL | TABLE_ONLY | Hourly |
| 2 | `[vPay] Wallet Funding by Day` | FINANCIAL | LINE_CHART | Hourly |
| 3 | `[vPay] Paid Funding Summary` | FINANCIAL | BAR_CHART | Daily |
| 4 | `[vPay] Fee Income by Product / UCP` | FINANCIAL | BAR_CHART | Daily |
| 5 | `[vPay] Fee Income Net Rollup` | FINANCIAL | PIE_CHART | Daily |
| 6 | `[vPay] Card Funding by Day` | FINANCIAL | LINE_CHART | Hourly |
| 7 | `[vPay] Card Funding Success Rate` | OPERATIONAL | TABLE_ONLY | Hourly |
| 8 | `[vPay] Card Issuance Funnel` | OPERATIONAL | TABLE_ONLY | Daily |
| 9 | `[vPay] Card Issuance Paid by Day` | FINANCIAL | BAR_CHART | Daily |
| 10 | `[vPay] KYC Status Snapshot` | COMPLIANCE | PIE_CHART | Hourly |
| 11 | `[vPay] KYC Reviews & SLA` | COMPLIANCE | TABLE_ONLY | Daily |
| 12 | `[vPay] KYC Rejection Reasons` | COMPLIANCE | BAR_CHART | Weekly |
| 13 | `[vPay] Wallet Float Summary` | BALANCE | TABLE_ONLY | Daily |
| 14 | `[vPay] Top Wallet Balances` | BALANCE | TABLE_ONLY | Daily |
| 15 | `[vPay] Business Accounts Trial Balance` | RECONCILIATION | TABLE_ONLY | Daily |
| 16 | `[vPay] Journal Imbalance Check` | RECONCILIATION | TABLE_ONLY | Hourly |
| 17 | `[vPay] Journal Volume by Reference` | RECONCILIATION | PIE_CHART | Daily |
| 18 | `[vPay] Stuck Funding Orders` | OPERATIONAL | TABLE_ONLY | Hourly |
| 19 | `[vPay] Failed / Pending Card Funds` | OPERATIONAL | TABLE_ONLY | Hourly |
| 20 | `[vPay] Provisioning Failures` | OPERATIONAL | TABLE_ONLY | Hourly |
| 21 | `[vPay] FX Rate Health` | OPERATIONAL | LINE_CHART | Hourly |
| 22 | `[vPay] Latest FX Rate` | OPERATIONAL | TABLE_ONLY | Hourly |
| 23 | `[vPay] Account Lifecycle` | CUSTOMERS | TABLE_ONLY | Daily |
| 24 | `[vPay] Admin Adjustments` | RECONCILIATION | TABLE_ONLY | Daily |
| 25 | `[vPay] Multi-Account Device Risk` | AML | TABLE_ONLY | Weekly |

---

## 1. `[vPay] Daily Ops Scorecard`

- **Description:** Single-row ops KPIs for the selected period (KYC backlog, cards, float, funding, deposits, card funds).
- **Category:** `OPERATIONAL` · **Viz:** `TABLE_ONLY`
- **Params:** `:dateFrom`, `:dateTo` (uses `:dateToExclusive`)
- **Defaults:** month start → today

```sql
SELECT
  (SELECT COUNT(*)::bigint
   FROM users u
   WHERE u.admin_user = false AND u.kyc_status = 'PENDING') AS kyc_pending,
  (SELECT COUNT(*)::bigint
   FROM virtual_cards vc
   WHERE vc.status = 'ACTIVE') AS active_cards,
  (SELECT COUNT(*)::bigint
   FROM users u
   WHERE u.admin_user = false AND u.account_status = 'ACTIVE') AS active_users,
  (SELECT COALESCE(ROUND(SUM(w.balance_gmd)::numeric, 2), 0)
   FROM vpay_wallets w
   JOIN users u ON u.id = w.user_id AND u.admin_user = false) AS total_wallet_float_gmd,
  (SELECT COUNT(*)::bigint
   FROM funding_orders fo
   WHERE fo.status = 'PENDING'
     AND fo.created_at >= (:dateFrom::timestamptz - INTERVAL '7 days')) AS funding_pending_7d,
  (SELECT COUNT(*)::bigint
   FROM wallet_transactions wt
   WHERE wt.type = 'DEPOSIT'
     AND wt.created_at >= :dateFrom::timestamptz
     AND wt.created_at < :dateToExclusive::timestamptz) AS deposits_in_period,
  (SELECT COALESCE(ROUND(SUM(wt.amount_gmd)::numeric, 2), 0)
   FROM wallet_transactions wt
   WHERE wt.type = 'DEPOSIT'
     AND wt.created_at >= :dateFrom::timestamptz
     AND wt.created_at < :dateToExclusive::timestamptz) AS deposit_gmd_in_period,
  (SELECT COUNT(*)::bigint
   FROM card_fund_transactions cft
   WHERE cft.status = 'COMPLETED'
     AND cft.created_at >= :dateFrom::timestamptz
     AND cft.created_at < :dateToExclusive::timestamptz) AS card_funds_completed,
  (SELECT COALESCE(ROUND(SUM(cft.amount_usd)::numeric, 2), 0)
   FROM card_fund_transactions cft
   WHERE cft.status = 'COMPLETED'
     AND cft.created_at >= :dateFrom::timestamptz
     AND cft.created_at < :dateToExclusive::timestamptz) AS card_fund_usd_in_period;
```

---

## 2. `[vPay] Wallet Funding by Day`

- **Description:** Funding orders by day and status (amount, fee, USD estimate).
- **Category:** `FINANCIAL` · **Viz:** `LINE_CHART`
- **Label:** `day` · **Values:** `amount_gmd`, `fee_gmd`, `order_count`
- **Params:** `:dateFrom`, `:dateTo` · optional `:status[]?`

```sql
SELECT
  to_char(date_trunc('day', COALESCE(fo.paid_at, fo.created_at)), 'YYYY-MM-DD') AS day,
  fo.status,
  COUNT(*)::bigint AS order_count,
  ROUND(SUM(fo.amount_gmd)::numeric, 2) AS amount_gmd,
  ROUND(SUM(fo.fee_gmd)::numeric, 2) AS fee_gmd,
  ROUND(SUM(fo.total_gmd)::numeric, 2) AS total_gmd,
  ROUND(SUM(fo.usd_estimate)::numeric, 2) AS usd_estimate
FROM funding_orders fo
WHERE fo.created_at >= :dateFrom::timestamptz
  AND fo.created_at < :dateToExclusive::timestamptz
  [[AND fo.status IN (:status[])]]
GROUP BY 1, 2
ORDER BY 1 ASC, 2;
```

> For a clean line chart of **paid volume only**, use report 3 or filter `status = PAID` in the UI (`:status[]` = `PAID`).

---

## 3. `[vPay] Paid Funding Summary`

- **Description:** Collected (PAID) wallet top-ups by day.
- **Category:** `FINANCIAL` · **Viz:** `BAR_CHART`
- **Label:** `day` · **Values:** `net_gmd`, `fee_gmd`, `paid_orders`

```sql
SELECT
  to_char(date_trunc('day', fo.paid_at), 'YYYY-MM-DD') AS day,
  COUNT(*)::bigint AS paid_orders,
  ROUND(SUM(fo.amount_gmd)::numeric, 2) AS net_gmd,
  ROUND(SUM(fo.fee_gmd)::numeric, 2) AS fee_gmd,
  ROUND(SUM(fo.total_gmd)::numeric, 2) AS gross_gmd,
  ROUND(AVG(fo.amount_gmd)::numeric, 2) AS avg_ticket_gmd
FROM funding_orders fo
WHERE fo.status = 'PAID'
  AND fo.paid_at >= :dateFrom::timestamptz
  AND fo.paid_at < :dateToExclusive::timestamptz
GROUP BY 1
ORDER BY 1 ASC;
```

---

## 4. `[vPay] Fee Income by Product / UCP`

- **Description:** Platform fee ledger activity on FEE_INCOME accounts.
- **Category:** `FINANCIAL` · **Viz:** `BAR_CHART`
- **Label:** `day` · **Values:** `amount`
- **Optional:** `:productCode?`, `:ucpCode?`

```sql
SELECT
  to_char(date_trunc('day', bat.created_at), 'YYYY-MM-DD') AS day,
  ba.code AS business_account,
  ba.purpose::text AS purpose,
  COALESCE(bat.product_code, 'unknown') AS product_code,
  COALESCE(bat.ucp_code, 'unknown') AS ucp_code,
  bat.type::text AS txn_type,
  COUNT(*)::bigint AS txn_count,
  ROUND(SUM(bat.amount)::numeric, 2) AS amount
FROM business_account_transactions bat
JOIN business_accounts ba ON ba.id = bat.account_id
WHERE ba.purpose = 'FEE_INCOME'
  AND bat.created_at >= :dateFrom::timestamptz
  AND bat.created_at < :dateToExclusive::timestamptz
  [[AND bat.product_code = :productCode?]]
  [[AND bat.ucp_code = :ucpCode?]]
GROUP BY 1, 2, 3, 4, 5, 6
ORDER BY 1 ASC, amount DESC;
```

---

## 5. `[vPay] Fee Income Net Rollup`

- **Description:** Net fee income by product/UCP for the period (pie-friendly).
- **Category:** `FINANCIAL` · **Viz:** `PIE_CHART`
- **Label:** `product_code` · **Value:** `net_fee_income`

```sql
SELECT
  COALESCE(bat.product_code, 'unknown') AS product_code,
  COALESCE(bat.ucp_code, 'unknown') AS ucp_code,
  ROUND(SUM(CASE WHEN bat.type = 'CREDIT' THEN bat.amount ELSE 0 END)::numeric, 2) AS fee_credits,
  ROUND(SUM(CASE WHEN bat.type = 'DEBIT' THEN bat.amount ELSE 0 END)::numeric, 2) AS fee_debits,
  ROUND(
    SUM(CASE WHEN bat.type = 'CREDIT' THEN bat.amount ELSE -bat.amount END)::numeric,
    2
  ) AS net_fee_income
FROM business_account_transactions bat
JOIN business_accounts ba ON ba.id = bat.account_id
WHERE ba.purpose = 'FEE_INCOME'
  AND bat.created_at >= :dateFrom::timestamptz
  AND bat.created_at < :dateToExclusive::timestamptz
GROUP BY 1, 2
ORDER BY net_fee_income DESC;
```

---

## 6. `[vPay] Card Funding by Day`

- **Description:** GMD→USD card funding volume by day and status.
- **Category:** `FINANCIAL` · **Viz:** `LINE_CHART`
- **Label:** `day` · **Values:** `amount_gmd`, `amount_usd`, `tx_count`
- **Optional:** `:status[]?`

```sql
SELECT
  to_char(date_trunc('day', cft.created_at), 'YYYY-MM-DD') AS day,
  cft.status::text AS status,
  COUNT(*)::bigint AS tx_count,
  ROUND(SUM(cft.amount_gmd)::numeric, 2) AS amount_gmd,
  ROUND(SUM(cft.fee_gmd)::numeric, 2) AS fee_gmd,
  ROUND(SUM(cft.amount_usd)::numeric, 2) AS amount_usd,
  ROUND(AVG(cft.exchange_rate)::numeric, 4) AS avg_fx,
  COUNT(*) FILTER (WHERE cft.stripe_credited)::bigint AS stripe_credited_count
FROM card_fund_transactions cft
WHERE cft.created_at >= :dateFrom::timestamptz
  AND cft.created_at < :dateToExclusive::timestamptz
  [[AND cft.status::text IN (:status[])]]
GROUP BY 1, 2
ORDER BY 1 ASC, 2;
```

---

## 7. `[vPay] Card Funding Success Rate`

- **Description:** Completed / failed / pending counts and success %.
- **Category:** `OPERATIONAL` · **Viz:** `TABLE_ONLY`

```sql
SELECT
  COUNT(*)::bigint AS total,
  COUNT(*) FILTER (WHERE status = 'COMPLETED')::bigint AS completed,
  COUNT(*) FILTER (WHERE status = 'FAILED')::bigint AS failed,
  COUNT(*) FILTER (WHERE status = 'PENDING')::bigint AS pending,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE status = 'COMPLETED') / NULLIF(COUNT(*), 0),
    2
  ) AS success_pct
FROM card_fund_transactions
WHERE created_at >= :dateFrom::timestamptz
  AND created_at < :dateToExclusive::timestamptz;
```

---

## 8. `[vPay] Card Issuance Funnel`

- **Description:** Snapshot of paid issuance vs Stripe provisioning vs active cards.
- **Category:** `OPERATIONAL` · **Viz:** `TABLE_ONLY`
- **Params:** period used only for `cards_created_in_period`

```sql
SELECT
  COUNT(*) FILTER (WHERE u.card_issuance_paid_at IS NOT NULL)::bigint AS issuance_paid,
  ROUND(
    COALESCE(SUM(u.card_issuance_fee_usd) FILTER (WHERE u.card_issuance_paid_at IS NOT NULL), 0)::numeric,
    2
  ) AS issuance_fee_usd_lifetime,
  COUNT(*) FILTER (WHERE u.stripe_provisioning_status = 'ACTIVE')::bigint AS stripe_active,
  COUNT(*) FILTER (WHERE u.stripe_provisioning_status = 'FAILED')::bigint AS stripe_failed,
  COUNT(*) FILTER (WHERE u.stripe_provisioning_status = 'PENDING')::bigint AS stripe_pending,
  (SELECT COUNT(*)::bigint FROM virtual_cards vc WHERE vc.status = 'ACTIVE') AS active_cards,
  (SELECT COUNT(*)::bigint
   FROM virtual_cards vc
   WHERE vc.created_at >= :dateFrom::timestamptz
     AND vc.created_at < :dateToExclusive::timestamptz) AS cards_created_in_period
FROM users u
WHERE u.admin_user = false;
```

---

## 9. `[vPay] Card Issuance Paid by Day`

- **Description:** Issuance fees collected by day.
- **Category:** `FINANCIAL` · **Viz:** `BAR_CHART`
- **Label:** `day` · **Values:** `paid_issuances`, `fee_usd`

```sql
SELECT
  to_char(date_trunc('day', u.card_issuance_paid_at), 'YYYY-MM-DD') AS day,
  COUNT(*)::bigint AS paid_issuances,
  ROUND(SUM(u.card_issuance_fee_usd)::numeric, 2) AS fee_usd
FROM users u
WHERE u.admin_user = false
  AND u.card_issuance_paid_at >= :dateFrom::timestamptz
  AND u.card_issuance_paid_at < :dateToExclusive::timestamptz
GROUP BY 1
ORDER BY 1 ASC;
```

---

## 10. `[vPay] KYC Status Snapshot`

- **Description:** Current KYC funnel distribution (no date filter — live snapshot).
- **Category:** `COMPLIANCE` · **Viz:** `PIE_CHART`
- **Label:** `kyc_status` · **Value:** `users`

```sql
SELECT
  u.kyc_status::text AS kyc_status,
  COUNT(*)::bigint AS users
FROM users u
WHERE u.admin_user = false
GROUP BY 1
ORDER BY users DESC;
```

---

## 11. `[vPay] KYC Reviews & SLA`

- **Description:** Approvals/rejections by day and admin, with hours-to-decision.
- **Category:** `COMPLIANCE` · **Viz:** `TABLE_ONLY`
- **Optional:** `:action?` (`APPROVED` / `REJECTED`)

```sql
SELECT
  to_char(date_trunc('day', kra.created_at), 'YYYY-MM-DD') AS day,
  kra.action::text AS action,
  kra.admin_email,
  COUNT(*)::bigint AS reviews,
  ROUND(
    AVG(EXTRACT(EPOCH FROM (kra.created_at - u.kyc_submitted_at)) / 3600.0)::numeric,
    2
  ) AS avg_hours_to_decision
FROM kyc_review_audits kra
JOIN users u ON u.id = kra.customer_user_id
WHERE kra.created_at >= :dateFrom::timestamptz
  AND kra.created_at < :dateToExclusive::timestamptz
  [[AND kra.action::text = :action?]]
GROUP BY 1, 2, 3
ORDER BY 1 DESC, reviews DESC;
```

---

## 12. `[vPay] KYC Rejection Reasons`

- **Description:** Top rejection reasons in period.
- **Category:** `COMPLIANCE` · **Viz:** `BAR_CHART`
- **Label:** `rejection_reason` · **Value:** `cnt`

```sql
SELECT
  COALESCE(NULLIF(TRIM(kra.rejection_reason), ''), '(none)') AS rejection_reason,
  COUNT(*)::bigint AS cnt
FROM kyc_review_audits kra
WHERE kra.action = 'REJECTED'
  AND kra.created_at >= :dateFrom::timestamptz
  AND kra.created_at < :dateToExclusive::timestamptz
GROUP BY 1
ORDER BY cnt DESC
LIMIT 50;
```

---

## 13. `[vPay] Wallet Float Summary`

- **Description:** Aggregate customer wallet liability (active accounts).
- **Category:** `BALANCE` · **Viz:** `TABLE_ONLY`

```sql
SELECT
  COUNT(*)::bigint AS wallets,
  COUNT(*) FILTER (WHERE w.balance_gmd > 0)::bigint AS wallets_with_balance,
  ROUND(COALESCE(SUM(w.balance_gmd), 0)::numeric, 2) AS total_float_gmd,
  ROUND(COALESCE(AVG(w.balance_gmd), 0)::numeric, 2) AS avg_balance_gmd,
  ROUND(
    COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY w.balance_gmd), 0)::numeric,
    2
  ) AS median_balance_gmd,
  ROUND(COALESCE(MAX(w.balance_gmd), 0)::numeric, 2) AS max_balance_gmd
FROM vpay_wallets w
JOIN users u ON u.id = w.user_id
WHERE u.admin_user = false
  AND u.account_status = 'ACTIVE';
```

---

## 14. `[vPay] Top Wallet Balances`

- **Description:** Concentration risk — largest customer balances.
- **Category:** `BALANCE` · **Viz:** `TABLE_ONLY`
- **Optional:** `:limit?` (default via UI; if empty, query uses 100)

```sql
SELECT
  u.email,
  u.account_status::text AS account_status,
  u.kyc_status::text AS kyc_status,
  ROUND(w.balance_gmd::numeric, 2) AS balance_gmd
FROM vpay_wallets w
JOIN users u ON u.id = w.user_id
WHERE u.admin_user = false
  AND w.balance_gmd > 0
ORDER BY w.balance_gmd DESC
LIMIT 100;
```

---

## 15. `[vPay] Business Accounts Trial Balance`

- **Description:** Current platform account balances by entity.
- **Category:** `RECONCILIATION` · **Viz:** `TABLE_ONLY`

```sql
SELECT
  be.code AS entity,
  ba.code AS account,
  ba.currency,
  ba.purpose::text AS purpose,
  ROUND(ba.balance::numeric, 2) AS balance
FROM business_accounts ba
JOIN business_entities be ON be.id = ba.entity_id
WHERE ba.status = 'ACTIVE'
ORDER BY be.code, ba.code;
```

---

## 16. `[vPay] Journal Imbalance Check`

- **Description:** Journals where debit ≠ credit (should be empty). Alert if any rows.
- **Category:** `RECONCILIATION` · **Viz:** `TABLE_ONLY`

```sql
SELECT
  je.id,
  je.reference_type,
  je.reference_id,
  je.posted_at,
  ROUND(je.total_debit::numeric, 4) AS total_debit,
  ROUND(je.total_credit::numeric, 4) AS total_credit,
  ROUND((je.total_debit - je.total_credit)::numeric, 4) AS drift
FROM journal_entries je
WHERE je.posted_at >= :dateFrom::timestamptz
  AND je.posted_at < :dateToExclusive::timestamptz
  AND ABS(je.total_debit - je.total_credit) > 0.0001
ORDER BY je.posted_at DESC
LIMIT 500;
```

---

## 17. `[vPay] Journal Volume by Reference`

- **Description:** Posted journal volume by reference type.
- **Category:** `RECONCILIATION` · **Viz:** `PIE_CHART`
- **Label:** `reference_type` · **Value:** `entries`

```sql
SELECT
  je.reference_type,
  COUNT(*)::bigint AS entries,
  ROUND(SUM(je.total_debit)::numeric, 2) AS total_debit,
  ROUND(SUM(je.total_credit)::numeric, 2) AS total_credit
FROM journal_entries je
WHERE je.posted_at >= :dateFrom::timestamptz
  AND je.posted_at < :dateToExclusive::timestamptz
GROUP BY 1
ORDER BY entries DESC;
```

---

## 18. `[vPay] Stuck Funding Orders`

- **Description:** PENDING funding older than 30 minutes (exception queue).
- **Category:** `OPERATIONAL` · **Viz:** `TABLE_ONLY`

```sql
SELECT
  fo.id,
  fo.user_id,
  ROUND(fo.amount_gmd::numeric, 2) AS amount_gmd,
  ROUND(fo.fee_gmd::numeric, 2) AS fee_gmd,
  ROUND(fo.total_gmd::numeric, 2) AS total_gmd,
  fo.status::text AS status,
  fo.directpay_order_public_code,
  fo.created_at,
  (NOW() - fo.created_at) AS age
FROM funding_orders fo
WHERE fo.status = 'PENDING'
  AND fo.created_at < NOW() - INTERVAL '30 minutes'
ORDER BY fo.created_at ASC
LIMIT 500;
```

---

## 19. `[vPay] Failed / Pending Card Funds`

- **Description:** Card fund exceptions in the selected period.
- **Category:** `OPERATIONAL` · **Viz:** `TABLE_ONLY`
- **Optional:** `:status[]?` (default both FAILED + PENDING when omitted)

```sql
SELECT
  cft.id,
  cft.user_id,
  cft.status::text AS status,
  ROUND(cft.amount_gmd::numeric, 2) AS amount_gmd,
  ROUND(cft.amount_usd::numeric, 2) AS amount_usd,
  cft.stripe_credited,
  cft.stripe_transfer_id,
  cft.created_at
FROM card_fund_transactions cft
WHERE cft.created_at >= :dateFrom::timestamptz
  AND cft.created_at < :dateToExclusive::timestamptz
  AND (
    cft.status IN ('FAILED', 'PENDING')
    [[OR cft.status::text IN (:status[])]]
  )
ORDER BY cft.created_at DESC
LIMIT 500;
```

> Simpler fixed-status version (recommended for first paste):

```sql
SELECT
  cft.id,
  cft.user_id,
  cft.status::text AS status,
  ROUND(cft.amount_gmd::numeric, 2) AS amount_gmd,
  ROUND(cft.amount_usd::numeric, 2) AS amount_usd,
  cft.stripe_credited,
  cft.stripe_transfer_id,
  cft.created_at
FROM card_fund_transactions cft
WHERE cft.status IN ('FAILED', 'PENDING')
  AND cft.created_at >= :dateFrom::timestamptz
  AND cft.created_at < :dateToExclusive::timestamptz
ORDER BY cft.created_at DESC
LIMIT 500;
```

---

## 20. `[vPay] Provisioning Failures`

- **Description:** Customers with failed Stripe or directPay provisioning.
- **Category:** `OPERATIONAL` · **Viz:** `TABLE_ONLY`

```sql
SELECT
  u.id,
  u.email,
  u.stripe_provisioning_status::text AS stripe_provisioning_status,
  u.stripe_provisioning_error,
  u.directpay_provisioning_status::text AS directpay_provisioning_status,
  u.directpay_provisioning_error,
  u.updated_at
FROM users u
WHERE u.admin_user = false
  AND (
    u.stripe_provisioning_status = 'FAILED'
    OR u.directpay_provisioning_status = 'FAILED'
  )
ORDER BY u.updated_at DESC
LIMIT 500;
```

---

## 21. `[vPay] FX Rate Health`

- **Description:** Hourly FX sync success/fail and rate range.
- **Category:** `OPERATIONAL` · **Viz:** `LINE_CHART`
- **Label:** `hour` · **Values:** `avg_rate`, `syncs`

```sql
SELECT
  to_char(date_trunc('hour', ers.requested_at), 'YYYY-MM-DD HH24:00') AS hour,
  ers.status::text AS status,
  COUNT(*)::bigint AS syncs,
  COUNT(*) FILTER (WHERE ers.catalog_updated)::bigint AS catalog_updates,
  ROUND(AVG(ers.rate)::numeric, 4) AS avg_rate,
  ROUND(MIN(ers.rate)::numeric, 4) AS min_rate,
  ROUND(MAX(ers.rate)::numeric, 4) AS max_rate
FROM exchange_rate_snapshots ers
WHERE ers.requested_at >= :dateFrom::timestamptz
  AND ers.requested_at < :dateToExclusive::timestamptz
GROUP BY 1, 2
ORDER BY 1 ASC;
```

---

## 22. `[vPay] Latest FX Rate`

- **Description:** Most recent successful GMD/USD (or configured pair) rate.
- **Category:** `OPERATIONAL` · **Viz:** `TABLE_ONLY`

```sql
SELECT
  rate,
  previous_rate,
  base_currency,
  target_currency,
  requested_at,
  source_updated_at_utc,
  catalog_updated
FROM exchange_rate_snapshots
WHERE status = 'SUCCESS'
  AND rate IS NOT NULL
ORDER BY requested_at DESC
LIMIT 1;
```

---

## 23. `[vPay] Account Lifecycle`

- **Description:** Active / blocked / terminated counts and period churn.
- **Category:** `CUSTOMERS` · **Viz:** `TABLE_ONLY`

```sql
SELECT
  u.account_status::text AS account_status,
  COUNT(*)::bigint AS users,
  COUNT(*) FILTER (
    WHERE u.blocked_at >= :dateFrom::timestamptz
      AND u.blocked_at < :dateToExclusive::timestamptz
  )::bigint AS blocked_in_period,
  COUNT(*) FILTER (
    WHERE u.terminated_at >= :dateFrom::timestamptz
      AND u.terminated_at < :dateToExclusive::timestamptz
  )::bigint AS terminated_in_period
FROM users u
WHERE u.admin_user = false
GROUP BY 1
ORDER BY users DESC;
```

---

## 24. `[vPay] Admin Adjustments`

- **Description:** Wallet adjustments and admin control references.
- **Category:** `RECONCILIATION` · **Viz:** `TABLE_ONLY`

```sql
SELECT
  wt.type::text AS type,
  COALESCE(wt.reference_type, '(none)') AS reference_type,
  to_char(date_trunc('day', wt.created_at), 'YYYY-MM-DD') AS day,
  COUNT(*)::bigint AS tx_count,
  ROUND(SUM(wt.amount_gmd)::numeric, 2) AS amount_gmd
FROM wallet_transactions wt
WHERE wt.created_at >= :dateFrom::timestamptz
  AND wt.created_at < :dateToExclusive::timestamptz
  AND (
    wt.type = 'ADJUSTMENT'
    OR wt.reference_type IN (
      'admin_wallet_zero',
      'admin_card_issuance',
      'card_fund_reversal',
      'card_issuance_reversal'
    )
  )
GROUP BY 1, 2, 3
ORDER BY 3 DESC;
```

---

## 25. `[vPay] Multi-Account Device Risk`

- **Description:** Devices used by more than one user in a month (AML signal).
- **Category:** `AML` · **Viz:** `TABLE_ONLY`
- **Params:** uses `:dateFrom` month (`YYYY-MM`)

```sql
SELECT
  dmu.device_group_key,
  dmu.year_month,
  COUNT(DISTINCT dmu.user_id)::bigint AS distinct_users
FROM device_monthly_users dmu
WHERE dmu.year_month = to_char(:dateFrom::timestamptz, 'YYYY-MM')
GROUP BY 1, 2
HAVING COUNT(DISTINCT dmu.user_id) > 1
ORDER BY distinct_users DESC
LIMIT 200;
```

---

## Suggested dashboard layout (vPay)

**Primary:** use the three Insight dashboards in section **Insight dashboards (KPIs first)** (Customer / Wallet Funding / Card Funding).

**Secondary ops board** (from full catalog):

```
Row 1 — Ops strip
  • KYC Pending | Active Cards | Wallet Float GMD | Deposits in Period

Row 2 — Money movement
  • Paid Funding Summary (BAR) | Fee Income Net Rollup (PIE)

Row 3 — Conversion & health
  • Card Funding by Day (LINE) | FX Rate Health (LINE)

Row 4 — Exceptions
  • Stuck Funding Orders (TABLE) | Failed / Pending Card Funds (TABLE)
```

## Builder checklist

1. Point the data source at the **vPay Postgres** database (read-only role recommended).
2. Create each Saved Report with name / category / visualization from the catalog.
3. Enable the date filter when SQL contains `:dateFrom` / `:dateTo` / `:dateToExclusive`.
4. For charts, keep **label as first column** and numerics after.
5. Schedule ops/exceptions hourly; P&L and float daily; device risk weekly.
6. Prefer FEE_INCOME ledger reports (#4–5) over reconstructing fees from customer wallet lines.
