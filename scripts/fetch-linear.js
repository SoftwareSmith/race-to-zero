import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fetch from 'node-fetch'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.resolve(__dirname, '..')
const OUTPUT_PATH = path.join(ROOT_DIR, 'public', 'data', 'metrics.json')
const LINEAR_API_URL = 'https://api.linear.app/graphql'

function getRequiredEnv(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}

function toDay(dateValue) {
  return new Date(dateValue).toISOString().slice(0, 10)
}

async function fetchBugIssues() {
  const apiKey = getRequiredEnv('LINEAR_API_KEY')
  const teamId = process.env.LINEAR_TEAM_ID
  const projectId = process.env.LINEAR_PROJECT_ID

  const filters = [
    '{ labels: { some: { name: { eq: "bug" } } } }',
  ]

  if (teamId) {
    filters.push(`{ team: { id: { eq: \"${teamId}\" } } }`)
  }

  if (projectId) {
    filters.push(`{ project: { id: { eq: \"${projectId}\" } } }`)
  }

  const query = `
    query FetchBugIssues($after: String) {
      issues(
        first: 100
        after: $after
        filter: {
          and: [${filters.join(',\n')}]
        }
      ) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          createdAt
          completedAt
        }
      }
    }
  `

  const issues = []
  let after = null

  while (true) {
    const response = await fetch(LINEAR_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: apiKey,
      },
      body: JSON.stringify({
        query,
        variables: { after },
      }),
    })

    if (!response.ok) {
      throw new Error(`Linear request failed (${response.status})`)
    }

    const payload = await response.json()
    if (payload.errors?.length) {
      throw new Error(payload.errors.map((entry) => entry.message).join('; '))
    }

    const connection = payload.data.issues
    issues.push(...connection.nodes)

    if (!connection.pageInfo.hasNextPage) {
      break
    }

    after = connection.pageInfo.endCursor
  }

  return issues
}

function buildMetrics(issues) {
  const sortedIssues = [...issues].sort((left, right) => left.createdAt.localeCompare(right.createdAt))

  return {
    generatedAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
    bugs: sortedIssues.map((issue) => ({
      createdAt: toDay(issue.createdAt),
      completedAt: issue.completedAt ? toDay(issue.completedAt) : null,
    })),
  }
}

async function writeMetrics(metrics) {
  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true })
  await fs.writeFile(OUTPUT_PATH, JSON.stringify(metrics, null, 2))
}

async function main() {
  const issues = await fetchBugIssues()
  const metrics = buildMetrics(issues)
  await writeMetrics(metrics)
  console.log(`Wrote ${OUTPUT_PATH}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})