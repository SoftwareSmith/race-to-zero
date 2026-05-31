import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dashboardShellPath = path.resolve(
  __dirname,
  "src/features/app/DashboardShell.tsx",
);
const dashboardViewsPath = path.resolve(
  __dirname,
  "src/features/dashboard/DashboardViews.tsx",
);
const chartCardPath = path.resolve(
  __dirname,
  "src/features/dashboard/components/ChartCard.tsx",
);
const chartConfigPath = path.resolve(
  __dirname,
  "src/features/dashboard/utils/chartConfig.ts",
);
const chartMetricsPath = path.resolve(
  __dirname,
  "src/features/dashboard/utils/chartMetrics.ts",
);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "/race-to-zero/",
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "src/shared"),
      "@game": path.resolve(__dirname, "src/features/game"),
      "@dashboard": path.resolve(__dirname, "src/features/dashboard"),
      "@config": path.resolve(__dirname, "src/config"),
    },
  },
  build: {
    chunkSizeWarningLimit: 650,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
      },
      output: {
        manualChunks(id) {
          if (
            id === dashboardShellPath ||
            id === dashboardViewsPath ||
            id.includes("/src/features/dashboard/context/") ||
            id.includes("/src/features/dashboard/useDashboardController.ts") ||
            id.includes("/src/features/dashboard/useDashboardBootstrapController.ts") ||
            id.includes("/src/features/dashboard/hooks/") ||
            id.includes("/src/features/dashboard/components/CommandCenter.tsx") ||
            id.includes("/src/features/dashboard/components/CompareRangePicker.tsx") ||
            id.includes("/src/features/dashboard/components/MetricCard.tsx") ||
            id.includes("/src/features/dashboard/components/SettingsMenu.tsx") ||
            id.includes("/src/features/dashboard/components/TopNav.tsx") ||
            id.includes("/src/features/dashboard/utils/bootstrapMetrics.ts") ||
            id.includes("/src/features/dashboard/utils/dashboard.ts")
          ) {
            return "dashboard-core";
          }

          if (id.includes("/src/features/game/engine/VfxEngine.ts") || id.includes("/src/features/game/components/VfxCanvas.tsx")) {
            return "siege-vfx-core";
          }

          if (id.includes("/src/features/game/components/BackgroundField/qa.ts")) {
            return "siege-qa";
          }

          if (
            id === chartCardPath ||
            id === chartConfigPath ||
            id === chartMetricsPath ||
            id.includes("chart.js") ||
            id.includes("react-chartjs-2")
          ) {
            return "dashboard-charts";
          }

          if (id.includes("pixi.js")) {
            return "pixi-vendor";
          }

          if (id.includes("react") || id.includes("scheduler")) {
            return "react";
          }

          if (id.includes("date-fns")) {
            return "dashboard-vendor";
          }

          return undefined;
        },
      },
    },
  },
});
