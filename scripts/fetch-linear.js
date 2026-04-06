import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fetch from 'node-fetch'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.resolve(__dirname, '..')
const OUTPUT_PATH = path.join(ROOT_DIR, 'public', 'data', 'metrics.json')
const LINEAR_API_URL = 'https://api.linear.app/graphql'
const BUG_LABEL_NAMES = new Set(['bug', 'cs bug', 'cs bugs'])
const BUG_PARENT_NAMES = new Set(['bug reason'])

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
  const teamKey = process.env.LINEAR_TEAM_KEY ?? 'CP'

  const teamFilter = teamKey ? `filter: { team: { key: { eq: \"${teamKey}\" } } }` : ''

  const query = `
    query FetchBugIssues($after: String) {
      issues(
        first: 100
        after: $after
        ${teamFilter}
      ) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          createdAt
          completedAt
          priority
          state {
            name
            type
          }
          labels {
            nodes {
              name
              parent {
                name
              }
            }
          }
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

function isBugIssue(issue) {
  return issue.labels?.nodes?.some((label) => {
    const labelName = label.name?.trim().toLowerCase()
    const parentName = label.parent?.name?.trim().toLowerCase()
    return BUG_LABEL_NAMES.has(labelName) || BUG_PARENT_NAMES.has(parentName)
  })
}

function buildMetrics(issues) {
  const sortedIssues = [...issues]
    .filter(isBugIssue)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))

  return {
    generatedAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
    bugs: sortedIssues.map((issue) => ({
      createdAt: toDay(issue.createdAt),
      completedAt: issue.completedAt ? toDay(issue.completedAt) : null,
      priority: issue.priority ?? 0,
      stateName: issue.state?.name ?? null,
      stateType: issue.state?.type ?? null,
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