import type { WeaponDef } from "./types";

const tracerBloom: WeaponDef = {
  id: "laser",
  title: "Tracer Bloom",
  unlockKills: 68,
  detail:
    "Paints a route from the core to your click, detonating 4 pulse blooms along the way. Each bloom clips nearby bugs without using bounce-line logic.",
  hitPattern: "line",
  hitRadius: 38,
  effectColor: "#fb7185",
  cooldownMs: 900,
  inputMode: "click",
  hint: "Click to lay a bloom route — 4 bursts detonate between the core and target",
  tierTitles: ["Debug Trace", "Deep Trace", "Full Profiling"],
  tierDetails: [
    "Paints a route from the core to your click, detonating 4 pulse blooms along the way.",
    "Deep inspection — each bloom deals +2 bonus damage to Charged or Marked bugs caught in the blast.",
    "Full profiling — all bloom charges deal +3 bonus to status-afflicted bugs; overlay maps all active bugs.",
  ],
  tierHints: [
    "Click to lay a bloom route — 4 bursts detonate between core and target",
    "T2: +2 bonus damage to Charged or Marked bugs",
    "T3: +3 bonus to any status-afflicted bug; full coverage",
  ],
};

export default tracerBloom;
