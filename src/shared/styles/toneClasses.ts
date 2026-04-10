/**
 * Shared Tailwind class maps keyed by Tone ("positive" | "negative" | "neutral").
 * Each component context needs a slightly different treatment, so separate
 * named exports are provided — but the color families are defined once here.
 *
 * Color semantics:
 *   positive → emerald
 *   negative → red
 *   neutral  → sky
 */

import type { Tone } from "../../types/dashboard";

// ── Tag / badge surface (e.g. StatusTag) ─────────────────────────────────────

export const TAG_TONE_CLASSES: Record<Tone, string> = {
  positive:
    "border-emerald-400/28 bg-emerald-500/12 text-emerald-200 shadow-[0_0_22px_rgba(16,185,129,0.12)]",
  negative:
    "border-red-400/28 bg-red-500/12 text-red-200 shadow-[0_0_22px_rgba(239,68,68,0.12)]",
  neutral:
    "border-sky-400/28 bg-sky-500/10 text-sky-100 shadow-[0_0_22px_rgba(56,189,248,0.1)]",
};

// ── Metric card surface (e.g. MetricCard) ────────────────────────────────────

export interface CardToneStyle {
  card: string;
  copy: string;
  eyebrow: string;
  value: string;
}

export const CARD_TONE_STYLES: Record<Tone, CardToneStyle> = {
  positive: {
    card: "border-emerald-500/26 bg-emerald-950/18",
    eyebrow: "text-emerald-300",
    value: "text-emerald-200",
    copy: "text-emerald-100/70",
  },
  negative: {
    card: "border-red-500/26 bg-red-950/18",
    eyebrow: "text-red-300",
    value: "text-red-200",
    copy: "text-red-100/70",
  },
  neutral: {
    card: "border-sky-500/24 bg-sky-950/12",
    eyebrow: "text-sky-200",
    value: "text-sky-100",
    copy: "text-sky-50/70",
  },
};

/** Background glow spot that sits behind a metric card. */
export const CARD_GLOW_CLASSES: Record<Tone, string> = {
  positive: "bg-emerald-400/18",
  negative: "bg-red-400/16",
  neutral: "bg-sky-400/16",
};

// ── Panel / surface (e.g. Surface component positive/negative/neutral tones) ──

export const PANEL_TONE_CLASSES: Record<Tone, string> = {
  positive:
    "border-emerald-500/30 bg-emerald-950/22 text-emerald-50 shadow-[0_18px_48px_rgba(16,185,129,0.14)]",
  negative:
    "border-red-500/30 bg-red-950/22 text-red-50 shadow-[0_18px_48px_rgba(239,68,68,0.14)]",
  neutral:
    "border-sky-500/28 bg-sky-950/16 text-sky-50 shadow-[0_18px_48px_rgba(56,189,248,0.12)]",
};
