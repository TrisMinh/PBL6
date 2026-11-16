# Correcting an unverified registration

`POST /api/v1/auth/register` accepts corrected contact details even when the email or phone matches a pending, never-verified registration. The latest submission supplies the name, email, phone and password; a new verification challenge is required. The response contract remains `202 { operationId, status: "ACCEPTED" }`.

Pending drafts do not reserve identifiers permanently. In one PostgreSQL transaction the repository locks overlapping identity claims, checks every conflicting account, retires eligible pending drafts, revokes their active challenges and inserts the new draft. Retired rows are soft deleted for audit, rather than having their password/contact details overwritten. No existing customer bookings or verified accounts are transferred.

An account that is active, locked, disabled or previously verified cannot be replaced by anonymous registration: the request returns `409 IDENTITY_ALREADY_USED`, with a Vietnamese UI message directing the user to sign in or recover their password. If one identifier conflicts with such an account, the entire operation rolls back, including any pending draft retirement.

Verification updates require a non-deleted user and the expected row version, so a verification request racing a replacement cannot activate the retired draft or create a session for it. Old challenge IDs cannot confirm the corrected registration. A separate resend-verification request retains its existing behavior.

Verification performed:

- Identity API integration suite: 20 passing tests using real disposable PostgreSQL; covers changed email and phone across two pending drafts, replacement with the latest password/name, old-code rejection, concurrent registrations, and protection of active accounts.
- Frontend repository: 6 passing tests and ESLint passed.
- Saved `workspace/postman/BLUE_RegistrationCorrection.postman_collection.json`: 4 real HTTP requests and 8 passing assertions against the running localhost gateway, including correction acceptance and rejection of a verified-account conflict. Run events disabled; synthetic contact information only.
- Rebuilt and restarted the local identity API and customer portal; both healthy.
