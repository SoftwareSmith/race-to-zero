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
  tierTitles: ["Chain Zap", "Event Loop", "Distributed System"],
  tierDetails: [
    "Click near a bug to start a 3-strand plasma arc. Bounces up to 3 times, prefers unfrozen targets.",
    "The loop never ends — arc bounces up to 6 times and each hit applies a Charged status, amplifying further damage.",
    "Network propagation: all Charged bugs on the field are hit simultaneously with cascading reduced damage.",
  ],
  tierHints: [
    "Click near a bug — arc bounces 3×, targets unfrozen bugs first",
    "T2: 6 bounces + each hit applies Charged status",
    "T3: All Charged bugs on screen get hit in a network pulse",
  ],
};

export default chainZap;
