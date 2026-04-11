import type { SiegeWeaponId } from "@config/weaponConfig";

interface WeaponGlyphProps {
  className?: string;
  id: SiegeWeaponId;
}

const SVG_BASE = {
  fill: "none" as const,
  stroke: "currentColor" as const,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export default function WeaponGlyph({ className, id }: WeaponGlyphProps) {
  // ── Wrench ─────────────────────────────────────────────────────────
  if (id === "wrench") {
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        {...SVG_BASE}
        strokeWidth="1.7"
      >
        <path d="M18.8 4.4a4.7 4.7 0 0 0-5.76 5.76L5.7 17.5a2.55 2.55 0 1 0 1.8 1.8l7.35-7.34a4.7 4.7 0 0 0 5.76-5.76l-2.58 2.58a1.2 1.2 0 0 1-1.7 0l-1.16-1.16a1.2 1.2 0 0 1 0-1.7z" />
        <circle cx="5.2" cy="18.8" r="1.35" strokeWidth="1.4" />
        <path d="M14.2 9.8l.95.95" strokeWidth="1.4" />
      </svg>
    );
  }

  // ── Bug Zapper (racket-style paddle with electrified grid) ─────────
  if (id === "zapper") {
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        {...SVG_BASE}
        strokeWidth="1.6"
      >
        {/* Oval cage housing */}
        <ellipse cx="12" cy="11" rx="7.5" ry="7" />
        {/* Handle */}
        <line x1="12" y1="18" x2="12" y2="22.5" strokeWidth="2.3" />
        {/* Cage vertical bars */}
        <line x1="8" y1="4.5" x2="8" y2="17.5" />
        <line x1="12" y1="4.1" x2="12" y2="17.9" />
        <line x1="16" y1="4.5" x2="16" y2="17.5" />
        {/* Electrified horizontal bar */}
        <line x1="4.6" y1="11" x2="19.4" y2="11" strokeWidth="1.9" />
        {/* Lightning bolt inside */}
        <path d="M13.5 8.5 L11 11 L13 11 L10.5 13.5" strokeWidth="1.7" />
      </svg>
    );
  }

  // ── Freeze Cone (six-arm ice crystal snowflake) ────────────────────
  // Arms: 0°/180° (vertical), 60°/240°, 120°/300° (all through center (12,12))
  // Branch V-forks at 55% along each arm tip direction
  if (id === "freeze") {
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        {...SVG_BASE}
        strokeWidth="1.5"
      >
        {/* 3 main arms through center */}
        <line x1="12" y1="2.5" x2="12" y2="21.5" />
        <line x1="20.2" y1="7.3" x2="3.8" y2="16.7" />
        <line x1="3.8" y1="7.3" x2="20.2" y2="16.7" />
        {/* Branch V-forks on each of the 6 arm tips (at 55% from center) */}
        <path d="M15 5.1 L12 6.8 L9 5.1" />
        <path d="M9 18.9 L12 17.2 L15 18.9" />
        <path d="M19.5 11.2 L16.5 9.4 L16.5 5.9" />
        <path d="M4.5 12.8 L7.5 14.6 L7.5 18.1" />
        <path d="M16.5 18.1 L16.5 14.6 L19.5 12.8" />
        <path d="M7.5 5.9 L7.5 9.4 L4.5 11.2" />
        {/* Center node */}
        <circle cx="12" cy="12" r="1.5" fill="currentColor" strokeWidth="0" />
      </svg>
    );
  }

  // ── Chain Zap (jagged lightning bolt with fork) ────────────────────
  if (id === "chain") {
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        {...SVG_BASE}
        strokeWidth="1.7"
      >
        {/* Main zigzag bolt */}
        <path d="M16 2 L11 10 L14.5 10 L7 22" strokeWidth="2.2" />
        {/* Y-fork sub-branches at bottom */}
        <path d="M7 22 L5 17.5" strokeWidth="1.4" />
        <path d="M7 22 L10.5 17" strokeWidth="1.4" />
        {/* Secondary arc from bolt mid-point */}
        <path d="M13 4 Q9.5 7 11 10" strokeWidth="1.2" opacity="0.65" />
      </svg>
    );
  }

  // ── Directional Laser (gun side-view + beam) ───────────────────────
  if (id === "laser") {
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        {...SVG_BASE}
        strokeWidth="1.6"
      >
        {/* Gun body */}
        <rect x="2" y="10" width="12" height="5" rx="1.2" />
        {/* Barrel extension */}
        <rect x="14" y="10.5" width="4.5" height="4" rx="0.8" />
        {/* Beam */}
        <line x1="18.5" y1="12.5" x2="23" y2="12.5" strokeWidth="2.2" />
        {/* Iron sight / scope */}
        <line x1="8" y1="10" x2="8" y2="7.5" />
        <line x1="5.5" y1="7.5" x2="10.5" y2="7.5" />
        {/* Grip */}
        <path d="M4.5 15 L4.5 18.5 Q4.5 19.5 5.5 19.5 L7.5 19.5 Q8.5 19.5 8.5 18.5 L8.5 15" />
        {/* Muzzle flash dot */}
        <circle cx="23" cy="12.5" r="1.2" fill="currentColor" strokeWidth="0" />
      </svg>
    );
  }

  // ── Shockwave (concentric rings + radial spike pairs) ──────────────
  if (id === "shockwave") {
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        {...SVG_BASE}
        strokeWidth="1.6"
      >
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5.5" />
        {/* Radial spike pairs at cardinal directions */}
        <path d="M12 3 L11 6 M12 3 L13 6" strokeWidth="1.1" opacity="0.7" />
        <path d="M21 12 L18 11 M21 12 L18 13" strokeWidth="1.1" opacity="0.7" />
        <path d="M12 21 L11 18 M12 21 L13 18" strokeWidth="1.1" opacity="0.7" />
        <path d="M3 12 L6 11 M3 12 L6 13" strokeWidth="1.1" opacity="0.7" />
      </svg>
    );
  }

  // ── Null Pointer (∅ void/null symbol) ─────────────────────────────
  if (id === "nullpointer") {
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        {...SVG_BASE}
        strokeWidth="1.6"
      >
        <circle cx="12" cy="12" r="9" />
        <line x1="4.3" y1="4.3" x2="19.7" y2="19.7" strokeWidth="2" />
        <circle cx="12" cy="12" r="4.5" strokeWidth="1" opacity="0.5" />
      </svg>
    );
  }

  // ── Flamethrower (pressure tank + nozzle + flame burst) ────────────
  if (id === "flame") {
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        {...SVG_BASE}
        strokeWidth="1.6"
      >
        {/* Tank body */}
        <rect x="1.5" y="9" width="8" height="7" rx="1.5" />
        {/* Nozzle tube */}
        <rect x="9.5" y="10.5" width="4" height="4" rx="0.8" />
        {/* Main flame teardrop (filled) */}
        <path
          d="M13.5 12.5 C16 8 21.5 9 20 13 C21.5 13 22 16.5 13.5 12.5 Z"
          fill="currentColor"
          opacity="0.75"
          strokeWidth="0"
        />
        {/* Flame outline strokes */}
        <path d="M13.5 12.5 C17 7.5 22.5 9 21 13" strokeWidth="1.4" />
        <path d="M13.5 12.5 C17 17.5 22.5 16 21 12.5" strokeWidth="1.4" />
        {/* Pressure gauge */}
        <circle cx="5.5" cy="12.5" r="1.5" strokeWidth="1.2" />
      </svg>
    );
  }

  // ── Plasma Arc (energised orb with radiating arcs) ─────────────────
  if (id === "plasma") {
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        {...SVG_BASE}
        strokeWidth="1.6"
      >
        {/* Central energised orb */}
        <circle cx="12" cy="12" r="3.5" strokeWidth="1.4" />
        {/* Radiating plasma arcs */}
        <path d="M12 8.5 C10 6 7.5 7 8 9.5" strokeWidth="1.3" />
        <path d="M15.5 12 C18 10 18 13.5 15.5 14.5" strokeWidth="1.3" />
        <path d="M12 15.5 C14 18 16.5 17 16 14.5" strokeWidth="1.3" />
        <path d="M8.5 12 C6 14 6 10.5 8.5 9.5" strokeWidth="1.3" />
        {/* Cardinal sparks */}
        <line x1="12" y1="3.5" x2="12" y2="2" strokeWidth="1.5" />
        <line x1="20.5" y1="12" x2="22" y2="12" strokeWidth="1.5" />
        <line x1="12" y1="20.5" x2="12" y2="22" strokeWidth="1.5" />
        <line x1="3.5" y1="12" x2="2" y2="12" strokeWidth="1.5" />
      </svg>
    );
  }

  // ── Void Pulse (shattered ring + collapsing vortex) ────────────────
  if (id === "void") {
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        {...SVG_BASE}
        strokeWidth="1.6"
      >
        {/* Outer shattering arcs */}
        <path d="M12 2 A10 10 0 0 1 20 7.5" strokeWidth="2" />
        <path d="M21.5 12 A10 10 0 0 1 12 22" strokeWidth="2" />
        <path d="M7.5 21.5 A10 10 0 0 1 2 12" strokeWidth="2" />
        <path d="M3.5 7 A10 10 0 0 1 8.5 2.5" strokeWidth="2" />
        {/* Inner collapsing ring */}
        <circle cx="12" cy="12" r="5.5" strokeDasharray="3 2" />
        {/* Central void core */}
        <circle cx="12" cy="12" r="2.5" fill="currentColor" strokeWidth="0" />
      </svg>
    );
  }

  // ── Fallback (null / unknown) ──────────────────────────────────────
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      {...SVG_BASE}
      strokeWidth="1.6"
    >
      <circle cx="12" cy="12" r="9" />
      <line x1="4.3" y1="4.3" x2="19.7" y2="19.7" strokeWidth="2" />
      <circle cx="12" cy="12" r="4.5" strokeWidth="1" opacity="0.5" />
    </svg>
  );
}
