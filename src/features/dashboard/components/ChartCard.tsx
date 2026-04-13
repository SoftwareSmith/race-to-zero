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
import { getLineChartOptions } from "@dashboard/utils/chartConfig";
import { cn } from "@shared/utils/cn";
import type { ChartFocusState } from "../../../types/dashboard";

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
        "group relative flex min-h-0 flex-col overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,12,18,0.96),rgba(19,23,32,0.96))] p-3.5 text-stone-50 shadow-[0_18px_38px_rgba(0,0,0,0.28)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_22px_46px_rgba(0,0,0,0.32)]",
        className,
      )}
      onMouseLeave={() => onHoverStateChange?.(null)}
    >
      <div className="pointer-events-none absolute inset-0 opacity-0 transition duration-200 group-hover:opacity-100">
        <div className="absolute -left-6 top-8 h-28 w-28 rounded-full bg-sky-400/12 blur-3xl" />
        <div className="absolute bottom-4 right-4 h-24 w-24 rounded-full bg-teal-400/10 blur-3xl" />
      </div>
      <div className="absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.14),transparent_60%)]" />
      <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent opacity-0 transition duration-200 group-hover:opacity-100" />
      <div className="relative flex h-full flex-col">
        <div className="shrink-0">
          <h3 className="mt-0.5 font-display text-[1.55rem] leading-tight tracking-[-0.04em] text-stone-50 sm:text-[1.85rem]">
            {title}
          </h3>
          {description ? (
            <p className="mt-1.5 w-full text-[0.76rem] leading-5 text-stone-300">
              {description}
            </p>
          ) : null}
        </div>

        <div
          className={cn(
            "mt-2.5 h-[192px] shrink-0 sm:h-[208px] xl:h-[224px]",
            description ? "sm:mt-3" : "",
          )}
        >
          {variant === "bar" ? (
            <Bar data={data as BarChartData} options={options} />
          ) : (
            <Line data={data as LineChartData} options={options} />
          )}
        </div>

        {summary ? (
          <p className="mt-2 shrink-0 max-w-2xl text-[0.72rem] leading-5 text-stone-400">
            {summary}
          </p>
        ) : null}
      </div>
    </article>
  );
});

export default ChartCard;
