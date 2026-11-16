# Coupons — live booking contract

Existing visual coupon cards and dialogs are retained. Live offers are read from the booking database, never generated from operator names or ratings.

- `GET /api/v1/trips/{tripId}/coupons`: public array of active, started, unexpired global or matching-organization coupons. Fields: code, percent (1–90), cap (VND), minimum (VND), organizationId (nullable), startsAt/expiresAt (UTC), active.
- `PUT /api/v1/admin/coupons`: PLATFORM_ADMIN only. Validates and creates/updates the above rule. No discounts or quotas are inferred from mock fixtures. One rule per code, one code per booking; existing orders keep their saved price when rules change.
- `POST /api/v1/coupons/quote`: authenticated `{holdToken, code}`. Owner and active hold required. Returns `{code, subtotal, discount, total, currency, expiresAt}`. Quote is advisory: expiry is capped by coupon and hold expiry. Invalid/expired/not-started/disabled/wrong-organization/below-minimum codes fail validation; foreign holds return 404.
- `POST /api/v1/bookings`: existing request adds optional `couponCode`. `expectedTotal` must equal the server-computed discounted total. Rules are rechecked and locked during the transaction. Invalid codes never silently fall back to full-price booking. Existing idempotency applies.
- Booking read/list adds nullable `couponCode`; existing subtotal/discount/total now persist real values. VND discount = min(cap, floor(subtotal * percent / 100)). Original unit price and allocated item discount are saved. Per-ticket net values sum exactly to order total, including rounding remainder.
- Payment and SePay use the saved booking total through the existing BookingCreated event. IPN still requires exact amount/currency and server authentication before tickets issue. Cancellation uses each ticket's paid net amount; coupon does not inflate refunds.

Migration: `docs/database/booking/002_coupons.sql`, additive and applied by Booking's migrator. No production campaigns are auto-created. The local campaign is created explicitly through the admin endpoint for functional verification.

The frontend caches live campaign lists briefly, displays the existing conditions/copy dialog, and accepts a code at review. It obtains a server quote before showing a reduction. Changing held seats clears the quote. A definitive rejected booking permits changing the coupon with a new idempotency attempt; an ambiguous network failure keeps the original attempt locked for safe retry.

## Verified locally

- Booking integration suite: 15 passed, including six coupon eligibility and financial cases with a real PostgreSQL test container.
- SePay booking suite: four passed (with/without coupons, including late payment compensation). Runs real booking/payment handlers and authenticated controlled sandbox IPN; does not claim a live bank transfer.
- Browser on port 5180: offer dialog and code selection, apply/remove, invalid code rejection, persistence across reload, responsive review, and created booking subtotal 396000 / discount 50000 / total 346000. The browser payment request was stopped before leaving for hosted checkout; the financial propagation is covered by the service integration suite.
- Postman collection: four local HTTP requests, five assertions passed (public eligible list, anonymous quote denied, hold ownership, customer cannot create coupons).
- Local process topology during development: FE 5180 -> gateway 5188 -> Booking 5183 (same existing development PostgreSQL and RabbitMQ). Other services remain on existing local Docker ports. No Docker images rebuilt for these edits.
