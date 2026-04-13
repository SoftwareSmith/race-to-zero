/**
 * WeaponCursor — a per-weapon custom cursor that tracks the mouse position.
 */

import { useEffect, useRef } from "react";
import type React from "react";
import { WEAPON_DEFS } from "@config/weaponConfig";
import type { SiegeWeaponId, StructureId } from "@game/types";
import WeaponGlyph from "@shared/components/icons/WeaponGlyph";
import { cursorHandlers } from "@game/weapons/handlers";

interface WeaponCursorProps {
  hideSystemCursor?: boolean;
  lastFiredAt?: number;
  structureId?: StructureId;
  weaponId: SiegeWeaponId;
  swinging?: boolean;
}

// Per-weapon cursor config now lives in each weapon's constants.ts.
// cursorHandlers assembles them into a single lookup map.

function CursorReticle({
  lastFiredAt,
  structureId,
  weaponId,
}: {
  lastFiredAt?: number;
  structureId?: StructureId;
  weaponId: SiegeWeaponId;
}) {
  if (structureId) {
    const structureTheme: Record<
      StructureId,
      { accent: string; aura: string; icon: React.ReactElement; size: number }
    > = {
      lantern: {
        accent: "#fbbf24",
        aura: "0 0 24px rgba(251,191,36,0.35)",
        icon: <span className="text-xl leading-none">🔦</span>,
        size: 48,
      },
      agent: {
        accent: "#34d399",
        aura: "0 0 24px rgba(52,211,153,0.35)",
        icon: <span className="text-xl leading-none">🤖</span>,
        size: 48,
      },
      turret: {
        accent: "#22d3ee",
        aura: "0 0 24px rgba(34,211,238,0.35)",
        icon: <WeaponGlyph className="h-6 w-6 text-cyan-100" id="laser" />,
        size: 48,
      },
      tesla: {
        accent: "#c084fc",
        aura: "0 0 24px rgba(192,132,252,0.35)",
        icon: <span className="text-xl leading-none">⚡</span>,
        size: 50,
      },
      firewall: {
        accent: "#f97316",
        aura: "0 0 24px rgba(249,115,22,0.35)",
        icon: <span className="text-xl leading-none">🔥</span>,
        size: 50,
      },
    };
    const active = structureTheme[structureId];

    return (
      <div
        className="relative"
        style={{
          width: active.size,
          height: active.size,
          filter: `drop-shadow(${active.aura})`,
          transform: "translate(-50%, -50%)",
        }}
      >
        <div
          className="absolute inset-0 rounded-full border"
          style={{
            borderColor: `${active.accent}66`,
            background:
              "radial-gradient(circle at 38% 36%, rgba(255,255,255,0.18), rgba(2,6,23,0.6))",
          }}
        />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          {active.icon}
        </div>
      </div>
    );
  }

  const theme = cursorHandlers[weaponId];
  const cooldownMs =
    WEAPON_DEFS.find((weapon) => weapon.id === weaponId)?.cooldownMs ?? 0;
  const size = theme.size;
  const guide = Math.round(size * 0.22);
  const inner = Math.round(size * 0.42);
  const showOuterRing = !!theme.ringClassName;
  const showInnerRing = weaponId !== "hammer";
  const showCrosshair = theme.showCrosshair;

  return (
    <div
      className="relative"
      style={{
        width: size,
        height: size,
        filter: `drop-shadow(${theme.aura})`,
        transform: "translate(-50%, -50%)",
      }}
    >
      {showOuterRing ? (
        <div
          className={[
            "absolute inset-0 rounded-full border bg-black/20 backdrop-blur-[1px]",
            theme.ringClassName ?? "",
          ]
            .filter(Boolean)
            .join(" ")}
          style={{ borderColor: `${theme.accent}cc` }}
        />
      ) : null}
      {showInnerRing ? (
        <div
          className="absolute left-1/2 top-1/2 rounded-full border bg-black/28"
          style={{
            width: inner,
            height: inner,
            borderColor: `${theme.accent}99`,
            transform: "translate(-50%, -50%)",
          }}
        />
      ) : null}
      {showCrosshair ? (
        <>
          <div
            className="absolute left-1/2 top-0"
            style={{
              width: 1.5,
              height: guide,
              background: theme.accent,
              opacity: 0.95,
              transform: "translateX(-50%)",
            }}
          />
          <div
            className="absolute bottom-0 left-1/2"
            style={{
              width: 1.5,
              height: guide,
              background: theme.accent,
              opacity: 0.95,
              transform: "translateX(-50%)",
            }}
          />
          <div
            className="absolute left-0 top-1/2"
            style={{
              width: guide,
              height: 1.5,
              background: theme.accent,
              opacity: 0.95,
              transform: "translateY(-50%)",
            }}
          />
          <div
            className="absolute right-0 top-1/2"
            style={{
              width: guide,
              height: 1.5,
              background: theme.accent,
              opacity: 0.95,
              transform: "translateY(-50%)",
            }}
          />
        </>
      ) : null}
      <div
        className="absolute left-1/2 top-1/2 rounded-full"
        style={{
          width: 3,
          height: 3,
          background: theme.accent,
          boxShadow: `0 0 6px ${theme.accent}`,
          transform: "translate(-50%, -50%)",
        }}
      />
      <WeaponGlyph
        className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2"
        id={weaponId}
      />
      {cooldownMs > 0 && lastFiredAt != null ? (
        <div
          className="absolute left-1/2 top-full mt-1 h-1 w-[68%] -translate-x-1/2 overflow-hidden rounded-full border border-black/35 bg-black/45"
          style={{ boxShadow: `0 0 8px ${theme.accent}33` }}
        >
          <div
            key={lastFiredAt}
            className="h-full rounded-full"
            style={{
              background: `linear-gradient(90deg, ${theme.accent}, ${theme.accent}bb)`,
              animation: `reload-drain ${cooldownMs}ms linear forwards`,
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

export default function WeaponCursor({
  hideSystemCursor = false,
  lastFiredAt,
  structureId,
  weaponId,
  swinging = false,
}: WeaponCursorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const posRef = useRef({ x: -200, y: -200 });
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      posRef.current = { x: e.clientX, y: e.clientY };
      if (rafRef.current == null) {
        rafRef.current = window.requestAnimationFrame(() => {
          rafRef.current = null;
          if (containerRef.current) {
            containerRef.current.style.transform = `translate3d(${posRef.current.x}px, ${posRef.current.y}px, 0)`;
          }
        });
      }
    };

    window.addEventListener("mousemove", handleMove);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      if (rafRef.current != null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle("wrench-cursor-active", hideSystemCursor);

    return () => {
      document.body.classList.remove("wrench-cursor-active");
    };
  }, [hideSystemCursor]);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-[110]"
      style={{ transform: "translate3d(-200px, -200px, 0)" }}
    >
      <div
        className={
          weaponId === "hammer" && swinging
            ? "[animation:weapon-cursor-swing_180ms_ease-out]"
            : undefined
        }
        style={{
          transformOrigin:
            weaponId === "hammer" && !structureId ? "18% 18%" : "50% 50%",
        }}
      >
        <div
          style={{
            transform:
              weaponId === "hammer" && !structureId
                ? "translate(-30%, -28%)"
                : undefined,
          }}
        >
          <CursorReticle
            lastFiredAt={lastFiredAt}
            structureId={structureId}
            weaponId={weaponId}
          />
        </div>
      </div>
    </div>
  );
}
