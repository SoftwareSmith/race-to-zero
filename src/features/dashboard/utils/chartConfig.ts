import type { ChartOptions } from "chart.js";

type ChartVariant = "bar" | "line";

const barValueLabelChartKeys = new Set([
  "priority-breakdown",
  "status-breakdown",
  "open-age-breakdown",
]);

const allValuesTooltipChartKeys = new Set([
  "priority-breakdown",
  "status-breakdown",
  "open-age-breakdown",
  "sla-hit-rate-by-priority",
  "history-outcome-breakdown",
  "history-cycle-buckets",
]);

function shouldShowBarValueLabels(
  variant: ChartVariant,
  chartKey?: string,
  datasetCount = 1,
) {
  return (
    variant === "bar" &&
    datasetCount === 1 &&
    Boolean(chartKey && barValueLabelChartKeys.has(chartKey))
  );
}

function shouldUseUnifiedAllValuesTooltip(
  variant: ChartVariant,
  chartKey?: string,
  datasetCount = 1,
) {
  return (
    variant === "bar" &&
    datasetCount === 1 &&
    Boolean(chartKey && allValuesTooltipChartKeys.has(chartKey))
  );
}

function getTooltipRowColor(dataset: any, index: number) {
  const backgroundColor = dataset?.backgroundColor;

  if (Array.isArray(backgroundColor)) {
    return backgroundColor[index] ?? "#7dd3fc";
  }

  return backgroundColor ?? dataset?.borderColor ?? "#7dd3fc";
}

function getOrCreateTooltipElement(chart: any) {
  let tooltipEl = document.body.querySelector(
    `[data-chart-tooltip="custom"][data-chart-id="${String(chart.id)}"]`,
  ) as HTMLDivElement | null;

  if (tooltipEl) {
    return tooltipEl;
  }

  tooltipEl = document.createElement("div");
  tooltipEl.dataset.chartTooltip = "custom";
  tooltipEl.dataset.chartId = String(chart.id);
  tooltipEl.style.position = "fixed";
  tooltipEl.style.pointerEvents = "none";
  tooltipEl.style.transform = "translate(-50%, calc(-100% - 10px))";
  tooltipEl.style.transition = "opacity 120ms ease";
  tooltipEl.style.opacity = "0";
  tooltipEl.style.zIndex = "20";
  tooltipEl.style.minWidth = "182px";
  tooltipEl.style.maxWidth = "240px";
  tooltipEl.style.border = "1px solid rgba(56,189,248,0.18)";
  tooltipEl.style.borderRadius = "12px";
  tooltipEl.style.background = "#0f172a";
  tooltipEl.style.boxShadow = "0 16px 30px rgba(2, 6, 23, 0.42)";
  tooltipEl.style.padding = "10px 12px";
  tooltipEl.style.color = "#dbeafe";
  document.body.appendChild(tooltipEl);

  return tooltipEl;
}

function positionTooltipElement(chart: any, tooltip: any, tooltipEl: HTMLDivElement) {
  const canvasRect = chart.canvas.getBoundingClientRect();
  tooltipEl.style.left = `${canvasRect.left + tooltip.caretX}px`;
  tooltipEl.style.top = `${canvasRect.top + tooltip.caretY}px`;
  tooltipEl.style.opacity = "1";
}

function renderTooltipRows(rows: string, title: string) {
  return `
    <div style="display:flex;flex-direction:column;gap:8px;">
      <div style="color:#fafaf9;font-size:12px;font-weight:700;letter-spacing:0.01em;">${title}</div>
      <div style="display:flex;flex-direction:column;gap:6px;">${rows}</div>
    </div>
  `;
}

function renderStandardTooltip(context: any) {
  const { chart, tooltip } = context;
  const tooltipEl = getOrCreateTooltipElement(chart);

  if (!tooltipEl) {
    return;
  }

  if (tooltip.opacity === 0) {
    tooltipEl.style.opacity = "0";
    return;
  }

  const rows = (tooltip.dataPoints ?? [])
    .map((point: any) => {
      const color =
        point.element?.options?.borderColor ??
        point.element?.options?.backgroundColor ??
        point.dataset?.borderColor ??
        point.dataset?.backgroundColor ??
        "#7dd3fc";
      const value =
        typeof point.raw === "number"
          ? point.raw
          : point.parsed?.y ?? point.parsed?.x ?? point.formattedValue;
      const label = point.dataset?.label ?? point.label ?? "Value";

      return `
        <div style="display:grid;grid-template-columns:10px minmax(0,1fr) auto;align-items:center;column-gap:8px;">
          <span style="width:10px;height:10px;border-radius:2px;background:${String(color)};display:block;"></span>
          <span style="color:#dbeafe;font-size:12px;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${String(label)}</span>
          <span style="color:#f8fafc;font-size:12px;line-height:1.2;font-weight:700;text-align:right;">${String(value)}</span>
        </div>
      `;
    })
    .join("");

  const title = tooltip.title?.[0] ?? "Details";
  tooltipEl.innerHTML = renderTooltipRows(rows, String(title));
  positionTooltipElement(chart, tooltip, tooltipEl);
}

function renderAllValuesTooltip(context: any) {
  const { chart, tooltip } = context;
  const tooltipEl = getOrCreateTooltipElement(chart);

  if (!tooltipEl) {
    return;
  }

  if (tooltip.opacity === 0) {
    tooltipEl.style.opacity = "0";
    return;
  }

  const labels = chart.data.labels ?? [];
  const dataset = chart.data.datasets?.[0];
  const values = dataset?.data ?? [];

  const rows = labels
    .map((label: unknown, index: number) => {
      const color = getTooltipRowColor(dataset, index);
      const value = values[index] ?? 0;

      return `
        <div style="display:grid;grid-template-columns:10px minmax(0,1fr) auto;align-items:center;column-gap:8px;">
          <span style="width:10px;height:10px;border-radius:2px;background:${String(color)};display:block;"></span>
          <span style="color:#dbeafe;font-size:12px;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${String(label)}</span>
          <span style="color:#f8fafc;font-size:12px;line-height:1.2;font-weight:700;text-align:right;">${String(value)}</span>
        </div>
      `;
    })
    .join("");

  tooltipEl.innerHTML = renderTooltipRows(rows, "All values");
  positionTooltipElement(chart, tooltip, tooltipEl);
}

export function getLineChartOptions<TVariant extends ChartVariant>(
  variant: TVariant,
  chartKey?: string,
  datasetCount = 1,
): ChartOptions<TVariant> {
  const showBarValueLabels = shouldShowBarValueLabels(
    variant,
    chartKey,
    datasetCount,
  );
  const useUnifiedAllValuesTooltip = shouldUseUnifiedAllValuesTooltip(
    variant,
    chartKey,
    datasetCount,
  );

  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: {
      intersect: false,
      mode: "index",
    },
    plugins: {
      datalabels: {
        display: showBarValueLabels,
        anchor: "end",
        align: "end",
        clamp: true,
        clip: false,
        color: "#f8fafc",
        formatter: (value: unknown) =>
          typeof value === "number" && Number.isFinite(value) && value > 0
            ? value
            : "",
        font: {
          size: 11,
          weight: 700,
        },
        offset: 4,
        textAlign: "center",
      },
      legend: {
        display: datasetCount > 1,
        position: "bottom",
        align: "center",
        labels: {
          usePointStyle: true,
          boxWidth: 10,
          color: "#cbd5e1",
          padding: 18,
          pointStyleWidth: 18,
          font: {
            size: 12,
            weight: 600,
          },
        },
      },
      tooltip: {
        enabled: false,
        external: useUnifiedAllValuesTooltip
          ? renderAllValuesTooltip
          : renderStandardTooltip,
        backgroundColor: "#0f172a",
        titleColor: "#fafaf9",
        bodyColor: "#dbeafe",
        padding: 12,
        displayColors: false,
        borderColor: "rgba(56,189,248,0.18)",
        borderWidth: 1,
        callbacks: {
          label: (context: any) => {
            if (useUnifiedAllValuesTooltip) {
              return "";
            }

            const datasetLabel = context.dataset.label
              ? `${context.dataset.label}: `
              : "";
            const value =
              typeof context.raw === "number"
                ? context.raw
                : context.parsed?.y ?? context.parsed?.x ?? context.raw;
            return `${datasetLabel}${value}`;
          },
          title: (items: any[]) => {
            if (useUnifiedAllValuesTooltip) {
              return "All values";
            }

            return items[0]?.label ?? "";
          },
        },
      },
    },
    scales: {
      x: {
        title: undefined,
        grid: {
          color: "rgba(148, 163, 184, 0.08)",
        },
        ticks: {
          autoSkip: chartKey === "status-breakdown" ? false : undefined,
          color: "#94a3b8",
          font:
            chartKey === "status-breakdown"
              ? {
                  size: 10,
                  weight: 500,
                }
              : undefined,
          maxRotation: chartKey === "status-breakdown" ? 50 : 0,
          minRotation: chartKey === "status-breakdown" ? 50 : 0,
          padding: 6,
        },
      },
      y: {
        beginAtZero: true,
        grace: variant === "bar" ? "10%" : 0,
        title:
          chartKey === "comparison-summary" ||
          chartKey === "period-window-history"
            ? {
                display: true,
                text:
                  chartKey === "period-window-history"
                    ? "Net change"
                    : "Value",
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
  } as unknown as ChartOptions<TVariant>;
}
