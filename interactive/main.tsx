import { createRoot } from "react-dom/client";
import type { MetricsSource } from "../src/types/dashboard";
import "./styles.css";
import InteractiveApp from "./InteractiveApp";

async function getInitialBugCount() {
  try {
    const response = await fetch(
      `${import.meta.env.BASE_URL}data/metrics.json`,
      {
        cache: "no-store",
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to load metrics (${response.status})`);
    }

    const metrics = (await response.json()) as MetricsSource;
    return (metrics.bugs ?? []).filter((entry) => !entry.completedAt).length;
  } catch {
    return 48;
  }
}

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element was not found");
}

const initialBugCount = await getInitialBugCount();
const root = createRoot(rootElement);

root.render(<InteractiveApp initialBugCount={initialBugCount} />);
