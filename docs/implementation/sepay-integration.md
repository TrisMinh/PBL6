# SePay Payment Gateway integration

BLUE uses **SePay Payment Gateway**, with merchant ID + merchant Secret Key, not the balance-webhook API token product.

## Configuration

Copy the missing entries from the root `.env.example` into your local `.env` (keep existing settings). Never commit credentials. Configure:

```dotenv
SEPAY_ENVIRONMENT=sandbox
SEPAY_MERCHANT_ID=<Sandbox Merchant ID>
SEPAY_SECRET_KEY=<Sandbox merchant Secret Key>
SEPAY_IPN_SECRET_KEY=<independent random secret configured in SePay IPN>
CUSTOMER_PUBLIC_ORIGIN=https://your-public-customer-host
```

Merchant and IPN keys are **different**. In SePay → Cổng thanh toán → Cấu hình → IPN:

- URL: `https://your-public-customer-host/integrations/payments/sepay/ipn`
- Auth type: `SECRET_KEY`
- Secret: same value as `SEPAY_IPN_SECRET_KEY`.
- Enable notifications. Sandbox keys and live keys are separate.

The customer Nginx forwards this exact IPN path to the API gateway. A separate public API host can also expose the same path. Localhost is not reachable from SePay: use an HTTPS deployment or tunnel and set `CUSTOMER_PUBLIC_ORIGIN` to that public customer URL. Browser callbacks and the IPN both need reachable URLs. No IPN key belongs in a query string.

Run from the repository root (Docker Desktop running):

```powershell
docker compose --env-file .env -f workspace/src/infra/docker-compose.yml -f workspace/src/infra/docker-compose.apps.yml up -d --build --wait
```

Customer: port 5173, operator: 5174, admin: 5175. The SePay overlay compiles **all three portals in live API mode**. The ordinary apps compose continues to support the standalone mock demo.

For native `dotnet run`, `.env` is not loaded automatically: use environment variables `SePay__Environment`, `SePay__MerchantId`, `SePay__SecretKey`, `SePay__IpnSecretKey`, `SePay__CustomerOrigin` (or .NET user-secrets). Existing database, RabbitMQ, JWT, and gateway settings must also be configured. The default Docker and native startup configurations do not start the legacy simulator. Legacy payment IDs and database migrations are retained for transaction history. For the customer Vite process:

```dotenv
VITE_API_MODE=live
VITE_API_BASE_URL=http://localhost:5080
VITE_PAYMENT_PROVIDER=sepay
```

Set `VITE_API_MODE=live` for operator/admin too. Mock accounts, trips, tickets and bookings stored by the standalone demo are not backend records: log in/register against the live backend and use a backend-published trip. Do not mix mock bookings with provider payments.

## Contract and data flow

1. Booking service reserves the actual seats, creates a PREPAID booking, and publishes `BookingCreated`; payment service consumes the server-owned total/expiry into its quote.
2. Customer calls `POST /api/v1/bookings/{bookingId}/payments`, authenticated, with an `Idempotency-Key` and `{ provider: "SEPAY", method: "BANK_TRANSFER", returnUri: "..." }`. Price, currency, customer and expiry come from the backend. SePay callback URLs come exclusively from `SePay:CustomerOrigin`; the supplied return URI cannot redirect customers to an arbitrary host.
3. Response contains `providerAction.type = FORM_POST`, SePay `actionUrl` and signed form fields. Browser submits those fields in order by POST to SePay. No merchant/IPN secret is returned. Checkout is `https://pay-sandbox.sepay.vn/v1/checkout/init` (sandbox) or `https://pay.sepay.vn/v1/checkout/init` (production).
4. SePay displays its hosted checkout/real provider QR. BLUE does not manufacture a QR illustration and pretend it is payable. Only `BANK_TRANSFER` is enabled by default; NAPAS/card require merchant activation and backend method configuration.
5. SePay POSTs IPN JSON with `X-Secret-Key` to `/integrations/payments/sepay/ipn`. Handler validates authentication, invoice, provider, both amounts/currencies, CAPTURED + APPROVED + PAYMENT state, and transaction identity. A paid browser redirect alone cannot confirm anything.
6. Receipt deduplication, capture, settlement and `PaymentSucceeded` outbox commit in **one PostgreSQL transaction**. Concurrent duplicates emit one event. Failed commits roll back the receipt so provider retries can recover. A transaction cannot be applied to another invoice.
7. Existing RabbitMQ outbox relay delivers `PaymentSucceeded` to booking. Booking validates total/currency, status, seat ownership and deadline. Booking PAID state, ticket creation and BookingPaid/TicketIssued outbox commit together. Customer ticket API, operator manifest and reporting/notification consumers use these records/events.
8. `/payment/sepay/return?bookingId=...` polls authenticated backend status and `/api/v1/bookings/{id}/tickets`. It only displays success/ticket links after tickets actually exist. The `status` query string is never trusted. Missing/late IPN remains pending and offers status recheck; browser returning does not manufacture a successful payment.

## Failure and refund behavior

- Missing credentials: refuse checkout before creating a payment; no dummy secret fallback.
- Wrong secret, amount, currency, provider, failed transaction: no capture or ticket.
- Failed/cancelled payment on an unexpired booking: new attempt has a new invoice; history remains readable. Late callbacks resolve their original invoice.
- Expired/closed booking or stale seat ownership: do not issue tickets. A captured late payment is recorded and its refund is **REQUESTED / REFUND_PENDING**, not falsely marked returned.
- SePay cancellation refunds use the explicit `RefundRequested` event with an event-based deduplication reference. `BookingCancelled` alone cannot invent a full refund or bypass the cancellation fee.
- After confirming a cancellation, the customer can open **Theo dõi hoàn tiền** as soon as the refund record arrives. The same links are available from the cancelled ticket. `GET /api/v1/refunds?bookingId=...` lists refunds only for the customer who owns that booking.
- For a paid bank transfer in the current Payment Gateway flow, platform finance verifies the recipient and amount against the original payment, makes the transfer through the bank, then opens **Admin → Hoàn tiền → Chi tiết → Ghi nhận hoàn tiền**. Enter the actual bank transfer reference. The platform records the money as returned only after this confirmation. SePay's separate API v2 refund integration uses its own token and eligible linked bank account. [SePay Payment Gateway](https://developer.sepay.vn/vi/agents/cli/cong-thanh-toan) · [SePay API v2 refunds](https://developer.sepay.vn/vi/sepay-api/v2/hoan-tien)
- `PUT /api/v1/admin/refunds/{refundId}/transfer` commits the refund, payment and settlement together and emits the completion event. Replay with the same refund, amount and reference is safe. Reusing a transfer reference on another refund is rejected. The audit record retains the confirming staff member and transfer reference.
- A void after capture/additional capture opens a reconciliation case without silently downgrading paid state or reissuing tickets.
- If an IPN is missed, **Kiểm tra giao dịch** can look up the invoice with SePay. Payment also checks eligible invoices automatically starting one minute after local creation. It repeats at most once a minute while the invoice is active, every ten minutes during the first hour after expiry, and every four hours thereafter until 24 hours after expiry. Both entry points share the database claim and the IPN capture transaction. Manual checks have a 30-second cooldown.
- A lookup that cannot verify a capture leaves the local payment status unchanged. For invoices outside the 24-hour window, use the manual check or the operator's reconciliation process. To disable scheduled lookups, set `SEPAY_AUTOMATIC_RECONCILIATION_ENABLED=false` for Docker or `SePay__AutomaticReconciliationEnabled=false` for a native process.

## Verification

Backend tests run real PostgreSQL and both payment/booking HTTP hosts. Cross-service tests read persisted outbox envelopes and invoke the production event consumers explicitly; they do not substitute ticket/payment repositories. This establishes consumer/state correctness, not a live RabbitMQ or real SePay delivery.

```powershell
dotnet test workspace/src/tests/payment/BusTicketPlatform.Payment.Api.IntegrationTests
dotnet test workspace/src/tests/booking/BusTicketPlatform.Booking.Api.IntegrationTests
```

Coverage includes a two-seat booking → IPN → two QR tickets → cancellation → customer refund tracking → finance transfer confirmation → booking and settlement update. It verifies tenant access, duplicate deliveries, delayed captures, and replay of the confirmation using a test bank reference.

Frontend tests check POST target allowlisting, signed field transport, pending/refund states, actual ticket links, and ignoring forged success URL parameters.

The actual provider Sandbox run described below verifies credential compatibility, callback reachability and provider delivery for the configured Sandbox merchant. Production merchant activation and real-money transactions have not been performed.

Official references: [checkout form/signature](https://developer.sepay.vn/vi/cong-thanh-toan/API/don-hang/form-thanh-toan), [IPN authentication and payload](https://developer.sepay.vn/vi/cong-thanh-toan/IPN), [Sandbox hosts and setup](https://developer.sepay.vn/vi/cong-thanh-toan/sandbox).

### Local verification completed

- Payment/SePay integration: 25 passing tests (including both payment and booking HTTP hosts with real PostgreSQL, legacy database migration and retry after a checkout database failure).
- Booking regression: 8 passing tests.
- Frontend: 1,466 passing tests across 183 files; full ESLint and customer TypeScript check passed.
- Customer, operator and admin production builds passed with `VITE_API_MODE=live`.
- Saved Postman collection: 6 HTTP requests / 7 assertions passed against an isolated local payment API and PostgreSQL; no real provider transaction was sent. Run events were not published to Postman cloud.
- Compose SePay overlay validates; test HTTP service and its disposable verification database were stopped after checks.

Orbit discovery did not return a matching SePay endpoint; implementation uses the official SePay checkout/IPN/Sandbox specifications linked above. No provider credentials or private account data are included in the committed contract/example files.

### Actual SePay Sandbox verification — 2026-11-16

- Configured Sandbox IPN URL, `X-Secret-Key` authentication and JSON delivery in the merchant dashboard. Secrets remain in ignored root `.env`.
- Used the real customer UI, hosted SePay Sandbox checkout and its **Giả lập thanh toán** button for a fictional 150,000 VND booking. No real money was transferred.
- Provider IPN arrived through Cloudflare Tunnel; the receipt is `PROCESSED`, payment `SUCCEEDED`, booking `PAID`, and ticket `TK18DA882C142D` is `ISSUED` (seat 2B). Booking ID: `01a1e2f2-710b-753e-ac7b-6d07ea57650d`.
- Verified the operator manifest API contains that ticket ID and fictional passenger, payment settlement exists, and reporting projection is `PAID`, 150,000 VND, one seat. This run uses the actual RabbitMQ delivery between running Docker services.
- Opened the issued ticket in the browser and confirmed the QR and passenger data. Evidence: [result](sepay-live-verification/sandbox-success.jpg), [ticket](sepay-live-verification/issued-ticket.jpg).
- Preserved the existing local Docker database history. The compatibility migration restores the missing payment organization column from quote/settlement records.

Start the complete local platform and HTTPS tunnel from the repository root:

```powershell
.\scripts\start-sepay-local.ps1
# Reuse built images:
.\scripts\start-sepay-local.ps1 -NoBuild
# Repair the tunnel while Customer and Payment are already running:
.\scripts\start-sepay-local.ps1 -RefreshTunnelOnly
```

Customer: `http://localhost:5173`; operator: `http://localhost:5174`; admin: `http://localhost:5175`. The local overlay uses alternate host database/broker ports to coexist with native Windows services.

Leave Docker Desktop and the tunnel process running for IPN delivery. The repair command checks the public health endpoint, creates a new Quick Tunnel when the saved URL is unreachable, and reloads Payment without restarting the other containers. Update the IPN URL in SePay Sandbox to the URL printed by the script when it changes. The checkout form uses the new origin the next time it is opened. If an already-open checkout returns to an expired hostname, reopen the existing booking on the local website to check its payment status before retrying. The current tunnel process is recorded in ignored `.env.sepay-runtime.json`.

When `CUSTOMER_PUBLIC_ORIGIN` in `.env` points to a Quick Tunnel, `scripts/start-frontend.ps1` also runs the sandbox tunnel refresh after Customer Web starts. To reopen a payment result locally, use `http://localhost:5173/payment/sepay/return?bookingId=<booking-id>` in the customer browser session.
