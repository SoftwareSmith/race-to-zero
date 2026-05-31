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

const tooltipShareOfTotalChartKeys = new Set([
  "priority-breakdown",
  "status-breakdown",
  "open-age-breakdown",
  "history-outcome-breakdown",
  "history-cycle-buckets",
  "period-rate-history",
]);

const tooltipPercentValueChartKeys = new Set(["sla-hit-rate-by-priority"]);

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

export function usesUnifiedAllValuesTooltip(
  variant: ChartVariant,
  chartKey?: string,
  datasetCount = 1,
) {
  return shouldUseUnifiedAllValuesTooltip(variant, chartKey, datasetCount);
}

function getTooltipRowColor(dataset: any, index: number) {
  const backgroundColor = dataset?.backgroundColor;

  if (Array.isArray(backgroundColor)) {
    return backgroundColor[index] ?? "#7dd3fc";
  }

  return backgroundColor ?? dataset?.borderColor ?? "#7dd3fc";
}

function getTooltipElement(chart: any) {
  return document.body.querySelector(
    `[data-chart-tooltip="custom"][data-chart-id="${String(chart.id)}"]`,
  ) as HTMLDivElement | null;
}

function getOrCreateTooltipElement(chart: any) {
  let tooltipEl = getTooltipElement(chart);

  if (tooltipEl) {
    return tooltipEl;
  }

  tooltipEl = document.createElement("div");
  tooltipEl.dataset.chartTooltip = "custom";
  tooltipEl.dataset.chartId = String(chart.id);
  tooltipEl.style.position = "fixed";
  tooltipEl.style.pointerEvents = "none";
  tooltipEl.style.transform = "none";
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

export function hideCustomChartTooltip(chart: any) {
  if (!chart) {
    return;
  }

  const tooltipEl = getTooltipElement(chart);
  if (!tooltipEl) {
    return;
  }

  tooltipEl.style.opacity = "0";
}

export function hideAllCustomChartTooltips() {
  const tooltipNodes = document.body.querySelectorAll(
    '[data-chart-tooltip="custom"]',
  );

  tooltipNodes.forEach((tooltipNode) => {
    if (tooltipNode instanceof HTMLDivElement) {
      tooltipNode.style.opacity = "0";
    }
  });
}

export function removeAllCustomChartTooltips() {
  const tooltipNodes = document.body.querySelectorAll(
    '[data-chart-tooltip="custom"]',
  );

  tooltipNodes.forEach((tooltipNode) => {
    tooltipNode.remove();
  });
}

function positionTooltipAtPoint(
  tooltipEl: HTMLDivElement,
  left: number,
  top: number,
) {
  const viewportPadding = 12;

  tooltipEl.style.left = "0px";
  tooltipEl.style.top = "0px";
  tooltipEl.style.opacity = "0";

  const tooltipRect = tooltipEl.getBoundingClientRect();
  const tooltipWidth = tooltipRect.width;
  const tooltipHeight = tooltipRect.height;

  const clampedLeft = Math.min(
    Math.max(viewportPadding, left),
    window.innerWidth - tooltipWidth - viewportPadding,
  );
  const clampedTop = Math.min(
    Math.max(viewportPadding, top),
    window.innerHeight - tooltipHeight - viewportPadding,
  );

  tooltipEl.style.left = `${clampedLeft}px`;
  tooltipEl.style.top = `${clampedTop}px`;
  tooltipEl.style.opacity = "1";
}

function positionTooltipElement(chart: any, tooltip: any, tooltipEl: HTMLDivElement) {
  const canvasRect = chart.canvas.getBoundingClientRect();
  const tooltipRect = tooltipEl.getBoundingClientRect();
  positionTooltipAtPoint(
    tooltipEl,
    canvasRect.left + tooltip.caretX,
    canvasRect.top + tooltip.caretY - tooltipRect.height - 10,
  );
}

function renderTooltipRows(rows: string, title: string) {
  return `
    <div style="display:flex;flex-direction:column;gap:8px;">
      <div style="color:#fafaf9;font-size:12px;font-weight:700;letter-spacing:0.01em;">${title}</div>
      <div style="display:flex;flex-direction:column;gap:6px;">${rows}</div>
    </div>
  `;
}

function sumNumericValues(values: unknown[]) {
  return values.reduce((sum, entry) => {
    return typeof entry === "number" && Number.isFinite(entry)
      ? sum + entry
      : sum;
  }, 0);
}

function formatValueWithPercentSuffix(value: number) {
  return Number.isInteger(value) ? `${value}%` : `${value.toFixed(1)}%`;
}

function formatValueWithShareOfTotal(value: number, datasetValues: unknown[]) {
  const total = sumNumericValues(datasetValues);
  const percent = total > 0 ? Math.round((value / total) * 100) : 0;
  return `${value} (${percent}%)`;
}

function formatTooltipDisplayValue(
  chartKey: string | undefined,
  value: unknown,
  datasetValues: unknown[] = [],
) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return String(value);
  }

  if (chartKey && tooltipPercentValueChartKeys.has(chartKey)) {
    return formatValueWithPercentSuffix(value);
  }

  if (chartKey && tooltipShareOfTotalChartKeys.has(chartKey)) {
    return formatValueWithShareOfTotal(value, datasetValues);
  }

  return String(value);
}

function formatTooltipValue(chartKey: string | undefined, point: any) {
  const value =
    typeof point.raw === "number"
      ? point.raw
      : point.parsed?.y ?? point.parsed?.x ?? point.formattedValue;

  const datasetValues = Array.isArray(point.dataset?.data)
    ? point.dataset.data
    : [];

  return formatTooltipDisplayValue(chartKey, value, datasetValues);
}

function renderStandardTooltip(context: any, chartKey?: string) {
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
      const value = formatTooltipValue(chartKey, point);
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

export function showUnifiedAllValuesTooltip(
  chart: any,
  anchorRect: DOMRect,
  chartKey?: string,
) {
  if (!chart) {
    return;
  }

  const tooltipEl = getOrCreateTooltipElement(chart);
  if (!tooltipEl) {
    return;
  }

  const labels = chart.data.labels ?? [];
  const dataset = chart.data.datasets?.[0];
  const values = dataset?.data ?? [];

  const rows = labels
    .map((label: unknown, index: number) => {
      const color = getTooltipRowColor(dataset, index);
      const value = values[index] ?? 0;
      const displayValue = formatTooltipDisplayValue(chartKey, value, values);

      return `
        <div style="display:grid;grid-template-columns:10px minmax(0,1fr) auto;align-items:center;column-gap:8px;">
          <span style="width:10px;height:10px;border-radius:2px;background:${String(color)};display:block;"></span>
          <span style="color:#dbeafe;font-size:12px;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${String(label)}</span>
          <span style="color:#f8fafc;font-size:12px;line-height:1.2;font-weight:700;text-align:right;">${String(displayValue)}</span>
        </div>
      `;
    })
    .join("");

  tooltipEl.innerHTML = renderTooltipRows(rows, "All values");
  const canvasRect = chart.canvas.getBoundingClientRect();
  const chartArea = chart.chartArea;
  const tooltipRect = tooltipEl.getBoundingClientRect();
  const anchorLeft = chartArea
    ? canvasRect.left + chartArea.right - tooltipRect.width
    : anchorRect.right - tooltipRect.width;
  const anchorTop = chartArea
    ? canvasRect.top + chartArea.top - tooltipRect.height - 10
    : anchorRect.top - tooltipRect.height - 10;

  positionTooltipAtPoint(
    tooltipEl,
    anchorLeft,
    anchorTop,
  );
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
          ? undefined
          : (context: any) => renderStandardTooltip(context, chartKey),
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
            const value = formatTooltipValue(chartKey, context);
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
