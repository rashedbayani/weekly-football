# Touchline — weekly football

A standalone Angular 22 app for a weekly football group. Add players once, choose the two lineups each week, and enter the final score. All insights recalculate when a result is added, edited, or deleted. The local edition needs no backend. The shared edition uses GitHub Pages hosting and Supabase for email/password authentication and online records. Database policies restrict editing to the verified organizer.

## Shared website

The live website is [Touchline](https://rashedbayani.github.io/weekly-football/). See CLOUD-SETUP.md for deployment status, administrator sign-in, and publishing instructions. Friends browse without signing in. Current online records, including notes, are public. Only the verified organizer can edit; revision history is private.

## Run the local app

Double-click **Start Touchline.cmd**, keep its terminal open, then visit **http://127.0.0.1:4200**. The included production build only needs Node.js. It can run without internet access. The local server serves static files; it does not store or process your football data.

Always use this same browser and address. Browser storage is specific to an origin: `localhost` and `127.0.0.1`, different ports, and different browsers have separate records. Clearing browser data deletes records. Export a JSON backup regularly from **Backup & data**.

## Weekly workflow

1. Open **Players** and add names, preferred positions, and optional notes.
2. Choose **Record a match**, enter the date, team names, and final score.
3. Assign each participating player to team A or B. Leave everyone else as **Not playing**. Teams can have different sizes; each needs at least one player.
4. Optionally record player goals, assists, venue, and match notes. Untracked goals can remain unassigned.
5. Save. The overview, insights, charts, and player profiles update immediately.

Use **Matches** to search by team, player, venue, or date and correct old results. Archive players to hide them from new lineups while preserving their history. Importing a backup replaces the current dataset only after a separate review action. The empty overview offers an optional sample season; it is never loaded automatically.

## Payments

Open **Payments** to view the ledger imported from سالن.xlsx: 17 members and 25 weeks. Amounts are in **thousand tomans** (150 = 150,000 tomans). The signed-in administrator can edit weekly charges, each member's total paid, and the total paid to the hall, and add or remove weeks and payment members. Choose **Save payments** to publish changes; everyone can view the table without signing in.

Each member's balance is total paid minus charges across **all weeks**. Cash remaining is total collected minus total paid to the hall. Empty cells stay blank and are distinct from zero. Totals update while editing. Payment members are maintained separately from football players so changes to match lineups do not alter the ledger.

JSON backups include payments. Restoring an older backup without a payment table preserves the current ledger. The initial spreadsheet is bundled with the app; when an existing season has no payment ledger yet, the next administrator save stores it alongside the online season. Local saves stay in the current browser.

## Insights and definitions

- **Wins / draws / losses:** the player's team's result in each appearance, independent of team name or teammates.
- **Win percentage:** wins divided by appearances, rounded to the nearest whole percentage. Draws remain in the denominator.
- **Current win streak:** consecutive wins through the player's latest appearance. A draw or loss resets it; an absence does not.
- **Best win streak:** longest such run across their match history.
- **Attendance:** appearances divided by every recorded match, including matches before a player joined.
- **Team goal difference:** team goals scored minus conceded across the player's appearances, not an individual contribution rating.
- **Goals / assists:** only the optional contributions entered for that player. They are never inferred from the scoreline.
- **Form:** last five appearances, oldest to newest.

Charts show each player's win/draw/loss proportions and total goals across the eight latest matches. Filter the player table by minimum appearances and sort by wins, win rate, goals, assists, appearances, or streaks. Click a player for their history.

Matches are ordered by date. Multiple matches on the same date use the record ID as a stable tie-breaker; this app is primarily designed for one weekly game.

## Development

Use Node.js 24 LTS and npm, or pnpm with the included lockfile.

```powershell
npm install
npm start
npm run build
npm test
```

`npm start` serves the development app at `http://127.0.0.1:4200`. Stop the finished-app launcher before starting development, since they use the same port. After source changes, rebuild before using the finished-app launcher.

The project uses Angular standalone components and signals. `src/app/domain.ts` contains pure validation and calculations, `store.ts` handles local storage and online records, `supabase-data.ts` handles email/password authentication and saves with conflict protection, and `app.ts` / `app.html` implement the UI. Tests use Node's built-in test runner and TypeScript stripping. No chart, styling, or external font service is required.

Reference: [Angular local setup](https://angular.dev/tools/cli/setup-local).
