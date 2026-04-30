import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { MetricsBug, MetricsSource } from "../src/types/dashboard.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const OUTPUT_PATH = path.join(ROOT_DIR, "public", "data", "metrics.json");
const LINEAR_API_URL = "https://api.linear.app/graphql";
const BUG_LABEL_NAMES = new Set(["bug", "cs bug", "cs bugs"]);
const BUG_PARENT_NAMES = new Set(["bug reason"]);

interface LinearLabelNode {
  name?: string | null;
  parent?: {
    name?: string | null;
  } | null;
}

interface LinearIssue {
  archivedAt?: string | null;
  autoClosedAt?: string | null;
  canceledAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  dueDate?: string | null;
  labels?: {
    nodes?: LinearLabelNode[];
  } | null;
  priority?: number | null;
  state?: {
    name?: string | null;
    type?: string | null;
  } | null;
  team?: {
    key?: string | null;
  } | null;
  updatedAt?: string | null;
}

interface LinearConnection {
  nodes: LinearIssue[];
  pageInfo: {
    endCursor: string | null;
    hasNextPage: boolean;
  };
}

interface LinearResponse {
  data: {
    issues: LinearConnection;
  };
  errors?: Array<{ message: string }>;
}

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function toDay(dateValue: string | Date) {
  return new Date(dateValue).toISOString().slice(0, 10);
}

function getTeamKeys() {
  const rawValue =
    process.env.LINEAR_TEAM_KEYS ?? process.env.LINEAR_TEAM_KEY ?? "CP,T1,TA";

  return [
    ...new Set(
      rawValue
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  ];
}

async function fetchBugIssues(): Promise<LinearIssue[]> {
  const apiKey = getRequiredEnv("LINEAR_API_KEY");
  const teamKeys = getTeamKeys();
  const teamFilter = teamKeys.length
    ? `filter: { or: [${teamKeys.map((teamKey) => `{ team: { key: { eq: "${teamKey}" } } }`).join(", ")}] }`
    : "";

  const query = `
    query FetchBugIssues($after: String) {
      issues(
        first: 100
        after: $after
        includeArchived: true
        ${teamFilter}
      ) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          createdAt
          completedAt
          canceledAt
          archivedAt
          autoClosedAt
          dueDate
          priority
          updatedAt
          team {
            key
          }
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
  `;

  const issues: LinearIssue[] = [];
  let after: string | null = null;

  while (true) {
    const response = await fetch(LINEAR_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: apiKey,
      },
      body: JSON.stringify({
        query,
        variables: { after },
      }),
    });

    if (!response.ok) {
      throw new Error(`Linear request failed (${response.status})`);
    }

    const payload = (await response.json()) as LinearResponse;
    if (payload.errors?.length) {
      throw new Error(payload.errors.map((entry) => entry.message).join("; "));
    }

    const connection = payload.data.issues;
    issues.push(...connection.nodes);

    if (!connection.pageInfo.hasNextPage) {
      break;
    }

    after = connection.pageInfo.endCursor;
  }

  return issues;
}

function isBugIssue(issue: LinearIssue) {
  return issue.labels?.nodes?.some((label) => {
    const labelName = label.name?.trim().toLowerCase() ?? "";
    const parentName = label.parent?.name?.trim().toLowerCase() ?? "";
    return BUG_LABEL_NAMES.has(labelName) || BUG_PARENT_NAMES.has(parentName);
  });
}

function buildMetrics(issues: LinearIssue[]): MetricsSource {
  const sortedIssues = [...issues]
    .filter(isBugIssue)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));

  return {
    generatedAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
    bugs: sortedIssues.map(
      (issue): MetricsBug => ({
        archivedAt: issue.archivedAt ? toDay(issue.archivedAt) : null,
        autoClosedAt: issue.autoClosedAt ? toDay(issue.autoClosedAt) : null,
        canceledAt: issue.canceledAt ? toDay(issue.canceledAt) : null,
        createdAt: toDay(issue.createdAt),
        completedAt: issue.completedAt ? toDay(issue.completedAt) : null,
        dueDate: issue.dueDate ? toDay(issue.dueDate) : null,
        priority: issue.priority ?? 0,
        stateName: issue.state?.name ?? null,
        stateType: issue.state?.type ?? null,
        teamKey: issue.team?.key ?? null,
        updatedAt: issue.updatedAt ? toDay(issue.updatedAt) : null,
      }),
    ),
  };
}

async function writeMetrics(metrics: MetricsSource) {
  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, JSON.stringify(metrics, null, 2));
}

async function main() {
  const issues = await fetchBugIssues();
  const metrics = buildMetrics(issues);
  await writeMetrics(metrics);
  console.log(`Wrote ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
