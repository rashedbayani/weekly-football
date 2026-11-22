# Touchline sharing on GitHub Pages

This version uses GitHub Pages for free static hosting and a public repository for durable online records. There is no Firebase, Cloudflare, custom server, or paid database. Insights are calculated in Angular.

## Deployment

Repository: `rashedbayani/weekly-football`. Intended URL: `https://rashedbayani.github.io/weekly-football/`.

Deploy from the `main` branch's `/docs` folder in repository Settings → Pages. Keep the repository public for GitHub Free hosting. The source app is at the repository root, and the production app is in `docs/`.

## Administrator sign-in

1. Visit the shared website and click **Admin sign in**.
2. In GitHub Settings → Developer settings → Personal access tokens → Fine-grained tokens, create a token for **only** `weekly-football`.
3. Set **Contents: Read and write**, choose an expiry, and generate it. No other optional permissions are needed.
4. Paste it into the app's password field. Do not send it through chat, put it in notes, or commit it to the repository.

Only GitHub account ID `82253861` (`rashedbayani`) is accepted by the app. GitHub itself enforces permission for every write; hiding edit buttons is not the security boundary. Keep the repository without additional write collaborators if only you should edit. Friends do not need accounts or tokens.

The token is held only in the current tab's memory and sent only to `https://api.github.com`. Refreshing the page, closing the tab, or signing out clears it. The app must be signed in again afterward. Revoke or renew it in GitHub's settings whenever needed.

## Weekly use

Add players, record the two lineups and score, then save. GitHub confirms each save before the app reports success. Friends see the new records after GitHub Pages publishes the update, usually within a few minutes. Their page checks for changes every minute while visible; **Refresh records** checks immediately. The administrator reads the latest saved version directly from GitHub.

All online fields, including notes, are public, and earlier records remain in Git history. Use notes only for information intended to be shared. The site starts with an empty season; local records are never uploaded automatically.

To migrate a local season, open the original local address, download a JSON backup, sign in on the shared website, then use **Backup & data** to import and confirm replacement. Review the backup's notes before publishing. Keep periodic JSON backups even though GitHub stores version history.

Conflicting edits from another tab are rejected. Close the stale form, click Refresh records, and enter the change again. After a timeout, refresh before retrying to see whether GitHub accepted the save. Browser-side size limits keep the saved file below GitHub's supported Contents API inline-read size.

## Rebuilding

```powershell
npm install
npm test
npx ng build --configuration production --base-href ./
npm run prepare:pages
```

`prepare:pages` copies built assets to `docs/`, adds sharing configuration, and creates an empty data file only if none exists. It never replaces an existing `docs/data/season.json`. Before publishing a rebuild, pull the latest repository changes so you keep all online records, and commit only the intended code and generated assets. Do not overwrite the online data file with an old local copy.

The local production launcher continues to use browser storage and `public/cloud-config.json` stays disabled. Only the prepared `docs/` build enables sharing.

References: [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages), [repository Contents API](https://docs.github.com/en/rest/repos/contents), [fine-grained tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens).
