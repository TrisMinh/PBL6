# PBL6 API Round 2 and Production Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the PBL6 MVP into conformance with all SRS 2.1.0 `MUST` requirements, produce a reproducible Postman Round 2 result that exceeds Round 1, and leave a deployment-ready Docker baseline with traceable evidence.

**Architecture:** Preserve the existing .NET 10 microservice boundaries and React/React Native clients. Treat the SRS/OpenAPI/Postman artifacts as the external contract, fix behavior service-by-service with regression tests, and validate cross-service workflows against a freshly built Docker stack. Keep post-MVP `SHOULD` features disabled unless already complete.

**Tech Stack:** .NET 10, ASP.NET Core minimal APIs, PostgreSQL 17, RabbitMQ 4.1, Redis 7, React/TypeScript, React Native/Expo, Docker Compose, Postman CLI 1.80, XLSX report generated with `@oai/artifact-tool`.

**Spec:** `docs/srs/v2/README.md` and its linked SRS 2.1.0 chapters; API contract in `docs/contracts/openapi/platform-mvp.openapi.yaml`.

## Global Constraints

- All 61 SRS 2.1.0 functional requirements marked `MUST` are MVP scope; `SHOULD` and `COULD` do not block MVP.
- Backend remains C#/.NET 10; web remains React + TypeScript; mobile remains React Native + TypeScript.
- Tenant boundaries, ownership checks, idempotency, state machines, auditability, and error-envelope consistency are release gates.
- No test report row becomes `Passed` without a saved Postman assertion log from the rebuilt Docker stack.
- Round 2 must exceed the Round 1 baseline of 330/419 passed assertions (78.76%) and must report unresolved failures honestly.
- No production secret is committed; production deployment requires explicit secret injection and non-development defaults.

## Review Focus

- Replayed requests and duplicate provider callbacks must be idempotent and must not duplicate bookings, payments, tickets, refunds, or events.
- Expired holds/bookings/challenges and late callbacks must converge to the SRS state machine without reopening inventory or issuing tickets incorrectly.
- Cross-tenant and cross-owner resource access must be denied or concealed consistently without leaking existence.
- Invalid page bounds, reversed date ranges, malformed nested request data, and invalid state transitions must return a documented 4xx envelope, never 500 or silent success.
- A clean database and a reused database must both produce deterministic Docker/Postman runs; tests may not rely on stale synthetic state.

---

### Task 1: Deterministic Round 2 runner and evidence baseline

**Files:**
- Create: `workspace/scripts/run-postman-round2.ps1`
- Create: `workspace/postman/round2-suite.json`
- Modify: `workspace/postman/PBL6_Local.postman_environment.json`
- Test: `workspace/postman/runs/round2-*.log`

**Interfaces:**
- Consumes: Docker gateway at `http://localhost:5080`, committed Postman collections, local environment file.
- Produces: ordered suite execution, per-collection logs, machine-readable assertion totals, and failed-case inventory.

- [ ] Write runner contract tests/dry-run checks for collection existence, unique order, writable evidence paths, and non-zero exit on failed assertions.
- [ ] Run the checks and verify they fail because the deterministic runner does not exist.
- [ ] Implement the smallest runner that validates readiness, runs collections in declared order, persists CLI output and JUnit/JSON evidence, and summarizes pass/fail counts.
- [ ] Run a clean baseline against the current Docker stack and classify every failure as product defect, test-data defect, or contract mismatch.
- [ ] Commit the runner, manifest, and baseline inventory without committing secrets.

### Task 2: Identity, authorization, validation, and rate-limit conformance

**Files:**
- Modify: `workspace/src/services/identity/BusTicketPlatform.Identity.Application/AuthService.cs`
- Modify: `workspace/src/services/identity/BusTicketPlatform.Identity.Application/AdminIdentityService.cs`
- Modify: `workspace/src/services/identity/BusTicketPlatform.Identity.Application/ProfileService.cs`
- Modify: `workspace/src/services/identity/BusTicketPlatform.Identity.Infrastructure/Persistence/IdentityRepository.cs`
- Modify: `workspace/src/services/identity/BusTicketPlatform.Identity.Api/IdentityEndpoints.cs`
- Test: `workspace/src/tests/identity/BusTicketPlatform.Identity.Api.IntegrationTests/*.cs`

**Interfaces:**
- Consumes: SRS FR-IAM-001..009, AUTHZ rules, shared JWT/error envelope.
- Produces: deterministic duplicate detection, challenge expiry, lock/unlock, profile optimistic concurrency, role replacement, and anti-enumeration/rate-limit behavior.

- [ ] Add failing integration tests for duplicate email/phone, expired verification, resend/forgot throttling, admin lock/unlock/role replace, and profile version update.
- [ ] Run focused identity tests and confirm each new test fails for the expected behavior gap.
- [ ] Implement minimal application/repository/API changes and consistent status/error mappings.
- [ ] Run identity tests, then the full .NET suite.
- [ ] Re-run identity/security Postman collections and record Round 2 evidence.

### Task 3: Transport lifecycle, tenant isolation, and input validation

**Files:**
- Modify: `workspace/src/services/transport/BusTicketPlatform.Transport.Application/TransportService.cs`
- Modify: `workspace/src/services/transport/BusTicketPlatform.Transport.Infrastructure/Persistence/TransportRepository.cs`
- Modify: `workspace/src/services/transport/BusTicketPlatform.Transport.Api/TransportEndpoints.cs`
- Test: `workspace/src/tests/transport/BusTicketPlatform.Transport.Api.IntegrationTests/TransportFlowTests.cs`

**Interfaces:**
- Consumes: SRS FR-SEARCH, FR-OPS, trip state transitions, organization/driver JWT claims.
- Produces: bounded search, valid stop/driver/license rules, legal trip transitions, assignment-aware driver operations, and tenant-safe CRUD.

- [ ] Add failing tests for page limits, duplicate stop sequence, expired driver license, overlapping assignments, driver assignment authorization, legal/illegal transitions, and hard-delete rejection.
- [ ] Verify focused tests fail for the intended gaps.
- [ ] Implement validation and state/tenant guards in application and persistence layers.
- [ ] Run transport tests and full .NET suite.
- [ ] Re-run transport/trip/driver/search Postman collections and record Round 2 evidence.

### Task 4: Booking, seat-hold, ticket, and cancellation state correctness

**Files:**
- Modify: `workspace/src/services/booking/BusTicketPlatform.Booking.Application/BookingService.cs`
- Modify: `workspace/src/services/booking/BusTicketPlatform.Booking.Infrastructure/Persistence/BookingRepository.cs`
- Modify: `workspace/src/services/booking/BusTicketPlatform.Booking.Infrastructure/BookingEventHandlers.cs`
- Modify: `workspace/src/services/booking/BusTicketPlatform.Booking.Api/BookingEndpoints.cs`
- Test: `workspace/src/tests/booking/BusTicketPlatform.Booking.Api.IntegrationTests/BookingFlowTests.cs`

**Interfaces:**
- Consumes: trip/inventory events, SRS FR-BOOK, FR-TICKET, cancellation policies, authenticated customer/driver identity.
- Produces: atomic multi-seat holds, passenger validation, idempotent booking creation, correct expiry/release, opaque QR, assignment-aware check-in, and cancellation preview/acceptance.

- [ ] Add failing tests for multi-seat atomicity, concurrent hold, passenger/cardinality validation, supported channels, server totals, PAY_LATER idempotency, expiry, ownership concealment, QR secrecy, check-in trip/assignment rules, and cancellation state guards.
- [ ] Verify focused tests fail for the intended gaps.
- [ ] Implement minimal state, validation, ownership, and persistence changes.
- [ ] Run booking tests and full .NET suite.
- [ ] Re-run booking/ticket/cancellation Postman collections and record Round 2 evidence.

### Task 5: Payment verification, late callback compensation, refunds, and settlement

**Files:**
- Modify: `workspace/src/services/payment/BusTicketPlatform.Payment.Application/PaymentService.cs`
- Modify: `workspace/src/services/payment/BusTicketPlatform.Payment.Application/VnPayCheckout.cs`
- Modify: `workspace/src/services/payment/BusTicketPlatform.Payment.Infrastructure/Persistence/PaymentRepository.cs`
- Modify: `workspace/src/services/payment/BusTicketPlatform.Payment.Infrastructure/PaymentEventHandlers.cs`
- Modify: `workspace/src/services/payment/BusTicketPlatform.Payment.Api/PaymentEndpoints.cs`
- Modify: `workspace/src/services/reporting/BusTicketPlatform.Reporting.Infrastructure/ReportingEventHandlers.cs`
- Test: `workspace/src/tests/payment/BusTicketPlatform.Payment.Api.IntegrationTests/PaymentFlowTests.cs`
- Test: `workspace/src/tests/reporting/BusTicketPlatform.Reporting.Api.IntegrationTests/*.cs`

**Interfaces:**
- Consumes: booking lifecycle events, signed VNPay simulator callbacks, SRS FR-PAY-001..013 and reporting rules.
- Produces: amount/currency/signature validation, pending-before-webhook state, idempotent success, compensation for late success, bounded refunds, commission/payable reversal, and settlement read models.

- [ ] Add failing tests for mismatched amount/currency/signature, no-webhook pending state, duplicate success, late success after expiry, refund ceiling/idempotency, and settlement reversal.
- [ ] Verify focused tests fail for the intended gaps.
- [ ] Implement payment/refund/settlement convergence with transactional outbox semantics already used by the project.
- [ ] Run payment/reporting tests and full .NET suite.
- [ ] Re-run payment/refund/settlement Postman collections and record Round 2 evidence.

### Task 6: Shared API hardening and SRS traceability closure

**Files:**
- Modify: `workspace/src/building-blocks/BusTicketPlatform.BuildingBlocks.AspNetCore/Http/ErrorEnvelopeMiddleware.cs`
- Modify: `workspace/src/building-blocks/BusTicketPlatform.BuildingBlocks.AspNetCore/Http/PlatformHttp.cs`
- Modify: `docs/contracts/openapi/platform-mvp.openapi.yaml`
- Modify: `docs/implementation/04-mvp-traceability.md`
- Modify: `docs/detailed-design/03-06-test-design/08-requirement-coverage-register.md`
- Test: `workspace/src/tests/contracts/BusTicketPlatform.ContractTests/*.cs`
- Test: `workspace/src/tests/gateway/BusTicketPlatform.Gateway.IntegrationTests/*.cs`

**Interfaces:**
- Consumes: service-specific error decisions and completed behavior.
- Produces: consistent error envelopes/status codes, synchronized contract, and line-of-sight from every SRS `MUST` requirement to automated evidence.

- [ ] Add failing contract/gateway tests for remaining 500s, auth challenge behavior, schema drift, and undocumented status codes.
- [ ] Implement shared mappings and update OpenAPI only where SRS-approved behavior requires it.
- [ ] Run contract, gateway, and full .NET suites plus OpenAPI validation.
- [ ] Update traceability from actual tests/logs, marking gaps instead of assuming coverage.

### Task 7: Client completion against the stabilized API

**Files:**
- Modify: `workspace/src/packages/api-client/src/index.ts`
- Modify: `workspace/src/apps/customer-web/src/**`
- Modify: `workspace/src/apps/backoffice-web/src/**`
- Modify: `workspace/src/apps/mobile/**`
- Test: client unit/component/e2e tests under the corresponding app workspaces.

**Interfaces:**
- Consumes: stabilized OpenAPI and gateway routes.
- Produces: SRS `MUST` customer, operator/admin, and mobile flows with consistent loading/error/session behavior.

- [ ] Inventory every SRS UI/mobile `MUST` against an implemented screen/action and add failing tests for uncovered critical flows.
- [ ] Implement missing flows using the shared API client; do not expose disabled `SHOULD/COULD` features.
- [ ] Run TypeScript checks, production builds, client tests, and critical browser/mobile smoke paths.

### Task 8: Production Docker, security, observability, and deployment runbook

**Files:**
- Modify: `workspace/src/infra/docker-compose.apps.yml`
- Create: `workspace/src/infra/docker-compose.production.yml`
- Modify: `workspace/src/infra/docker/api.Dockerfile`
- Modify: `workspace/src/infra/docker/web.Dockerfile`
- Create: `docs/implementation/08-production-deployment-runbook.md`
- Create: `docs/implementation/09-production-readiness-checklist.md`
- Test: Docker build, health/readiness probes, restart, migration, backup/restore, and smoke commands documented in the runbook.

**Interfaces:**
- Consumes: all built services and client artifacts; externally supplied secrets, TLS terminator, SMTP/payment production credentials.
- Produces: reproducible production images/compose overlay, non-root/least-privilege runtime where practical, resource/restart/health policies, and operator instructions.

- [ ] Add failing configuration/security checks for placeholder secrets, development-only services, permissive CORS, missing persistence/backup, and absent production observability settings.
- [ ] Implement the minimal production overlay and runbook without embedding real credentials.
- [ ] Build clean images, start the production-shaped stack, verify all health/readiness endpoints, restart recovery, migration idempotence, and smoke workflows.

### Task 9: Authoritative Postman Round 2 report and release gate

**Files:**
- Create: `outputs/pbl6-round2/Test_Report_API_Postman_Round2.xlsx`
- Create: `outputs/pbl6-round2/round2-summary.json`
- Create: `outputs/pbl6-round2/junit/*.xml`
- Modify: `workspace/postman/round2-suite.json`

**Interfaces:**
- Consumes: a freshly rebuilt Docker stack, deterministic runner, SRS traceability, and all per-collection logs.
- Produces: auditable Round 2 workbook, machine-readable evidence, exact comparison with Round 1, and a release decision.

- [ ] Reset only test-owned synthetic state, rebuild/start Docker, and verify readiness.
- [ ] Run the complete Round 2 suite once in declared order; retain all logs and reports.
- [ ] Reconcile assertions and SRS cases independently; investigate any difference between CLI totals and workbook totals.
- [ ] Generate the Round 2 workbook from the Round 1 template with `@oai/artifact-tool`, preserving layout and filling only evidence-backed fields.
- [ ] Recalculate, inspect formula errors, render every changed sheet, export, and reopen the saved workbook for verification.
- [ ] Run the full release gate: .NET tests, web/mobile checks, Docker health, Postman suite, contract validation, secret scan, and deployment smoke.
- [ ] Record the release decision with exact pass/fail totals and remaining external dependencies, if any.
