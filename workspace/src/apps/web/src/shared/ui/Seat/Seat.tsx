import { useId, type ReactElement } from "react";

import "./Seat.css";

export type SeatStatus = "available" | "held" | "sold" | "disabled";

export interface SeatProps {
  code: string;
  status: SeatStatus;
  isSelected?: boolean;
  onToggle: (code: string) => void;
}

const SEAT_STATUS_LABELS: Record<SeatStatus, string> = {
  available: "Còn trống",
  held: "Đang được giữ",
  sold: "Đã bán",
  disabled: "Không khả dụng",
};

export function Seat({
  code,
  isSelected = false,
  onToggle,
  status,
}: SeatProps): ReactElement {
  const statusId = useId();
  const isAvailable = status === "available";
  const isSeatSelected = isAvailable && isSelected;
  const classes = [
    "seat",
    `seat--${status}`,
    isSeatSelected && "seat--selected",
  ]
    .filter(Boolean)
    .join(" ");
  const statusLabel = isSeatSelected ? "Đã chọn" : SEAT_STATUS_LABELS[status];

  return (
    <button
      aria-describedby={statusId}
      aria-label={`Ghế ${code}`}
      aria-pressed={isSeatSelected}
      className={classes}
      disabled={!isAvailable}
      onClick={() => onToggle(code)}
      type="button"
    >
      <span className="seat__pillow" aria-hidden="true" />
      <span className="seat__code">{code}</span>
      <span hidden id={statusId}>
        {statusLabel}
      </span>
    </button>
  );
}
