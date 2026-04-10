import Tooltip from "@shared/components/Tooltip";
import { cn } from "@shared/utils/cn";
import {
  CARD_TONE_STYLES,
  CARD_GLOW_CLASSES,
} from "@shared/styles/toneClasses";
import type { Tone } from "../../../types/dashboard";

interface MetricCardProps {
  className?: string;
  hint?: string;
  label: string;
  siegeMode?: boolean;
  tone?: Tone;
  value: string;
}

function getGlowClassName(tone: Tone) {
  return CARD_GLOW_CLASSES[tone] ?? CARD_GLOW_CLASSES.neutral;
}

function MetricCard({
  className = "",
  hint,
  label,
  siegeMode = false,
  tone = "neutral",
  value,
}: MetricCardProps) {
  const styles = CARD_TONE_STYLES[tone] ?? CARD_TONE_STYLES.neutral;
  const card = (
    <article
      data-siege-panel={label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}
      className={cn(
        "group relative flex min-h-[160px] flex-col overflow-hidden rounded-[22px] border p-5 shadow-[0_14px_34px_rgba(0,0,0,0.2)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_20px_48px_rgba(0,0,0,0.28)]",
        siegeMode
          ? "border-red-500/18 bg-[linear-gradient(180deg,rgba(33,9,14,0.66),rgba(12,14,20,0.9))]"
          : "",
        styles.card,
        className,
      )}
    >
      {siegeMode ? (
        <>
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(248,113,113,0.08),transparent_36%,rgba(56,189,248,0.08))]" />
          <div className="pointer-events-none absolute inset-x-4 top-3 h-px bg-gradient-to-r from-transparent via-red-200/55 to-transparent opacity-70" />
          <div className="pointer-events-none absolute right-3 top-3 rounded-full border border-red-200/20 bg-red-500/10 px-2 py-1 text-[0.54rem] font-semibold uppercase tracking-[0.22em] text-red-100/78">
            Infested
          </div>
        </>
      ) : null}
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[22px] opacity-0 transition duration-200 group-hover:opacity-100">
        <div className="absolute inset-x-4 top-3 h-14 rounded-full bg-white/8 blur-2xl" />
        <div
          className={cn(
            "absolute inset-x-6 bottom-2 h-16 rounded-full blur-2xl",
            getGlowClassName(tone),
          )}
        />
      </div>
      <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-0 transition duration-200 group-hover:opacity-100" />
      <div className="relative flex items-start gap-3">
        <span
          className={cn(
            "text-[0.72rem] font-semibold uppercase tracking-[0.24em]",
            styles.eyebrow,
          )}
        >
          {label}
        </span>
      </div>
      <strong
        className={cn(
          "relative mt-5 flex-1 font-display text-4xl leading-none tracking-[-0.04em] sm:text-[2.8rem]",
          styles.value,
        )}
      >
        {value}
      </strong>
    </article>
  );

  if (!hint) {
    return card;
  }

  return (
    <Tooltip content={hint} triggerClassName="block h-full">
      {card}
    </Tooltip>
  );
}

export default MetricCard;
