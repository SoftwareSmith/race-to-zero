import type { BugVariant } from "../../../../types/dashboard";

export function getSplatClassName(variant: BugVariant): string {
  if (variant === "urgent") {
    return "fixed z-[80] h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-[52%_48%_55%_45%/43%_57%_46%_54%] bg-[radial-gradient(circle_at_38%_34%,rgba(255,214,214,0.18),transparent_22%),radial-gradient(circle_at_64%_62%,rgba(220,38,38,0.74),rgba(127,29,29,0.88)_64%,rgba(69,10,10,0.18)_86%,transparent_94%)] [animation:urgent-splatter_760ms_ease-out_forwards] pointer-events-none";
  }

  if (variant === "high") {
    return "fixed z-[80] h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-[38%] bg-[radial-gradient(circle_at_38%_36%,rgba(255,180,160,0.22),transparent_18%),radial-gradient(circle_at_center,rgba(244,63,94,0.9),rgba(153,27,27,0.2)_68%,transparent_74%)] [animation:bug-splat_520ms_ease-out_forwards] pointer-events-none";
  }

  if (variant === "medium") {
    return "fixed z-[80] h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-[45%] bg-[radial-gradient(circle_at_42%_38%,rgba(255,230,200,0.22),transparent_18%),radial-gradient(circle_at_center,rgba(250,130,100,0.86),rgba(160,40,30,0.16)_70%,transparent_76%)] [animation:bug-splat_440ms_ease-out_forwards] pointer-events-none";
  }

  return "fixed z-[80] h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle_at_40%_40%,rgba(255,255,255,0.2),transparent_20%),radial-gradient(circle_at_center,rgba(248,113,113,0.82),rgba(185,28,28,0.14)_70%,transparent_75%)] [animation:bug-splat_380ms_ease-out_forwards] pointer-events-none";
}
