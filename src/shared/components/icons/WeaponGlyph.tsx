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
  // ── Hammer ─────────────────────────────────────────────────────────
  if (id === "hammer") {
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        {...SVG_BASE}
        strokeWidth="1.7"
      >
        {/* Handle */}
        <line x1="5" y1="19" x2="15" y2="9" strokeLinecap="round" />
        {/* Hammerhead */}
        <rect
          x="13"
          y="3"
          width="8"
          height="5"
          rx="1.2"
          transform="rotate(45 17 5.5)"
        />
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

  // ── Fork Bomb (clustered duplicate payloads) ───────────────────────
  if (id === "plasma") {
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        {...SVG_BASE}
        strokeWidth="1.6"
      >
        <circle cx="12" cy="12" r="3.1" />
        <circle cx="12" cy="5" r="2.1" />
        <circle cx="19" cy="12" r="2.1" />
        <circle cx="12" cy="19" r="2.1" />
        <circle cx="5" cy="12" r="2.1" />
        <path d="M12 8.9 L12 7.2" opacity="0.65" />
        <path d="M15.1 12 L16.8 12" opacity="0.65" />
        <path d="M12 15.1 L12 16.8" opacity="0.65" />
        <path d="M8.9 12 L7.2 12" opacity="0.65" />
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

  if (id === "beacon") {
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        {...SVG_BASE}
        strokeWidth="1.6"
      >
        <circle cx="12" cy="12" r="3.2" />
        <circle cx="12" cy="12" r="7" strokeDasharray="2.4 2.2" />
        <path d="M12 2.5 V6" />
        <path d="M21.5 12 H18" />
        <path d="M12 21.5 V18" />
        <path d="M2.5 12 H6" />
      </svg>
    );
  }

  if (id === "daemon") {
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        {...SVG_BASE}
        strokeWidth="1.6"
      >
        <path d="M6 8.5 C6 5.8 8.2 4 12 4 C15.8 4 18 5.8 18 8.5 C18 11.2 16.3 13.1 12 17.5 C7.7 13.1 6 11.2 6 8.5 Z" />
        <path d="M12 10.5 L12 20" />
        <path d="M9 17.5 L12 20 L15 17.5" />
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
