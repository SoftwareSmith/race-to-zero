import type { WeaponDef } from "./types";

const freezeCone: WeaponDef = {
  id: "freeze",
  title: "Freeze Blast",
  typeLabel: "Cryo",
  typeHint: "Controls space by slowing or pinning fast threats in place.",
  weaponType: "cryo",
  unlockKills: 25,
  detail:
    "Radial ice burst centred on click. Slows all bugs in a 180 px radius by 65% for 3.5 s. Snowflakes linger at the blast site. A second hit on a frozen bug extends the duration.",
  hitPattern: "area",
  hitRadius: 180,
  appliesSlow: true,
  effectColor: "#bfdbfe",
  cooldownMs: 820,
  inputMode: "click",
  hint: "Click to freeze — radial blast slows all nearby bugs; snowflakes linger",
  tierTitles: ["Deadlock", "System Fault", "Segment Fault"],
  tierDetails: [
    "Radial ice burst centred on click. Slows all bugs in 180px radius by 65% for 3.5s.",
    "System hangs — ice blast fully ensnares bugs instead of slowing; next click on any ensnared bug = instakill.",
    "Critical failure: a global Segment Fault freezes every bug on screen simultaneously.",
  ],
  tierHints: [
    "Click to freeze — radial blast slows all nearby bugs; snowflakes linger",
    "T2: Full ensnare instead of slow — click ensnared bugs to instakill",
    "T3: Global freeze — slows every active bug on the entire field",
  ],
};

export default freezeCone;
