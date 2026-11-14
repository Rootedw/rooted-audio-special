# Local database privacy test

From the test-copy root:

    npm ci --prefix supabase/test-runtime --ignore-scripts
    PGLITE_MODULE="$PWD/supabase/test-runtime/node_modules/@electric-sql/pglite/dist/index.js" node supabase/tests/rls.test.mjs

Runs the exact migration in an ephemeral PostgreSQL engine. Synthetic auth.users and auth.uid() model the Supabase SQL identity interface; these are NOT real email logins, provider sessions or JWT cryptographic verification. No provider credentials/network/customer data used. All 28 assertions passed on 2026-10-10. This does NOT replace hosted Supabase RLS catalog verification, API integration, email recovery, stream limits, payment tests or complete customer journey tests.

Hosted SQL editor: never fill an existing Monaco textarea expecting it to replace the entire query. Select all editor text, paste the reviewed query, verify content, run. Do not reapply the migration blindly when tables already exist.

Device/stream primitives:

    PGLITE_MODULE="$PWD/supabase/test-runtime/node_modules/@electric-sql/pglite/dist/index.js" node supabase/tests/device-stream.test.mjs

24 assertions passed locally. Privileged functions deliberately unavailable to customer JWTs. Server integration MUST derive account ID from verified identity, verify the new-device email challenge before registration, use a server-only device proof cookie, derive product from canonical track data, validate stream authorization for every audio request, and revoke leases on logout. Database functions alone do not implement the product feature. PGlite serial tests cannot demonstrate simultaneous requests across multiple server instances.


Payment and entitlement sources:

    PGLITE_MODULE="$PWD/supabase/test-runtime/node_modules/@electric-sql/pglite/dist/index.js" node supabase/tests/payment.test.mjs

Covers additive migration syntax, preservation of existing entitlements, duplicate webhook-source idempotency, refund-source revocation, immediate listening-session revocation, customer table denial and account-scoped global sign-out. These local database assertions do not replace Mollie Test Mode webhooks or hosted Supabase integration tests.
