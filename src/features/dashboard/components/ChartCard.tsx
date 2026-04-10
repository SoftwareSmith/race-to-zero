import { memo, useMemo } from "react";
import {
  type ActiveElement,
  BarElement,
  CategoryScale,
  type ChartData,
  type ChartEvent,
  type ChartType,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { Bar, Line } from "react-chartjs-2";
import { getLineChartOptions } from "../utils/chartConfig";
import { cn } from "../utils/cn";
import type { ChartFocusState } from "../types/dashboard";

ChartJS.register(
  BarElement,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
  ChartDataLabels,
);

type ChartVariant = "bar" | "line";
type BarChartData = ChartData<"bar", number[], string>;
type LineChartData = ChartData<"line", Array<number | null>, string>;

interface ChartCardProps {
  chartKey: string;
  className?: string;
  data: BarChartData | LineChartData;
  description?: string;
  onHoverStateChange?: (nextFocus: ChartFocusState | null) => void;
  siegeMode?: boolean;
  summary?: string;
  title: string;
  variant?: ChartVariant;
}

const ChartCard = memo(function ChartCard({
  title,
  description,
  summary,
  data,
  variant = "line",
  chartKey,
  className = "",
  onHoverStateChange,
  siegeMode = false,
}: ChartCardProps) {
  const options = useMemo(
    () => ({
      ...getLineChartOptions(variant, chartKey),
      onHover: (
        _event: ChartEvent,
        elements: ActiveElement[],
        chart: ChartJS<ChartType>,
      ) => {
        if (!onHoverStateChange) {
          return;
        }

        const activePoint = elements?.[0];
        if (!activePoint) {
          onHoverStateChange(null);
          return;
        }

        const labelCount = chart.data.labels?.length ?? 0;
        const relativeIndex =
          labelCount > 1 ? activePoint.index / (labelCount - 1) : 0.5;
        onHoverStateChange({
          chartKey,
          dataIndex: activePoint.index,
          datasetIndex: activePoint.datasetIndex,
          label: String(chart.data.labels?.[activePoint.index] ?? ""),
          relativeIndex,
        });
      },
    }),
    [chartKey, onHoverStateChange, variant],
  );

  return (
    <article
      data-siege-panel={chartKey}
      className={cn(
        "group relative overflow-hidden rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,12,18,0.96),rgba(19,23,32,0.96))] p-5 text-stone-50 shadow-[0_24px_60px_rgba(0,0,0,0.34)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_30px_70px_rgba(0,0,0,0.38)]",
        siegeMode
          ? "border-red-500/18 bg-[linear-gradient(180deg,rgba(25,10,14,0.96),rgba(19,23,32,0.96))]"
          : "",
        className,
      )}
      onMouseLeave={() => onHoverStateChange?.(null)}
    >
      {siegeMode ? (
        <>
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(248,113,113,0.12),transparent_30%),linear-gradient(135deg,rgba(248,113,113,0.04),transparent_42%,rgba(56,189,248,0.05))]" />
          <div className="pointer-events-none absolute left-5 top-5 rounded-full border border-red-300/20 bg-red-500/10 px-2 py-1 text-[0.54rem] font-semibold uppercase tracking-[0.22em] text-red-100/78">
            Under siege
          </div>
        </>
      ) : null}
      <div className="pointer-events-none absolute inset-0 opacity-0 transition duration-200 group-hover:opacity-100">
        <div className="absolute -left-6 top-8 h-28 w-28 rounded-full bg-sky-400/12 blur-3xl" />
        <div className="absolute bottom-4 right-4 h-24 w-24 rounded-full bg-teal-400/10 blur-3xl" />
      </div>
      <div className="absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.14),transparent_60%)]" />
      <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent opacity-0 transition duration-200 group-hover:opacity-100" />
      <div className="relative">
        <div>
          <h3 className="mt-2 font-display text-3xl leading-tight tracking-[-0.04em] text-stone-50">
            {title}
          </h3>
          {description ? (
            <p className="mt-3 w-full text-sm leading-7 text-stone-300">
              {description}
            </p>
          ) : null}
        </div>

        <div
          className={cn(
            "h-[320px] sm:h-[360px]",
            description ? "mt-6" : "mt-4",
          )}
        >
          {variant === "bar" ? (
            <Bar data={data as BarChartData} options={options} />
          ) : (
            <Line data={data as LineChartData} options={options} />
          )}
        </div>

        {summary ? (
          <p className="mt-4 max-w-2xl text-sm leading-6 text-stone-400">
            {summary}
          </p>
        ) : null}
      </div>
    </article>
  );
});

export default ChartCard;
