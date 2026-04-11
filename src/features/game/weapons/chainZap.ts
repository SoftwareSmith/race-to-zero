import type { WeaponDef } from "./types";

const chainZap: WeaponDef = {
  id: "chain",
  title: "Chain Zap",
  unlockKills: 38,
  detail:
    "Click near a bug to start a 3-strand plasma arc. Lightning hops up to 3 times — each node emits a spark crown. Prioritises unfrozen bugs (synergy with Freeze Cone). Final bug leaves an electric afterglow.",
  hitPattern: "chain",
  hitRadius: 90,
  damage: 2,
  chainMaxBounces: 3,
  effectColor: "#6ee7b7",
  cooldownMs: 950,
  inputMode: "click",
  hint: "Click near a bug — arc bounces 3×, targets unfrozen bugs first",
};

export default chainZap;
