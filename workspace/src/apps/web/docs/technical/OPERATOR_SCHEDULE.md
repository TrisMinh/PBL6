# Operator Schedule List

- Workspace: `D:\ReactJS\mockup_pbl6_desk`.
- Route: `/operator/trips`, independent of Customer/Admin layouts.
- Figma: Travel v3 `OCkWSOZQ8Pq8AejXccajpO`, exact node `700:164`.
- Design session: `4c7b826c-fe58-49d0-bbc7-45a6057a5b20`.

This is a single-screen mock preview, not an authenticated Operator portal. It deliberately does not change the existing customer/admin session schema or guards. The development-only MSW bootstrap serves `/api/v1/operator/schedule-preview`; the endpoint is fixture-only and returns no real/private operational data.

Initial data follows the five visible Figma records and adds three clearly mock records for the second page. The sample date remains 2026-08-28 because this screen can browse historical schedules. The initial query/filter controls reproduce the prototype's staged choices; search and Apply commit filters to the URL, then filtering runs before pagination. Initial fixture order is called “Thứ tự mẫu” because Figma labels the visibly unsorted sample “Sớm nhất”; chronological sorting is available explicitly.

Search, route swap, status/time/assignment filtering, reset, chronological sorting, pagination, empty/error/retry states work. Other sidebar destinations, Create and Detail/Continue open an accessible explanation because their separate Figma screens are outside this task. No routes for those screens are fabricated.

All icons and the vehicle thumbnail under `src/assets/operator/schedule` were downloaded from asset URLs returned by the exact design context. `imgFrame.svg` is the 190x28 journey graphic; `imgFrame1..8.svg` are sidebar icons; status dots, search/swap/filter/check/chevron/calendar/vehicle/passenger icons are original exports. `BrandLogo` reuses the existing official local BLUE logo. Runtime contains no temporary Figma asset URLs.

New CSS is scoped to `operator-schedule`; no shared styles or existing page components changed. Only `src/routes.ts` and `src/mocks/handlers.ts` are extended for registration. Layout adapts at narrower widths; there is no claim to match a separate mobile Figma frame.

Validation: TypeScript, focused selection unit tests, targeted ESLint/format checks and browser behavior/overflow checks at 360/768/1024/1440/1920. Desktop anchors: sidebar 16,16,190x968; query 214,92,1210x88; filters 214,196,282x788; results 512,196,912x788. UI is a close implementation, not a pixel-equivalence claim.
