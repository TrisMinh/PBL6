# Real data with the original BLUE interface

**Goal:** Run the existing polished interface against persistent backend data and SePay, without replacing any screen or changing its layout, styles, images or motion.

**Specification:** User request in this chat: all mock data and actions become real; the interface remains identical. Supersedes the earlier instruction to postpone API integration.

**Architecture:** Retain the presentation components from `0c9cf258` and adapt their existing repository interfaces to the domain APIs. Backend is the authority for identity, inventory, bookings, payment confirmation, ticket issue, cancellation and refunds. Static editorial copy and artwork remain presentation assets. Do not fabricate ratings, discounts, stock or payment confirmations.

**Tech stack:** React/React Query/Zod, ASP.NET services, PostgreSQL, RabbitMQ, SePay checkout/IPN.

## Tasks and ownership

- [ ] Public catalogue: original home/explore/results screens, live locations/routes/trips, real stock and filtering. Worker `live_catalog_original_ui` owns those frontend directories and Transport service.
- [ ] Account lifecycle: original auth/profile/preferences/ticket/lookup/cancellation screens, persistent personal data and ownership-checked tickets. Worker `live_account_tickets` owns those frontend directories and Identity/Booking ticket endpoints.
- [ ] Operator/admin: original screens and forms with domain API adapters for list, read and mutation. Worker `live_operator_admin` owns those frontend directories/routes.
- [ ] Payment and booking consistency: root owns Payment service, booking hold/create adapter, original checkout/summary/result UI and SePay action/confirmation, shared API/configuration and startup.
- [ ] Integration: remove live-mode alternate-screen routing; no MSW activation in live runtime, no fixture fallback. Maintain mock tests as isolated automated test tools only.
- [ ] Verification: focused repository/service tests, TypeScript/lint, build all portals; inspect public search, account, booking and SePay handoff in browser; confirm persistence/security/failure behavior. Commit/push only verified changes.

## Invariants

- No database reset or loss of existing data.
- No secrets in logs, source, frontend bundles or commits.
- No ticket issued from a browser success parameter or user-selected test outcome.
- Idempotent payment and booking requests; server-confirmed payment amount, ownership, stock and hold expiry.
- SePay Sandbox remains the configured provider environment until the user explicitly configures Production; local persisted operations are real, Sandbox charges are not real-money transactions.
- If backend lacks a capability, implement the domain capability or show the original error/empty state; never manufacture a successful result.

## Progress evidence

- Backend services started without resetting databases. Transport database contains 2 organizations, 26 routes, 352 trips and 1352 seat records.
- Root cause of prior UI regression confirmed: route components selected a second set of `Backend*`/`Live*` screens when API_MODE=live.
