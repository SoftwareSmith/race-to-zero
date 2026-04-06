# Race to Zero Bugs

Race to Zero Bugs is a React and Vite dashboard that reads a sanitized bug snapshot from `public/data/metrics.json` and visualizes bug intake, bug completions, and burndown progress.

## Features

- Dark-themed dashboard with deadline picker and time-range drill-down controls
- Charts powered by Chart.js through `react-chartjs-2`
- Date handling with `date-fns`
- Manual GitHub Actions sync from the UI using `workflow_dispatch`
- Polling for workflow completion and updated metrics publication
- Frontend-derived deadline, pace, and time-window calculations
- GitHub Pages-ready Vite base path at `/race-to-zero/`

## Environment

Create a local `.env` file from `.env.example` and provide these values:

- `VITE_GITHUB_TOKEN`
- `VITE_GITHUB_OWNER`
- `VITE_GITHUB_REPO`
- `VITE_WORKFLOW_FILE`

The browser-based sync button uses those values to call the GitHub Actions API. Use a token with the minimum repo and actions permissions needed for your repository.

## Local Development

```bash
npm install
npm run dev
```

## Deployment

Build and publish to the `gh-pages` branch:

```bash
npm run build
npm run deploy
```

## GitHub Action Sync

The workflow in `.github/workflows/sync-linear.yml` runs every day at midnight UTC and on manual dispatch. It expects these GitHub secrets:

- `LINEAR_API_KEY`

The workflow runs `scripts/fetch-linear.js`, scopes to the `CP` team, writes sanitized bug records into `public/data/metrics.json`, then commits and pushes the result back to the repository. The frontend calculates the deadline, rates, and projections locally.
