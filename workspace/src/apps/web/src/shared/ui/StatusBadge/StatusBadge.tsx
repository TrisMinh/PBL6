import type { ReactElement, ReactNode } from "react";

import "./StatusBadge.css";

export type StatusTone = "neutral" | "success" | "warning" | "error";

export interface StatusBadgeProps {
  children: ReactNode;
  tone?: StatusTone;
}

export function StatusBadge({
  children,
  tone = "neutral",
}: StatusBadgeProps): ReactElement {
  return (
    <span className={`status-badge status-badge--${tone}`}>{children}</span>
  );
}
