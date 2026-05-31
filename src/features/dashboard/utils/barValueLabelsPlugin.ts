import type {
  Chart,
  ChartType,
  FontSpec,
  PluginOptionsByType,
  Plugin,
  ScriptableContext,
} from "chart.js";

type DisplayResolver = boolean | ((context: ScriptableContext<"bar">) => boolean);
type FormatterResolver =
  | string
  | number
  | ((value: unknown, context: ScriptableContext<"bar">) => string | number);

interface DataLabelsOptions {
  align?: "center" | "end" | "start";
  anchor?: "center" | "end" | "start";
  clamp?: boolean;
  clip?: boolean;
  color?: string;
  display?: DisplayResolver;
  font?: Partial<FontSpec>;
  formatter?: FormatterResolver;
  offset?: number;
  textAlign?: CanvasTextAlign;
}

type ChartPluginsWithDataLabels = PluginOptionsByType<ChartType> & {
  datalabels?: DataLabelsOptions;
};

function resolveDisplay(
  display: DisplayResolver | undefined,
  context: ScriptableContext<"bar">,
) {
  if (typeof display === "function") {
    return display(context);
  }

  return display ?? true;
}

function resolveFormattedValue(
  value: unknown,
  formatter: FormatterResolver | undefined,
  context: ScriptableContext<"bar">,
) {
  if (typeof formatter === "function") {
    return formatter(value, context);
  }

  if (formatter != null) {
    return formatter;
  }

  return value;
}

function getTextBaseline(anchor: DataLabelsOptions["anchor"]) {
  return anchor === "start" ? "top" : anchor === "center" ? "middle" : "bottom";
}

function getTextOffset(anchor: DataLabelsOptions["anchor"], offset: number) {
  return anchor === "start" ? offset : anchor === "center" ? 0 : -offset;
}

function drawValueLabel(
  chart: Chart<"bar">,
  datasetIndex: number,
  dataIndex: number,
  options: DataLabelsOptions,
) {
  const dataset = chart.data.datasets[datasetIndex];
  const meta = chart.getDatasetMeta(datasetIndex);
  const element = meta.data[dataIndex];
  if (!dataset || !element) {
    return;
  }

  const rawValue = dataset.data[dataIndex];
  const context = {
    active: false,
    chart,
    dataIndex,
    dataset,
    datasetIndex,
    mode: "default",
    parsed: undefined,
    raw: rawValue,
    type: "data",
  } as unknown as ScriptableContext<"bar">;

  if (!resolveDisplay(options.display, context)) {
    return;
  }

  const formatted = resolveFormattedValue(rawValue, options.formatter, context);
  const label = formatted == null ? "" : String(formatted);
  if (!label) {
    return;
  }

  const { ctx, chartArea } = chart;
  const font = {
    family: options.font?.family ?? "system-ui",
    lineHeight: options.font?.lineHeight ?? 1.2,
    size: options.font?.size ?? 11,
    style: options.font?.style ?? "normal",
    weight: options.font?.weight ?? 700,
  } satisfies Partial<FontSpec>;
  const offset = options.offset ?? 4;
  const position = element.tooltipPosition(true);
  if (position.x == null || position.y == null) {
    return;
  }

  const x = position.x;
  const y = position.y + getTextOffset(options.anchor, offset);

  ctx.save();
  ctx.font = `${font.style} ${font.weight} ${font.size}px ${font.family}`;

  if (options.clip !== false) {
    const metrics = ctx.measureText(label);
    const halfWidth = metrics.width / 2;
    const top = y - (font.size ?? 11);
    const bottom = y + 4;
    if (
      x + halfWidth < chartArea.left ||
      x - halfWidth > chartArea.right ||
      bottom < chartArea.top ||
      top > chartArea.bottom
    ) {
      return;
    }
  }

  ctx.fillStyle = options.color ?? "#f8fafc";
  ctx.textAlign = options.textAlign ?? "center";
  ctx.textBaseline = getTextBaseline(options.anchor);

  if (options.clamp) {
    ctx.beginPath();
    ctx.rect(
      chartArea.left,
      chartArea.top,
      chartArea.right - chartArea.left,
      chartArea.bottom - chartArea.top,
    );
    ctx.clip();
  }

  ctx.fillText(label, x, y);
  ctx.restore();
}

export const barValueLabelsPlugin: Plugin<ChartType> = {
  id: "datalabels",
  afterDatasetsDraw(chart) {
    if (chart.getSortedVisibleDatasetMetas().some((meta) => meta.type !== "bar")) {
      return;
    }

    const options = (chart.options.plugins as ChartPluginsWithDataLabels | undefined)
      ?.datalabels;
    if (!options) {
      return;
    }

    for (let datasetIndex = 0; datasetIndex < chart.data.datasets.length; datasetIndex += 1) {
      const meta = chart.getDatasetMeta(datasetIndex);
      if (meta.hidden) {
        continue;
      }

      for (let dataIndex = 0; dataIndex < meta.data.length; dataIndex += 1) {
        drawValueLabel(chart as Chart<"bar">, datasetIndex, dataIndex, options);
      }
    }
  },
};