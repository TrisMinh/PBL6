# Separated Travel v3 Webs Implementation Plan

> For agentic workers: use superpowers:subagent-driven-development or executing-plans. User authorizes continuous execution without further approval.

**Goal:** Separate and complete Customer, Operator, Admin mock frontend experiences.
**Architecture:** Three app wrappers, shared BLUE implementation, isolated route manifests and session origins, explicit demo-first runtime.
**Tech Stack:** React Router 8, React 19, TypeScript, Vite, MSW, pnpm 10.34.7, Node 24.22.0.
**Spec:** ../specs/2026-11-15-separated-mock-webs-design.md

## Global constraints
- Travel v3 is canonical; reuse existing visual assets/primitives.
- No backend dependency for demo; no real OAuth/payment claims.
- Preserve previous removal of legacy backoffice and do not modify source branches.
- Separate routing/builds; no combined customer/operator/admin deployment.

## Review focus
- Staff/customer URLs cannot cross into another application's screen.
- Login, logout and intended redirects remain within their app.
- Mock state survives appropriate navigation and relationships remain consistent.
- Deep links, empty/error states, keyboard focus and small screens work.
- Production demo builds initialize mocks; live mode remains explicit.

### Task 1: App architecture (root agent)
- [x] Write failing route-isolation/default-runtime checks.
- [x] Add shared app target configuration and route manifests, three independent wrappers/config/build paths, staff login/landing.
- [x] Update workspace scripts, runtime MSW initialization, Docker/documentation to selected app builds.
- [x] Verify route isolation and each app typegen/build/start.

### Task 2: Customer completion (customer worker)
- [x] Inspect Figma auth/payment contexts and existing mock flows.
- [x] Improve complete visible social login and checkout flow; diverse mock booking/payment/ticket/cancellation scenarios.
- [x] Fix customer-specific regression tests/styles and test new behavior before implementation.
- [x] Verify focused tests, responsive browser customer journey.

### Task 3: Operator completion (operator worker)
- [x] Inventory all mock screens and dead navigation/actions.
- [x] Complete organization/member and settlement navigation/screens where missing using existing shell; functional mock actions and richer connected data.
- [x] Test route-independent feature behavior, resource workflows and states.

### Task 4: Baseline quality (quality worker)
- [x] Diagnose known 21 lint and 16 test failures without weakening legitimate assertions.
- [x] Own shared generic live code lint, shared layout/focus, route tests, SEO/newline test, updated payment cache test, token regressions outside customer-owned files.
- [x] Run focused checks and report root causes.

### Task 5: Integration, admin and acceptance (root agent)
- [x] Verify admin mock organization/staff/transactions dialogs, filters, states and fixture diversity; fill missing behavior.
- [x] Run complete typecheck/lint/unit/build matrix, browser responsive/flow/axe and separated app smoke.
- [x] Independent review, fix findings, document commands/accounts/mock scenarios and precise acceptance results.

## Acceptance ledger

User clarified desktop web only; no native mobile changes. See docs/implementation/2026-11-15-desktop-fe-delivery.md for exact test evidence. Review completed by root across app separation, mock lifecycle, persistence and production artifacts; no push/deploy.
