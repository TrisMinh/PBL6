# Customer ticket UI continuity review

Cause: live-mode route branches rendered separate `BackendTicketLookupPage` and `LiveAccountPage` screens. These retained API behavior but bypassed the photographic lookup shell and shared ticket-card presentation already refined for the standalone frontend.

Corrections:

- Both lookup modes now use `TicketLookupLayout`: same photo, headings, decorative ticket, support/privacy sections and account-ticket button. Live lookup keeps authenticated, owner-scoped API access. The backend does not provide the mock public email/phone lookup contract, so sign-in remains required; the old look is restored without inventing that capability.
- Live account tickets reuse the existing `AccountHeader`, `TicketList` and stylesheet. Preserve actual backend ticket/booking IDs in links; display geographic route names, seat, passenger, operator, fare and dates. Backend offset timestamps are normalized before the existing UTC formatter, correcting blank departure dates.
- Restore list, small grid and large grid controls, stored per customer. Small grid omits photographs; list and large grid include them. Checked-in tickets do not offer cancellation. Keep the live booking-history tab, pagination and authorization.
- Error and no-match feedback uses the existing three-second toast.

Verification: 18 tests across four ticket-page suites passed; TypeScript and ESLint passed. Browser tested unauthenticated lookup, login return to lookup, actual SePay ticket `TK18DA882C142D` lookup, actual account history, departure time display and density controls. Docker customer portal rebuilt and healthy. Screenshots are captured from the actual running live frontend using the synthetic development customer.

Review boundary: this change restores ticket lookup and account ticket history. The profile/settings route shells, electronic ticket detail and booking/payment flows remain their existing implementations; this is not a claim that every live-mode screen is visually identical to the old mock screens.
