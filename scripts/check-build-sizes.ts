import { readdir, stat } from "node:fs/promises";
import path from "node:path";

type ChunkBudget = {
  maxKb: number;
  name: string;
  pattern: RegExp;
};

const CHUNK_BUDGETS: ChunkBudget[] = [
  { name: "main", pattern: /^main-.*\.js$/, maxKb: 10 },
  { name: "dashboard-core", pattern: /^dashboard-core-.*\.js$/, maxKb: 175 },
  { name: "dashboard-analytics", pattern: /^dashboard-analytics-.*\.js$/, maxKb: 300 },
  { name: "BackgroundField", pattern: /^BackgroundField-.*\.js$/, maxKb: 100 },
  { name: "SiegeExperience", pattern: /^SiegeExperience-.*\.js$/, maxKb: 85 },
  { name: "siege-vfx-core", pattern: /^siege-vfx-core-.*\.js$/, maxKb: 35 },
  { name: "pixi-vendor", pattern: /^pixi-vendor-.*\.js$/, maxKb: 520 },
];

const distAssetsDir = path.resolve(process.cwd(), "dist/assets");

function formatKb(bytes: number) {
  return `${(bytes / 1024).toFixed(2)} kB`;
}

async function main() {
  const assetEntries = await readdir(distAssetsDir, { withFileTypes: true });
  const assetFiles = assetEntries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name);

  const rows = await Promise.all(
    CHUNK_BUDGETS.map(async (budget) => {
      const fileName = assetFiles.find((file) => budget.pattern.test(file));
      if (!fileName) {
        throw new Error(`Missing expected chunk for ${budget.name}`);
      }

      const filePath = path.join(distAssetsDir, fileName);
      const fileStats = await stat(filePath);
      const sizeKb = fileStats.size / 1024;

      return {
        budget,
        fileName,
        sizeKb,
      };
    }),
  );

  let hasFailure = false;

  console.log("Build size guard");
  for (const row of rows) {
    const withinBudget = row.sizeKb <= row.budget.maxKb;
    hasFailure ||= !withinBudget;
    console.log(
      `${withinBudget ? "PASS" : "FAIL"} ${row.budget.name}: ${formatKb(
        row.sizeKb * 1024,
      )} / ${row.budget.maxKb.toFixed(2)} kB (${row.fileName})`,
    );
  }

  if (hasFailure) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});