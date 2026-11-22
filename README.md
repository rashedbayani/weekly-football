# Touchline — weekly football

A standalone Angular 22 app for a weekly football group. Add players once, choose the two lineups each week, and enter the final score. All insights recalculate when a result is added, edited, or deleted. The local edition needs no backend. The shared edition uses GitHub Pages and saves records in a GitHub repository, with editing restricted by GitHub repository permissions.

## Shared website

The intended public address is https://rashedbayani.github.io/weekly-football/. See CLOUD-SETUP.md for deployment status, administrator sign-in, and publishing instructions. Friends browse without signing in. Online records and their history, including notes, are public. Only the repository owner receives editing credentials.

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

The project uses Angular standalone components and signals. `src/app/domain.ts` contains pure validation and calculations, `store.ts` handles local storage and online records, `github-data.ts` checks the administrator identity and saves with conflict protection, and `app.ts` / `app.html` implement the UI. Tests use Node's built-in test runner and TypeScript stripping. No chart, styling, or external font service is required.

Reference: [Angular local setup](https://angular.dev/tools/cli/setup-local).
