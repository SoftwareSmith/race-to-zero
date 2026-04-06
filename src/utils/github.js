const GITHUB_API_BASE = 'https://api.github.com'

function getRequiredEnv(name) {
  const value = import.meta.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}

function getHeaders() {
  const token = getRequiredEnv('VITE_GITHUB_TOKEN')

  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

function getRepoParts() {
  return {
    owner: getRequiredEnv('VITE_GITHUB_OWNER'),
    repo: getRequiredEnv('VITE_GITHUB_REPO'),
    workflow: getRequiredEnv('VITE_WORKFLOW_FILE'),
  }
}

function getWorkflowUrl() {
  const { owner, repo, workflow } = getRepoParts()
  return `${GITHUB_API_BASE}/repos/${owner}/${repo}/actions/workflows/${workflow}`
}

export async function dispatchWorkflow() {
  const response = await fetch(`${getWorkflowUrl()}/dispatches`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ ref: 'main' }),
  })

  if (!response.ok) {
    throw new Error(`GitHub workflow dispatch failed (${response.status})`)
  }
}

export async function getLatestWorkflowRun(triggerTimestamp) {
  const response = await fetch(`${getWorkflowUrl()}/runs?event=workflow_dispatch&per_page=10`, {
    headers: getHeaders(),
  })

  if (!response.ok) {
    throw new Error(`GitHub workflow lookup failed (${response.status})`)
  }

  const payload = await response.json()
  const run = payload.workflow_runs?.find((candidate) => candidate.created_at >= triggerTimestamp)
  return run ?? null
}

export function wait(durationMs) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, durationMs)
  })
}