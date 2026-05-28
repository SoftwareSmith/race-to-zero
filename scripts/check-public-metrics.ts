import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

const ANALYTICS_PATH = path.join(ROOT_DIR, "public", "data", "metrics-analytics.json");
const BOOTSTRAP_PATH = path.join(ROOT_DIR, "public", "data", "metrics.json");

const FORBIDDEN_KEYS = new Set([
  "id",
  "identifier",
  "title",
  "description",
  "body",
  "content",
  "labels",
  "comments",
  "comment",
  "attachments",
  "assignee",
  "assigneeId",
  "email",
  "url",
  "slug",
]);

const ANALYTICS_ROOT_KEYS = new Set(["generatedAt", "lastUpdated", "bugs"]);
const ANALYTICS_BUG_KEYS = new Set([
  "archivedAt",
  "autoClosedAt",
  "canceledAt",
  "completedAt",
  "createdAt",
  "dueDate",
  "priority",
  "stateName",
  "stateType",
  "teamKey",
  "updatedAt",
]);

const BOOTSTRAP_ROOT_KEYS = new Set([
  "generatedAt",
  "lastUpdated",
  "teamKeys",
  "all",
  "byTeam",
]);

const BOOTSTRAP_BUCKET_KEYS = new Set([
  "completedSeries",
  "createdSeries",
  "doneCount",
  "firstBugDate",
  "openAgeDistribution",
  "priorityDistribution",
  "remainingBugs",
  "remainingSeries",
  "statusDistribution",
]);

const SERIES_ENTRY_KEYS = new Set(["date", "count"]);
const LABEL_ENTRY_KEYS = new Set(["label", "count"]);

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertNoForbiddenKeys(value: unknown, currentPath: string) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoForbiddenKeys(entry, `${currentPath}[${index}]`));
    return;
  }

  if (!isPlainObject(value)) {
    return;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    assert(!FORBIDDEN_KEYS.has(key), `Forbidden key \"${key}\" found at ${currentPath}`);
    assertNoForbiddenKeys(nestedValue, `${currentPath}.${key}`);
  }
}

function assertIsoTimestamp(value: unknown, currentPath: string) {
  assert(typeof value === "string", `${currentPath} must be a string timestamp`);
  assert(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value),
    `${currentPath} must be an ISO timestamp`,
  );
}

function assertDateOrNull(value: unknown, currentPath: string) {
  if (value == null) {
    return;
  }

  assert(typeof value === "string", `${currentPath} must be a date string or null`);
  assert(/^\d{4}-\d{2}-\d{2}$/.test(value), `${currentPath} must be a yyyy-MM-dd date`);
}

function assertStringOrNull(value: unknown, currentPath: string) {
  if (value == null) {
    return;
  }

  assert(typeof value === "string", `${currentPath} must be a string or null`);
}

function assertNumber(value: unknown, currentPath: string) {
  assert(typeof value === "number" && Number.isFinite(value), `${currentPath} must be a number`);
}

function validateAnalytics(data: unknown) {
  assert(isPlainObject(data), "metrics-analytics.json must contain an object");
  const keys = Object.keys(data);
  for (const key of keys) {
    assert(ANALYTICS_ROOT_KEYS.has(key), `Unexpected analytics root key \"${key}\"`);
  }

  assertIsoTimestamp(data.generatedAt, "metrics-analytics.generatedAt");
  assertIsoTimestamp(data.lastUpdated, "metrics-analytics.lastUpdated");
  assert(Array.isArray(data.bugs), "metrics-analytics.bugs must be an array");

  data.bugs.forEach((bug, index) => {
    assert(isPlainObject(bug), `metrics-analytics.bugs[${index}] must be an object`);
    for (const key of Object.keys(bug)) {
      assert(ANALYTICS_BUG_KEYS.has(key), `Unexpected analytics bug key \"${key}\" at bugs[${index}]`);
    }

    assertDateOrNull(bug.archivedAt, `metrics-analytics.bugs[${index}].archivedAt`);
    assertDateOrNull(bug.autoClosedAt, `metrics-analytics.bugs[${index}].autoClosedAt`);
    assertDateOrNull(bug.canceledAt, `metrics-analytics.bugs[${index}].canceledAt`);
    assertDateOrNull(bug.completedAt, `metrics-analytics.bugs[${index}].completedAt`);
    assertDateOrNull(bug.createdAt, `metrics-analytics.bugs[${index}].createdAt`);
    assertDateOrNull(bug.dueDate, `metrics-analytics.bugs[${index}].dueDate`);
    assertNumber(bug.priority, `metrics-analytics.bugs[${index}].priority`);
    assertStringOrNull(bug.stateName, `metrics-analytics.bugs[${index}].stateName`);
    assertStringOrNull(bug.stateType, `metrics-analytics.bugs[${index}].stateType`);
    assertStringOrNull(bug.teamKey, `metrics-analytics.bugs[${index}].teamKey`);
    assertDateOrNull(bug.updatedAt, `metrics-analytics.bugs[${index}].updatedAt`);
  });
}

function validateSeries(series: unknown, currentPath: string) {
  assert(Array.isArray(series), `${currentPath} must be an array`);
  series.forEach((entry, index) => {
    assert(isPlainObject(entry), `${currentPath}[${index}] must be an object`);
    for (const key of Object.keys(entry)) {
      assert(SERIES_ENTRY_KEYS.has(key), `Unexpected series key \"${key}\" at ${currentPath}[${index}]`);
    }
    assertDateOrNull(entry.date, `${currentPath}[${index}].date`);
    assertNumber(entry.count, `${currentPath}[${index}].count`);
  });
}

function validateLabelCounts(entries: unknown, currentPath: string) {
  assert(Array.isArray(entries), `${currentPath} must be an array`);
  entries.forEach((entry, index) => {
    assert(isPlainObject(entry), `${currentPath}[${index}] must be an object`);
    for (const key of Object.keys(entry)) {
      assert(LABEL_ENTRY_KEYS.has(key), `Unexpected label-count key \"${key}\" at ${currentPath}[${index}]`);
    }
    assert(typeof entry.label === "string", `${currentPath}[${index}].label must be a string`);
    assertNumber(entry.count, `${currentPath}[${index}].count`);
  });
}

function validateBootstrapBucket(bucket: unknown, currentPath: string) {
  assert(isPlainObject(bucket), `${currentPath} must be an object`);
  for (const key of Object.keys(bucket)) {
    assert(BOOTSTRAP_BUCKET_KEYS.has(key), `Unexpected bootstrap bucket key \"${key}\" at ${currentPath}`);
  }

  validateSeries(bucket.completedSeries, `${currentPath}.completedSeries`);
  validateSeries(bucket.createdSeries, `${currentPath}.createdSeries`);
  assertNumber(bucket.doneCount, `${currentPath}.doneCount`);
  assertDateOrNull(bucket.firstBugDate, `${currentPath}.firstBugDate`);
  validateLabelCounts(bucket.openAgeDistribution, `${currentPath}.openAgeDistribution`);
  validateLabelCounts(bucket.priorityDistribution, `${currentPath}.priorityDistribution`);
  assertNumber(bucket.remainingBugs, `${currentPath}.remainingBugs`);
  validateSeries(bucket.remainingSeries, `${currentPath}.remainingSeries`);
  validateLabelCounts(bucket.statusDistribution, `${currentPath}.statusDistribution`);
}

function validateBootstrap(data: unknown) {
  assert(isPlainObject(data), "metrics.json must contain an object");
  for (const key of Object.keys(data)) {
    if (BOOTSTRAP_ROOT_KEYS.has(key)) {
      continue;
    }

    assert(/^[A-Z0-9_-]+$/.test(key), `Unexpected team bucket key \"${key}\" in metrics.json`);
  }

  assertIsoTimestamp(data.generatedAt, "metrics.generatedAt");
  assertIsoTimestamp(data.lastUpdated, "metrics.lastUpdated");
  assert(Array.isArray(data.teamKeys), "metrics.teamKeys must be an array");
  data.teamKeys.forEach((teamKey, index) => {
    assert(typeof teamKey === "string", `metrics.teamKeys[${index}] must be a string`);
  });

  assert(isPlainObject(data.byTeam), "metrics.byTeam must be an object");
  validateBootstrapBucket(data.all, "metrics.all");

  for (const [teamKey, teamBucket] of Object.entries(data.byTeam)) {
    assert(typeof teamKey === "string", "metrics.byTeam keys must be strings");
    validateBootstrapBucket(teamBucket, `metrics.byTeam.${teamKey}`);
  }

  for (const [teamKey, teamBucket] of Object.entries(data)) {
    if (BOOTSTRAP_ROOT_KEYS.has(teamKey)) {
      continue;
    }

    validateBootstrapBucket(teamBucket, `metrics.${teamKey}`);
  }
}

async function main() {
  const analytics = JSON.parse(await fs.readFile(ANALYTICS_PATH, "utf8"));
  const bootstrap = JSON.parse(await fs.readFile(BOOTSTRAP_PATH, "utf8"));

  assertNoForbiddenKeys(analytics, "metrics-analytics");
  assertNoForbiddenKeys(bootstrap, "metrics");
  validateAnalytics(analytics);
  validateBootstrap(bootstrap);

  console.log("Public metrics payloads passed sanitization checks");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});