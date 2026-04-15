# Race to Zero Bugs

Race to Zero Bugs is a React and Vite operations dashboard that reads a sanitized bug snapshot from `public/data/metrics.json`, visualizes burndown progress, and folds the bug-smashing game directly into the dashboard surface.

## Product Shape

The app now has one primary surface:

- Dashboard first: metrics, pace, charts, and deadline tracking remain the main product.
- Siege mode: the dashboard can be armed as a static battlefield where bugs reclaim cards and charts directly.
- Embedded gameplay: there is no separate product-facing interactive route.

## Features

- Dark-themed dashboard with deadline picker and time-range drill-down controls
- Siege-mode gameplay layered over the dashboard itself
- Progression-based reclaim tools with automatic zone clearing
- Charts powered by Chart.js through `react-chartjs-2`
- Date handling with `date-fns`
- Frontend-derived deadline, pace, and time-window calculations
- GitHub Pages-ready Vite base path at `/race-to-zero/`

## Architecture

The rewrite is now split by feature intent instead of one monolithic app file:

- `src/features/dashboard/`: dashboard controller and extracted view sections
- `src/features/background-game/`: siege-mode state, progression, zone targeting, and HUD
- `src/components/`: shared UI and canvas/background primitives

## Local Development

```bash
npm install
npm run dev
```

## Validation

```bash
npm run typecheck
npm run test
npm run build
```

For e2e coverage:

```bash
npm run test:e2e
```

## Deployment

Builds and deploys automatically from GitHub Actions on pushes to `main`.

Set GitHub Pages in the repository settings to deploy from GitHub Actions, then every successful `main` build will publish the Vite output from `dist`.

```bash
npm run build
```

## GitHub Action Sync

The workflow in `.github/workflows/sync-linear.yml` runs every day at midnight UTC and on manual dispatch. It expects these GitHub secrets:

- `LINEAR_API_KEY`

The workflow runs `scripts/fetch-linear.ts`, scopes to the configured Linear teams, writes sanitized bug records into `public/data/metrics.json`, then commits and pushes the result back to the repository. The frontend calculates the deadline, rates, projections, and siege-state visuals locally.
