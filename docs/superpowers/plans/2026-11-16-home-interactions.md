# Customer home interaction implementation plan

Scope: desktop FE only; keep existing mock repository, do not connect live APIs.

- [x] Replace inert popular cards with real links using canonical route IDs. Fetch prices and trip availability from the same repository as search, expose loading/error/empty states. Keep travel photography and BLUE styling.
- [x] Enable swapping origin and destination in the mock home search; keep validation and keyboard navigation.
- [x] Persist up to four validated recent searches, deduplicate and hide past dates. Add repeat, delete and clear actions. Catch unavailable storage.
- [x] Exercise route cards, swapping, result filtering, booking and stored search recovery in desktop Playwright; run relevant unit/type/lint/build checks and inspect screenshots.

Files: home PopularRoutes, new home recentSearches state and RecentSearches component, HomeHero search navigation, SearchForm route fields, desktop interaction spec.

Verification: customer build, TypeScript and targeted ESLint passed. 21 unit tests and 6 desktop Playwright scenarios passed (home interactions, booking navigation, two-seat checkout/result, profile/settings persistence, trip catalogue filters, payment method switching). Screenshots reviewed at 1280 and 1440 widths.

Data boundary: customer FE uses existing MSW/local mock repository. Route cards now read actual mock search results instead of unrelated handwritten prices. Recent searches use browser localStorage with validation, expiry filtering, four-item cap and deduplication. Booking, tickets and account states retain their established browser stores. No live API or real payment verification was connected.
