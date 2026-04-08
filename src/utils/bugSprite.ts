import { BUG_VARIANT_CONFIG, getBugVariantColor } from "../constants/bugs";
import type { BugVariant } from "../types/dashboard";

import lowRaw from "../assets/bugs/low.svg?raw";
import mediumRaw from "../assets/bugs/medium.svg?raw";
import highRaw from "../assets/bugs/high.svg?raw";
import urgentRaw from "../assets/bugs/urgent.svg?raw";

export interface BugSpriteOptions {
  color?: string;
  opacity?: number;
  rotation?: number;
  size: number;
  variant?: BugVariant;
  x: number;
  y: number;
}

const BUG_RAW_SVGS: Record<BugVariant, string> = {
  high: highRaw,
  low: lowRaw,
  medium: mediumRaw,
  urgent: urgentRaw,
};

const SPRITE_FORWARD_ROTATION_OFFSET = Math.PI / 2 + Math.PI / 18;

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

function getColoredSvgUrl(variant: BugVariant, baseColor: string) {
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
    variant = "low",
    x,
    y,
  }: BugSpriteOptions,
) {
  const config = BUG_VARIANT_CONFIG[variant];
  const baseColor = color ?? getBugVariantColor(variant);

  const finalOpacity = opacity ?? config.defaultOpacity;
  const finalSize = size * config.baseScale;

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

    ctx.restore();
  }
}