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
  void siegeMode;
  const styles = CARD_TONE_STYLES[tone] ?? CARD_TONE_STYLES.neutral;
  const card = (
    <article
      data-siege-panel={label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}
      className={cn(
        "group relative flex h-full min-h-[88px] flex-col overflow-hidden rounded-[20px] border px-3 py-2.5 shadow-[0_12px_24px_rgba(0,0,0,0.18)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_15px_30px_rgba(0,0,0,0.22)]",
        styles.card,
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[22px] opacity-0 transition duration-200 group-hover:opacity-100">
        <div className="absolute inset-x-4 top-3 h-14 rounded-full bg-white/8 blur-2xl" />
        <div
          className={cn(
            "absolute inset-x-6 bottom-1 h-12 rounded-full blur-2xl",
            getGlowClassName(tone),
          )}
        />
      </div>
      <div className="absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-0 transition duration-200 group-hover:opacity-100" />
      <div className="relative flex items-start gap-3">
        <span
          className={cn(
            "text-[0.58rem] font-semibold uppercase tracking-[0.22em]",
            styles.eyebrow,
          )}
        >
          {label}
        </span>
      </div>
      <strong
        className={cn(
          "relative mt-2.5 flex-1 font-display text-[1.7rem] leading-none tracking-[-0.05em] sm:text-[2rem]",
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
