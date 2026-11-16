# Baseline restart: 0c9cf258 + SePay

- Base: 0c9cf258a5a31c9e7a7d2fec44682b3a1e054772.
- Current-work backup: 1f67afd18ef37fd7afc97dcc0d181111e71510ee on codex/backup-before-baseline-sepay-20261116 (pushed).
- Original integration branch codex/fe-be-integration remains available at d7d20dff.
- Local recovery bundle, untracked-file archive and private environment copies: ../PBL6-backups/20261116-before-baseline-sepay/. Private environment files are not committed.
- Ported SePay changes from 1f292ff0. Excluded unrelated HomeHero export and TripResultsPage replacement-search branch from that commit.
- No database reset, volume removal, environment-key replacement or history rewrite.

Protected UI paths are byte-identical to the base: features/trips, features/explore, features/home, features/operator, features/admin, assets and styles. Changes outside payment are restricted to checkout routing, provider links, booking/payment consistency, infrastructure and server integration.

Validation: 55 focused web tests passed; 19 SePay integration tests passed. These are automated tests, not a new manual payment through the provider portal.

Runtime note: the base already contains separate mock/live presentation branches. This restart preserves the base itself; it does not claim that switching VITE_API_MODE from mock to live yields identical presentation. Do not enable a different presentation globally merely to enable SePay. Any remaining wiring must preserve the original rendered screens and be reviewed as payment-only changes.

Standalone startup: `powershell -ExecutionPolicy Bypass -File .\scripts\start-frontend.ps1`. This intentionally uses the base mock/standalone frontend mode and excludes the live SePay override. The Nginx mock configuration has no gateway dependency. SePay server modules remain available separately; standalone demo checkout does not make real SePay payments.
