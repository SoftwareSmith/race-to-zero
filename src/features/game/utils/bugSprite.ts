import { BUG_VARIANT_CONFIG, getBugVariantColor } from "../../../constants/bugs";
import type { BugVariant } from "../../../types/dashboard";

import lowRaw from "../../../assets/bugs/low.svg?raw";
import mediumRaw from "../../../assets/bugs/medium.svg?raw";
import highRaw from "../../../assets/bugs/high.svg?raw";
import urgentRaw from "../../../assets/bugs/urgent.svg?raw";

export interface BugSpriteOptions {
  color?: string;
  opacity?: number;
  rotation?: number;
  size: number;
  statusFlags?: {
    ally?: boolean | number;
    burn?: boolean | number;
    charged?: boolean | number;
    ensnare?: boolean | number;
    freeze?: boolean | number;
    marked?: boolean | number;
    poison?: boolean | number;
    unstable?: boolean | number;
  };
  timeMs?: number;
  variant?: BugVariant;
  x: number;
  y: number;
}

const STATUS_TINTS = {
  ally: "rgba(0, 255, 140, 0.40)",
  burn: "rgba(255, 80, 0, 0.45)",
  charged: "rgba(0, 230, 255, 0.35)",
  ensnare: "rgba(255, 230, 100, 0.40)",
  freeze: "rgba(100, 200, 255, 0.40)",
  marked: "rgba(180, 80, 255, 0.40)",
  poison: "rgba(80, 220, 60, 0.35)",
  unstable: "rgba(150, 0, 255, 0.50)",
} as const;

const BUG_RAW_SVGS: Record<BugVariant, string> = {
  high: highRaw,
  low: lowRaw,
  medium: mediumRaw,
  urgent: urgentRaw,
};

const SPRITE_FORWARD_ROTATION_OFFSET = Math.PI / 2 + Math.PI / 18;

function getStatusStrength(value: boolean | number | undefined) {
  if (typeof value === "number") {
    return Math.max(0, Math.min(1, value));
  }

  return value ? 1 : 0;
}

function drawStatusAura(
  ctx: CanvasRenderingContext2D,
  size: number,
  timeMs: number,
  statusFlags: NonNullable<BugSpriteOptions["statusFlags"]>,
) {
  const radius = size * 0.56;
  const poisonStrength = getStatusStrength(statusFlags.poison);
  const markedStrength = getStatusStrength(statusFlags.marked);
  const ensnareStrength = getStatusStrength(statusFlags.ensnare);
  const chargedStrength = getStatusStrength(statusFlags.charged);

  if (poisonStrength > 0) {
    const pulse = 0.82 + Math.sin(timeMs * 0.01) * 0.12;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = `rgba(120, 255, 110, ${(0.16 + poisonStrength * 0.28) + Math.sin(timeMs * 0.008) * 0.04})`;
    ctx.lineWidth = Math.max(1, size * (0.03 + poisonStrength * 0.02));
    ctx.beginPath();
    ctx.arc(0, 0, radius * (pulse * (0.88 + poisonStrength * 0.18)), 0, Math.PI * 2);
    ctx.stroke();

    for (let index = 0; index < 3; index += 1) {
      const angle = timeMs * 0.0028 + index * ((Math.PI * 2) / 3);
      const dropletRadius = radius * (0.68 + index * 0.08);
      const dropletX = Math.cos(angle) * dropletRadius;
      const dropletY = Math.sin(angle * 1.2) * dropletRadius * 0.65;
      ctx.fillStyle = `rgba(166, 255, 128, ${0.08 + poisonStrength * 0.16 + index * 0.04})`;
      ctx.beginPath();
      ctx.arc(
        dropletX,
        dropletY,
        Math.max(1.2, size * (0.035 + poisonStrength * 0.025) - index * 0.12),
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    ctx.restore();
  }

  if (markedStrength > 0) {
    ctx.save();
    ctx.strokeStyle = `rgba(244, 114, 182, ${0.14 + markedStrength * 0.26})`;
    ctx.lineWidth = Math.max(1, size * (0.025 + markedStrength * 0.015));
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.92, Math.PI * 0.12, Math.PI * 1.88);
    ctx.stroke();
    ctx.restore();
  }

  if (ensnareStrength > 0) {
    ctx.save();
    ctx.strokeStyle = `rgba(250, 204, 21, ${0.12 + ensnareStrength * 0.22})`;
    ctx.lineWidth = Math.max(1, size * (0.02 + ensnareStrength * 0.015));
    for (let index = 0; index < 3; index += 1) {
      const offset = ((timeMs * 0.003 + index * 0.33) % 1) * radius * 1.6 - radius * 0.8;
      ctx.beginPath();
      ctx.moveTo(-radius * 0.85, offset);
      ctx.lineTo(radius * 0.85, offset - radius * 0.22);
      ctx.stroke();
    }
    ctx.restore();
  }

  if (chargedStrength > 0) {
    ctx.save();
    ctx.strokeStyle = `rgba(103, 232, 249, ${0.12 + chargedStrength * 0.22})`;
    ctx.lineWidth = Math.max(1, size * (0.025 + chargedStrength * 0.012));
    ctx.beginPath();
    ctx.moveTo(-radius * 0.5, -radius * 0.2);
    ctx.lineTo(-radius * 0.08, -radius * 0.5);
    ctx.lineTo(radius * 0.1, -radius * 0.05);
    ctx.lineTo(radius * 0.45, -radius * 0.34);
    ctx.stroke();
    ctx.restore();
  }
}

/* ---------------------------------- */
/* Utilities */
/* ---------------------------------- */

function clampColorChannel(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function expandHexColor(value: string) {
  if (value.length === 3 || value.length === 4) {
    return value
      .split("")
      .slice(0, 3)
      .map((channel) => channel + channel)
      .join("");
  }

  return value.slice(0, 6);
}

function parseColorToRgb(color: string) {
  const trimmedColor = color.trim();

  if (trimmedColor.startsWith("#")) {
    const normalizedHex = expandHexColor(trimmedColor.slice(1));
    const parsed = Number.parseInt(normalizedHex, 16);

    return {
      b: parsed & 255,
      g: (parsed >> 8) & 255,
      r: (parsed >> 16) & 255,
    };
  }

  const rgbMatch = trimmedColor.match(/^rgba?\(([^)]+)\)$/i);
  if (rgbMatch) {
    const [r = 0, g = 0, b = 0] = rgbMatch[1]
      .split(",")
      .slice(0, 3)
      .map((channel) => Number.parseFloat(channel.trim()));

    return { b, g, r };
  }

  return { b: 255, g: 255, r: 255 };
}

function darkenColor(color: string, factor: number) {
  const { b, g, r } = parseColorToRgb(color);

  return `rgb(${clampColorChannel(r * factor)}, ${clampColorChannel(g * factor)}, ${clampColorChannel(b * factor)})`;
}

function colorizeSvg(raw: string, color: string) {
  if (raw.includes("currentColor")) {
    return raw.replace(/<svg\b([^>]*)>/, `<svg$1 style="color: ${color};">`);
  }

  return raw
    .replace(/fill="[^"]*"/g, `fill="${color}"`)
    .replace(/stroke="[^"]*"/g, `stroke="${color}"`);
}

/* ---------------------------------- */
/* Caching */
/* ---------------------------------- */

const urlCache = new Map<string, string>();
const imageCache = new Map<string, HTMLImageElement>();

export function getColoredSvgUrl(variant: BugVariant, baseColor: string) {
  const config = BUG_VARIANT_CONFIG[variant];

  const finalColor = darkenColor(baseColor, config.darken);
  const key = `${variant}|${finalColor}`;

  if (urlCache.has(key)) return urlCache.get(key)!;

  const colored = colorizeSvg(BUG_RAW_SVGS[variant], finalColor);
  const blob = new Blob([colored], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);

  urlCache.set(key, url);
  return url;
}

export function getRawSvgForVariant(variant: BugVariant) {
  return BUG_RAW_SVGS[variant];
}

function getCachedImage(variant: BugVariant, color: string) {
  const config = BUG_VARIANT_CONFIG[variant];
  const finalColor = darkenColor(color, config.darken);
  const key = `${variant}|${finalColor}`;

  if (imageCache.has(key)) return imageCache.get(key)!;

  const img = new Image();
  img.src = getColoredSvgUrl(variant, color);

  imageCache.set(key, img);
  return img;
}

/* ---------------------------------- */
/* Optional Fallback Draw */
/* ---------------------------------- */

function drawFallbackBug(ctx: CanvasRenderingContext2D) {
  ctx.beginPath();
  ctx.arc(0, 0, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(0, -6, 3, 0, Math.PI * 2);
  ctx.fill();
}

/* ---------------------------------- */
/* Main Draw Function */
/* ---------------------------------- */

export function drawBugSprite(
  ctx: CanvasRenderingContext2D,
  {
    color,
    opacity,
    rotation = 0,
    size,
    statusFlags,
    timeMs = 0,
    variant = "low",
    x,
    y,
  }: BugSpriteOptions,
) {
  const config = BUG_VARIANT_CONFIG[variant];
  const baseColor = color ?? getBugVariantColor(variant);

  const finalOpacity = opacity ?? config.defaultOpacity;
  const burnScale = statusFlags?.burn
    ? 1 + Math.sin(timeMs * 0.05) * 0.02
    : 1;
  const finalSize = size * config.baseScale * burnScale;

  const img = getCachedImage(variant, baseColor);

  const draw = () => {
    ctx.save();

    ctx.translate(x, y);
    ctx.rotate(rotation + SPRITE_FORWARD_ROTATION_OFFSET);
    ctx.globalAlpha = finalOpacity;

    ctx.drawImage(
      img,
      -finalSize / 2,
      -finalSize / 2,
      finalSize,
      finalSize,
    );

    if (statusFlags) {
      drawStatusAura(ctx, finalSize, timeMs, statusFlags);
    }

    if (statusFlags) {
      for (const [key, tint] of Object.entries(STATUS_TINTS) as Array<
        [keyof typeof STATUS_TINTS, string]
      >) {
        const strength = getStatusStrength(statusFlags[key]);
        if (strength <= 0) {
          continue;
        }

        ctx.save();
        ctx.globalCompositeOperation = "source-atop";
        ctx.globalAlpha = Math.max(0.14, strength);
        ctx.fillStyle = tint;
        ctx.fillRect(-finalSize / 2, -finalSize / 2, finalSize, finalSize);
        ctx.restore();
      }
    }

    ctx.restore();
  };

  if (img.complete) {
    draw();
  } else {
    // fallback while loading
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(finalSize / 24, finalSize / 24);
    ctx.globalAlpha = finalOpacity;
    ctx.fillStyle = darkenColor(baseColor, config.darken);

    drawFallbackBug(ctx);

    if (statusFlags) {
      drawStatusAura(ctx, finalSize, timeMs, statusFlags);
    }

    if (statusFlags) {
      for (const [key, tint] of Object.entries(STATUS_TINTS) as Array<
        [keyof typeof STATUS_TINTS, string]
      >) {
        const strength = getStatusStrength(statusFlags[key]);
        if (strength <= 0) {
          continue;
        }
        ctx.globalAlpha = Math.max(0.14, strength);
        ctx.globalCompositeOperation = "source-atop";
        ctx.fillStyle = tint;
        ctx.fillRect(-12, -12, 24, 24);
      }
    }

    ctx.restore();
  }
}