import type { ReactElement, ReactNode } from "react";
import "./OperatorStatusBadge.css";

const tones: Readonly<Record<string, string>> = {
  active: "success",
  available: "success",
  confirmed: "success",
  paid: "success",
  boarding: "success",
  completed: "success",
  "checked-in": "success",
  pending: "warning",
  unpaid: "warning",
  invited: "warning",
  draft: "warning",
  waiting: "warning",
  processing: "info",
  scheduled: "info",
  running: "info",
  departed: "info",
  departing: "info",
  refunded: "info",
  collected: "info",
  review: "warning",
  "needs-update": "warning",
  "awaiting-departure": "warning",
  arrived: "success",
  issued: "success",
  "in-transit": "info",
  cancelled: "error",
  conflict: "error",
  exception: "error",
  rejected: "error",
};

export function OperatorStatusBadge({
  state,
  children,
}: {
  state: string;
  children: ReactNode;
}): ReactElement {
  const key = state.toLowerCase().replaceAll("_", "-");
  return (
    <span className="operator-status-badge" data-tone={tones[key] ?? "neutral"}>
      {children}
    </span>
  );
}
