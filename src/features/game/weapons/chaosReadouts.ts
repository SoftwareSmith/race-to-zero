import { WeaponId, WeaponTier } from "@game/types";
import type {
  ResolvedWeaponConfig,
  WeaponDef,
  WeaponTierDefinition,
} from "@game/weapons/types";
import { resolveWeaponConfig } from "./progression";

export interface WeaponChaosReadout {
  label: string;
  value: string;
}

function formatNumber(value: number, digits = 0) {
  return Number.isInteger(value) || digits === 0
    ? `${Math.round(value)}`
    : value.toFixed(digits);
}

function formatDuration(durationMs: number) {
  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }

  const seconds = durationMs / 1000;
  return Number.isInteger(seconds) ? `${seconds}s` : `${seconds.toFixed(1)}s`;
}

function formatDelta(
  current: number,
  previous: number | null,
  unit = "",
  digits = 0,
) {
  if (previous == null) {
    return `${formatNumber(current, digits)}${unit}`;
  }

  const delta = current - previous;
  if (Math.abs(delta) < 0.001) {
    return `${formatNumber(current, digits)}${unit}`;
  }

  const deltaPrefix = delta > 0 ? "+" : "";
  return `${deltaPrefix}${formatNumber(delta, digits)}${unit} (${formatNumber(current, digits)}${unit})`;
}

function getTierIndex(weapon: WeaponDef, tier: WeaponTierDefinition) {
  return weapon.tiers.findIndex((candidate) => candidate.tier === tier.tier);
}

function getCurrentConfig(weapon: WeaponDef, tier: WeaponTierDefinition) {
  return resolveWeaponConfig(weapon, tier.tier);
}

function getPreviousConfig(
  weapon: WeaponDef,
  tier: WeaponTierDefinition,
): ResolvedWeaponConfig | null {
  const tierIndex = getTierIndex(weapon, tier);
  if (tierIndex <= 0) {
    return null;
  }

  const previousTier = weapon.tiers[tierIndex - 1];
  return previousTier ? resolveWeaponConfig(weapon, previousTier.tier) : null;
}

export function getWeaponChaosReadouts(
  weapon: WeaponDef,
  tier: WeaponTierDefinition,
): WeaponChaosReadout[] {
  const current = getCurrentConfig(weapon, tier);
  const previous = getPreviousConfig(weapon, tier);

  switch (weapon.id) {
    case WeaponId.Hammer:
      return getHammerReadouts(current, previous, tier);
    case WeaponId.BugSpray:
      return getBugSprayReadouts(current, previous, tier);
    case WeaponId.ChainZap:
      return getChainZapReadouts(current, previous, tier);
    case WeaponId.NullPointer:
      return getNullPointerReadouts(current, previous, tier);
    case WeaponId.ForkBomb:
      return getForkBombReadouts(current, previous, tier);
    case WeaponId.VoidPulse:
      return getVoidPulseReadouts(current, previous);
    default:
      return [];
  }
}

function getHammerReadouts(
  current: ResolvedWeaponConfig,
  previous: ResolvedWeaponConfig | null,
  tier: WeaponTierDefinition,
): WeaponChaosReadout[] {
  const readouts: WeaponChaosReadout[] = [
    {
      label: "Impact Zone",
      value: formatDelta(current.hitRadius ?? 0, previous?.hitRadius ?? null, "px"),
    },
    {
      label: "Direct Damage",
      value: formatDelta(current.damage ?? 0, previous?.damage ?? null),
    },
  ];

  if (tier.tier === WeaponTier.TIER_TWO) {
    readouts.push({
      label: "Split Pressure",
      value: "High-HP bugs fork into weaker bodies on impact",
    });
  }

  if ((current.allyDurationMs ?? 0) > 0) {
    readouts.push({
      label: "Ally Hold",
      value:
        previous?.allyDurationMs == null
          ? `${formatDuration(current.allyDurationMs ?? 0)} temporary conversion`
          : formatDelta(
              current.allyDurationMs ?? 0,
              previous.allyDurationMs ?? null,
              "ms",
            ),
    });

    readouts.push({
      label: "Ally Cap",
      value:
        previous?.allyCap == null || previous.allyCap === 0
          ? `${formatNumber(current.allyCap ?? 0)} live allies`
          : formatDelta(current.allyCap ?? 0, previous.allyCap ?? null),
    });
    readouts.push({
      label: "Intercept Force",
      value:
        previous?.allyInterceptForce == null || previous.allyInterceptForce === 0
          ? `${formatNumber(current.allyInterceptForce ?? 0, 1)}x pursuit`
          : formatDelta(
              current.allyInterceptForce ?? 0,
              previous.allyInterceptForce ?? null,
              "x",
              1,
            ),
    });
    readouts.push({
      label: "Expire Burst",
      value:
        previous?.allyExpireBurstRadius == null || previous.allyExpireBurstRadius === 0
          ? `${formatNumber(current.allyExpireBurstRadius ?? 0)}px / ${formatNumber(current.allyExpireBurstDamage ?? 0)} dmg`
          : formatDelta(
              current.allyExpireBurstRadius ?? 0,
              previous.allyExpireBurstRadius ?? null,
              "px",
            ),
    });
  }

  return readouts;
}

function getBugSprayReadouts(
  current: ResolvedWeaponConfig,
  previous: ResolvedWeaponConfig | null,
  tier: WeaponTierDefinition,
): WeaponChaosReadout[] {
  const readouts: WeaponChaosReadout[] = [
    {
      label: "Spray Reach",
      value: formatDelta(current.hitRadius ?? 0, previous?.hitRadius ?? null, "px"),
    },
    {
      label: "Cloud Radius",
      value: formatDelta(current.cloudRadius ?? 0, previous?.cloudRadius ?? null, "px"),
    },
    {
      label: "Poison Tick",
      value: formatDelta(current.poisonDps ?? 0, previous?.poisonDps ?? null, " DPS", 2),
    },
  ];

  if ((current.secondaryRadius ?? 0) > 0) {
    readouts.push({
      label: "Secondary Cloud",
      value:
        previous?.secondaryRadius == null
          ? `${formatNumber(current.secondaryRadius ?? 0)}px seed radius`
          : formatDelta(
              current.secondaryRadius ?? 0,
              previous.secondaryRadius ?? null,
              "px",
            ),
    });
  }

  if (tier.tier === WeaponTier.TIER_THREE) {
    readouts.push({
      label: "Cloud Uptime",
      value: formatDelta(
        current.cloudDurationMs ?? 0,
        previous?.cloudDurationMs ?? null,
        "ms",
      ),
    });
  }

  return readouts;
}

function getChainZapReadouts(
  current: ResolvedWeaponConfig,
  previous: ResolvedWeaponConfig | null,
  tier: WeaponTierDefinition,
): WeaponChaosReadout[] {
  const readouts: WeaponChaosReadout[] = [
    {
      label: "Bounce Count",
      value: formatDelta(
        current.chainMaxBounces ?? 0,
        previous?.chainMaxBounces ?? null,
      ),
    },
    {
      label: "Link Radius",
      value: formatDelta(
        current.chainRadius ?? 0,
        previous?.chainRadius ?? null,
        "px",
      ),
    },
    {
      label: "Arc Width",
      value: formatDelta(
        current.beamWidth ?? 0,
        previous?.beamWidth ?? null,
        "px",
        1,
      ),
    },
    {
      label: "Branch Chaos",
      value: formatDelta(
        current.chaosScale ?? 1,
        previous?.chaosScale ?? null,
        "x",
        2,
      ),
    },
  ];

  if (tier.tier >= WeaponTier.TIER_TWO) {
    readouts.push({
      label: "Status Payload",
      value: tier.tier === WeaponTier.TIER_TWO ? "Charged arcs go live" : "Charged arcs persist",
    });
  }

  if ((current.secondaryDamage ?? 0) > 0) {
    readouts.push({
      label: "Network Pulse",
      value:
        previous?.secondaryDamage == null
          ? `${formatNumber(current.secondaryDamage ?? 0)} damage to Charged bugs`
          : formatDelta(
              current.secondaryDamage ?? 0,
              previous.secondaryDamage ?? null,
              " dmg",
            ),
    });
  }

  return readouts;
}

function getNullPointerReadouts(
  current: ResolvedWeaponConfig,
  previous: ResolvedWeaponConfig | null,
  tier: WeaponTierDefinition,
): WeaponChaosReadout[] {
  const readouts: WeaponChaosReadout[] = [
    {
      label: "Target Locks",
      value: formatDelta(current.targetCount ?? 0, previous?.targetCount ?? null),
    },
    {
      label: "Beam Width",
      value: formatDelta(
        current.beamWidth ?? 0,
        previous?.beamWidth ?? null,
        "px",
        1,
      ),
    },
    {
      label: "Impact Ring",
      value: formatDelta(
        current.impactRadius ?? 0,
        previous?.impactRadius ?? null,
        "px",
      ),
    },
    {
      label: "Burst Density",
      value: formatDelta(
        current.binaryBurstCount ?? 0,
        previous?.binaryBurstCount ?? null,
      ),
    },
  ];

  if (tier.tier === WeaponTier.TIER_THREE) {
    readouts.push({
      label: "Cycle Time",
      value: formatDelta(
        current.cooldownMs ?? 0,
        previous?.cooldownMs ?? null,
        "ms",
      ),
    });
  }

  return readouts;
}

function getForkBombReadouts(
  current: ResolvedWeaponConfig,
  previous: ResolvedWeaponConfig | null,
  tier: WeaponTierDefinition,
): WeaponChaosReadout[] {
  const readouts: WeaponChaosReadout[] = [
    {
      label: "Cluster Count",
      value: formatDelta(
        current.clusterCount ?? 0,
        previous?.clusterCount ?? null,
      ),
    },
    {
      label: "Implosion Size",
      value: formatDelta(
        current.implosionRadius ?? 0,
        previous?.implosionRadius ?? null,
        "px",
      ),
    },
    {
      label: "Spread Radius",
      value: formatDelta(
        current.burstOffsetDistance ?? 0,
        previous?.burstOffsetDistance ?? null,
        "px",
      ),
    },
  ];

  if ((current.secondaryRadius ?? 0) > 0) {
    readouts.push({
      label: "Child Blasts",
      value:
        previous?.secondaryRadius == null
          ? `${formatNumber(current.secondaryRadius ?? 0)}px recursive burst`
          : formatDelta(
              current.secondaryRadius ?? 0,
              previous.secondaryRadius ?? null,
              "px",
            ),
    });
  }

  if ((current.ringCount ?? 0) > 0 && tier.tier >= WeaponTier.TIER_THREE) {
    readouts.push({
      label: "Outer Ring",
      value:
        previous?.ringCount == null
          ? `${formatNumber(current.ringCount ?? 0)} detonation points`
          : formatDelta(current.ringCount ?? 0, previous.ringCount ?? null),
    });
  }

  if ((current.ringRadius ?? 0) > 0 && tier.tier >= WeaponTier.TIER_THREE) {
    readouts.push({
      label: "Ring Radius",
      value:
        previous?.ringRadius == null
          ? `${formatNumber(current.ringRadius ?? 0)}px`
          : formatDelta(current.ringRadius ?? 0, previous.ringRadius ?? null, "px"),
    });
  }

  if (tier.tier === WeaponTier.TIER_ONE) {
    readouts.push({ label: "Burst Pattern", value: "Five-point cluster detonation" });
  }

  return readouts;
}

function getVoidPulseReadouts(
  current: ResolvedWeaponConfig,
  previous: ResolvedWeaponConfig | null,
): WeaponChaosReadout[] {
  const readouts: WeaponChaosReadout[] = [
    {
      label: "Collapse Radius",
      value: formatDelta(
        current.blackHoleRadius ?? 0,
        previous?.blackHoleRadius ?? null,
        "px",
      ),
    },
    {
      label: "Core Radius",
      value: formatDelta(
        current.blackHoleCoreRadius ?? 0,
        previous?.blackHoleCoreRadius ?? null,
        "px",
      ),
    },
    {
      label: "Well Duration",
      value:
        previous?.blackHoleDurationMs == null
          ? formatDuration(current.blackHoleDurationMs ?? 0)
          : formatDelta(
              current.blackHoleDurationMs ?? 0,
              previous.blackHoleDurationMs ?? null,
              "ms",
            ),
    },
  ];

  if ((current.burnDps ?? 0) > 0) {
    readouts.push({
      label: "Burn Ring",
      value:
        previous?.secondaryRadius == null
          ? `${formatNumber(current.secondaryRadius ?? 0)}px at ${formatNumber(current.burnDps ?? 0, 2)} DPS`
          : `${formatDelta(current.secondaryRadius ?? 0, previous.secondaryRadius ?? null, "px")} ring`,
    });
  }

  if ((current.eventHorizonRadius ?? 0) > 0) {
    readouts.push({
      label: "Event Horizon",
      value:
        previous?.eventHorizonRadius == null
          ? `${formatNumber(current.eventHorizonRadius ?? 0)}px for ${formatDuration(current.eventHorizonDurationMs ?? 0)}`
          : formatDelta(
              current.eventHorizonRadius ?? 0,
              previous.eventHorizonRadius ?? null,
              "px",
            ),
    });
  }

  readouts.push({
    label: "Chaos Scale",
    value: formatDelta(
      current.chaosScale ?? 1,
      previous?.chaosScale ?? null,
      "x",
      2,
    ),
  });

  return readouts;
}