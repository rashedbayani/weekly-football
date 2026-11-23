# Touchline online sharing

Website: https://rashedbayani.github.io/weekly-football/

The Angular app is hosted on free GitHub Pages (main branch, docs folder). Supabase Free stores records and handles email/password login. All statistics are calculated in the browser. No custom server is needed. The local edition still works independently without internet.

## Administrator

Only rashed.bayani@gmail.com can edit. Use Admin sign in with your email and password. Sessions persist across refreshes; sign out on shared devices. Password setup and recovery links open the app's password form. No GitHub token is needed.

Supabase project: stdegteinpejtvsfgjbk, organization Touchline Football. The browser uses the public publishable key in hosting-config.json. Never put a secret or service-role key in the app or repository.

Database policies verify the authenticated user against auth.users and require the exact administrator email to be confirmed. Friends browse without accounts. Public users cannot insert, update, or delete records. Public signups should remain disabled after the owner account is provisioned.

## Saving and backups

Saves update the database immediately. Other open pages refresh every minute or with Refresh records. Simultaneous updates use a server-enforced revision condition; stale forms cannot overwrite newer records. After a connection error, refresh to check whether the save completed before retrying. Unsaved forms remain open.

All current player, match, and payment fields, including notes, are public. Payments share the same protected season record and revision checks; no extra database table or policy is required. A database trigger keeps the previous 100 revisions in a private history table. Keep regular JSON exports through Backup & data as an independent backup. Local records are never uploaded automatically; import a reviewed local backup while signed in to publish it.

The old docs/data/season.json is retained only as a migration archive and is no longer used by the app. Rebuilding the website does not overwrite Supabase records.

## Free plan

Supabase may pause free projects after a week of inactivity. Resume the project from its dashboard if needed. Free service limits and availability can change; no paid plan was enabled. Password email delivery also depends on the provider's limits.

## Rebuilding

Use Node.js 24 and the included pnpm lockfile. Install dependencies, run npm test, then:

    npx ng build --configuration production --base-href ./
    npm run prepare:pages

The preparation script copies the production assets and public hosting configuration into docs. Commit the updated source and generated assets to main. GitHub Pages publishes the new build. public/cloud-config.json remains disabled so the local launcher continues using browser storage.

The applied database schema is in supabase/schema.sql. Configure the Auth Site URL and allowed redirect to https://rashedbayani.github.io/weekly-football/. Do not reset the season table during a code deployment.
