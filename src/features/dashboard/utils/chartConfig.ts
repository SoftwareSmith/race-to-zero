import type { ChartOptions } from "chart.js";

type ChartVariant = "bar" | "line";

export function getLineChartOptions(
  variant: ChartVariant = "line",
  chartKey?: string,
): ChartOptions<ChartVariant> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      intersect: false,
      mode: "index",
    },
    plugins: {
      datalabels: {
        display: variant === "bar",
        anchor: "end",
        align: "end",
        clamp: true,
        clip: false,
        color: "#f8fafc",
        formatter: (value: unknown) =>
          typeof value === "number" && Number.isFinite(value) ? value : "",
        font: {
          size: 11,
          weight: 700,
        },
        offset: 4,
        textAlign: "center",
      },
      legend: {
        labels: {
          usePointStyle: true,
          boxWidth: 10,
          color: "#cbd5e1",
          padding: 18,
          font: {
            size: 12,
            weight: 600,
          },
        },
      },
      tooltip: {
        backgroundColor: "#0f172a",
        titleColor: "#fafaf9",
        bodyColor: "#dbeafe",
        padding: 12,
        displayColors: true,
        borderColor: "rgba(56,189,248,0.18)",
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        title:
          chartKey === "comparison-summary"
            ? {
                display: true,
                text: "Metric type",
                color: "#cbd5e1",
                padding: { top: 12 },
                font: {
                  size: 12,
                  weight: 600,
                },
              }
            : undefined,
        grid: {
          color: "rgba(148, 163, 184, 0.08)",
        },
        ticks: {
          color: "#94a3b8",
          maxRotation: 0,
          padding: 10,
        },
      },
      y: {
        beginAtZero: true,
        grace: variant === "bar" ? "10%" : 0,
        title:
          chartKey === "comparison-summary"
            ? {
                display: true,
                text: "Value",
                color: "#cbd5e1",
                padding: { bottom: 8 },
                font: {
                  size: 12,
                  weight: 600,
                },
              }
            : undefined,
        grid: {
          color: "rgba(148, 163, 184, 0.08)",
        },
        ticks: {
          color: "#94a3b8",
          precision: variant === "bar" ? 0 : undefined,
          padding: 10,
        },
      },
    },
  };
}
