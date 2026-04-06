# Race to Zero Bugs

Race to Zero Bugs is a React and Vite dashboard that reads a sanitized bug snapshot from `public/data/metrics.json` and visualizes bug intake, bug completions, and burndown progress.

## Features

- React dashboard with reusable summary, chart, and sync button components
- Charts powered by Chart.js through `react-chartjs-2`
- Date handling with `date-fns`
- Manual GitHub Actions sync from the UI using `workflow_dispatch`
- Polling for workflow completion and updated metrics publication
- Frontend-derived deadline and pace calculations using the end of the current year
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

The workflow in `.github/workflows/sync-linear.yml` runs every 6 hours and on manual dispatch. It expects these GitHub secrets:

- `LINEAR_API_KEY`
- `LINEAR_TEAM_ID` optional
- `LINEAR_PROJECT_ID` optional

The workflow runs `scripts/fetch-linear.js`, writes sanitized bug records into `public/data/metrics.json`, then commits and pushes the result back to the repository. The frontend calculates the deadline, daily series, burn rate, and burndown locally.
