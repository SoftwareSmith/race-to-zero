import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
            id.includes("chart.js") ||
            id.includes("chartjs-plugin-datalabels") ||
            id.includes("react-chartjs-2")
          ) {
            return "charts";
          }

          if (id.includes("react") || id.includes("scheduler")) {
            return "react";
          }

          if (id.includes("date-fns")) {
            return "vendor";
          }

          return undefined;
        },
      },
    },
  },
});
