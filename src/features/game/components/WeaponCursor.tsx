/**
 * WeaponCursor — a per-weapon custom cursor that tracks the mouse position.
 */

import { useEffect, useRef } from "react";
import { WEAPON_DEFS } from "@config/weaponConfig";
import { WeaponId } from "@game/types";
import type { SiegeWeaponId } from "@game/types";
import { cn } from "@shared/utils/cn";
import WeaponGlyph from "@shared/components/icons/WeaponGlyph";
import { getWeaponHeatProfile } from "@game/utils/weaponHeat";

interface WeaponCursorProps {
  hideSystemCursor?: boolean;
  lastFiredAt?: number;
  positionRef?: { current: { x: number; y: number } };
  weaponTier?: number;
  weaponId: SiegeWeaponId;
  swinging?: boolean;
}

function CursorReticle({
  lastFiredAt,
  weaponTier = 1,
  weaponId,
}: {
  lastFiredAt?: number;
  weaponTier?: number;
  weaponId: SiegeWeaponId;
}) {
  const weaponDef = WEAPON_DEFS.find((weapon) => weapon.id === weaponId);
  if (!weaponDef) return null;
  const theme = weaponDef.cursor;
  const heat = getWeaponHeatProfile(weaponTier);
  const cooldownMs = weaponDef.cooldownMs;
  const size = theme.size;
  const guide = Math.round(size * 0.22);
  const inner = Math.round(size * 0.42);
  const showOuterRing = !!theme.ringClassName;
  const showInnerRing = weaponId !== WeaponId.Hammer;
  const showCrosshair = theme.showCrosshair;
  const showCenterDot = weaponId !== WeaponId.Hammer;

  return (
    <div
      className="relative"
      style={{
        width: size,
        height: size,
        filter: `drop-shadow(${theme.aura}) drop-shadow(0 0 14px ${heat.glow})`,
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
      {showCenterDot ? (
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
      ) : null}
      <WeaponGlyph
        className={cn(
          "absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2",
          weaponId === WeaponId.Hammer
            ? "text-slate-50 drop-shadow-[0_0_10px_rgba(248,250,252,0.5)]"
            : undefined,
          heat.stage === "hot"
            ? "drop-shadow-[0_0_10px_rgba(239,68,68,0.22)]"
            : undefined,
          heat.stage === "overdrive"
            ? "drop-shadow-[0_0_12px_rgba(255,247,237,0.28)] [animation:heat-tier-flicker_2200ms_ease-in-out_infinite]"
            : undefined,
        )}
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
  positionRef,
  weaponTier = 1,
  weaponId,
  swinging = false,
}: WeaponCursorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const syncPosition = () => {
      const position = positionRef?.current;
      if (containerRef.current) {
        const hasLiveCursor =
          position != null &&
          Number.isFinite(position.x) &&
          Number.isFinite(position.y) &&
          (position.x !== 0 || position.y !== 0);

        containerRef.current.style.transform = hasLiveCursor
          ? `translate3d(${position.x}px, ${position.y}px, 0)`
          : "translate3d(-200px, -200px, 0)";
      }

      rafRef.current = window.requestAnimationFrame(syncPosition);
    };

    rafRef.current = window.requestAnimationFrame(syncPosition);

    return () => {
      if (rafRef.current != null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [positionRef]);

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
      className="weapon-cursor-layer pointer-events-none fixed left-0 top-0 z-[110] transition-opacity duration-100"
      style={{ transform: "translate3d(-200px, -200px, 0)", willChange: "transform" }}
    >
      <div
        className={
          weaponId === "hammer" && swinging
            ? "[animation:weapon-cursor-swing_180ms_ease-out]"
            : undefined
        }
        style={{
          transformOrigin: weaponId === "hammer" ? "34% 32%" : "50% 50%",
        }}
      >
        <div
          style={{
            transform: weaponId === "hammer" ? "translate(-18%, -16%)" : undefined,
          }}
        >
          <CursorReticle
            lastFiredAt={lastFiredAt}
            weaponTier={weaponTier}
            weaponId={weaponId}
          />
        </div>
      </div>
    </div>
  );
}
