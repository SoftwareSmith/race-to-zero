import type { ReactNode } from "react";
import { cn } from "@shared/utils/cn";
import type { StatusBannerKind } from "../../types/dashboard";

interface StatusBannerProps {
  children: ReactNode;
  kind?: StatusBannerKind;
}

const KIND_STYLES: Record<StatusBannerKind, string> = {
  error: "border-red-500/30 bg-red-950/30 text-red-100",
  info: "border-sky-500/30 bg-sky-950/20 text-sky-100",
};

export default function StatusBanner({
  kind = "info",
  children,
}: StatusBannerProps) {
  return (
    <div
      className={cn(
        "rounded-[22px] border px-4 py-3 text-sm font-medium shadow-[0_12px_30px_rgba(68,50,30,0.06)]",
        KIND_STYLES[kind] ?? KIND_STYLES.info,
      )}
      role={kind === "error" ? "alert" : "status"}
    >
      {children}
    </div>
  );
}
