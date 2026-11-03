import { isMockApi } from "@/shared/api/config";
import { useId, type ReactElement } from "react";

import type {
  Seat as SeatData,
  SeatLayout,
} from "@/features/booking/types/seat";
import { Seat } from "@/shared/ui/Seat/Seat";
import { presentationSeatLayout } from "@/features/booking/lib/presentationSeatLayout";

import "./SeatMap.css";

export interface SeatMapProps {
  layout: SeatLayout;
  selectedSeatIds: readonly string[];
  isPending?: boolean;
  onToggle: (seatId: string) => void;
}
type SelectionProps = Pick<SeatMapProps, "selectedSeatIds" | "onToggle">;
interface DeckProps extends SelectionProps {
  items: readonly SeatData[];
  deck: "lower" | "upper";
  vehicleType: SeatLayout["vehicleType"];
}
const LEGEND = [
  { status: "available", label: "Chưa chọn" },
  { status: "selected", label: "Đang chọn" },
  { status: "held", label: "Đang giữ" },
  { status: "sold", label: "Đã có người chọn" },
];
function SeatCell({
  seat,
  selectedSeatIds,
  onToggle,
}: SelectionProps & { seat: SeatData }): ReactElement {
  const selected = selectedSeatIds.includes(seat.id);
  return (
    <Seat
      code={seat.code}
      status={selected && seat.status === "held" ? "available" : seat.status}
      isSelected={selected}
      onToggle={() => onToggle(seat.id)}
    />
  );
}
function SeatGrid({
  seats,
  rear = false,
  cabin,
  ...selection
}: SelectionProps & {
  seats: readonly SeatData[];
  rear?: boolean;
  cabin: boolean;
}): ReactElement {
  return (
    <div className={rear ? "seat-map__rear" : "seat-map__main"}>
      {seats.map((seat) => (
        <SeatCell key={seat.id} seat={seat} {...selection} />
      ))}
      {rear && cabin && (
        <span className="seat-map__technical">Cầu thang / WC</span>
      )}
    </div>
  );
}
function Deck({
  items,
  deck,
  vehicleType,
  ...selection
}: DeckProps): ReactElement {
  const cabin = vehicleType === "cabin-22";
  const mainRows = cabin ? 5 : 4;
  const seats = items
    .filter((seat) => seat.deck === deck)
    .sort((a, b) => a.row - b.row || a.column - b.column);
  const label = deck === "lower" ? "Tầng dưới · A" : "Tầng trên · B";
  return (
    <section className="seat-map__deck" role="group" aria-label={label}>
      <header className="seat-map__deck-header">
        <h3>{label}</h3>
        <span className="seat-map__front">Đầu xe</span>
      </header>
      <p className="seat-map__hint">
        {cabin ? "2 dãy cabin · 1 lối đi" : "3 dãy giường · 2 lối đi"}
      </p>
      <SeatGrid
        seats={seats.filter((seat) => seat.row < mainRows)}
        cabin={cabin}
        {...selection}
      />
      <p className="seat-map__rear-label">
        {cabin ? "Khoang cuối" : "Hàng cuối · 5 giường"}
      </p>
      <SeatGrid
        seats={seats.filter((seat) => seat.row >= mainRows)}
        rear
        cabin={cabin}
        {...selection}
      />
    </section>
  );
}
function SeatLegend(): ReactElement {
  return (
    <ul className="seat-map__legend" aria-label="Chú thích trạng thái ghế">
      {LEGEND.map((item) => (
        <li key={item.status}>
          <span
            className={`seat-map__swatch seat-map__swatch--${item.status}`}
            aria-hidden="true"
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
function SeatControls({
  layout,
  selectedSeatIds,
  isPending,
  onToggle,
}: SeatMapProps): ReactElement {
  return (
    <div
      className="seat-map__viewport"
      role="region"
      aria-label="Sơ đồ ghế hai tầng"
      tabIndex={0}
    >
      <fieldset
        className="seat-map__controls"
        disabled={isPending}
        aria-busy={isPending || undefined}
      >
        <legend className="seat-map__visually-hidden">Chọn vị trí ghế</legend>
        <div className="seat-map__decks">
          {(["lower", "upper"] satisfies ("lower" | "upper")[]).map((deck) => (
            <Deck
              key={deck}
              deck={deck}
              items={layout.items}
              vehicleType={layout.vehicleType}
              selectedSeatIds={selectedSeatIds}
              onToggle={onToggle}
            />
          ))}
        </div>
      </fieldset>
    </div>
  );
}
function MockSeatMap(props: SeatMapProps): ReactElement {
  const titleId = useId();
  return (
    <section
      className={`seat-map seat-map--${props.layout.vehicleType}`}
      aria-labelledby={titleId}
    >
      <header className="seat-map__header">
        <h2 id={titleId}>
          {!isMockApi
            ? props.layout.trip.vehicleLabel
            : props.layout.vehicleType === "sleeper-34"
              ? "Limousine giường 34 chỗ"
              : "Limousine 22 cabin"}
        </h2>
        <span className="seat-map__vehicle-chip">
          {props.layout.vehicleType === "sleeper-34"
            ? "34 GIƯỜNG · 2 TẦNG"
            : "22 PHÒNG · 2 TẦNG"}
        </span>
        <span className="seat-map__count">
          {props.selectedSeatIds.length}/6 chỗ đã chọn
        </span>
      </header>
      <SeatLegend />
      {!isMockApi && (
        <p className="seat-map__hint">
          Sơ đồ minh họa theo mã ghế; vị trí thực tế tùy xe.
        </p>
      )}
      <SeatControls {...props} />
    </section>
  );
}

export function SeatMap(props: SeatMapProps): ReactElement {
  if (isMockApi) return <MockSeatMap {...props} />;
  const displayLayout = presentationSeatLayout(props.layout);
  if (displayLayout) return <MockSeatMap {...props} layout={displayLayout} />;
  return (
    <section className="seat-map seat-map--basic" aria-label="Danh sách ghế">
      <h2>Chọn ghế của bạn</h2>
      <p>Sắp xếp theo mã ghế; không mô tả vị trí thực tế trên xe.</p>
      <SeatLegend />
      <fieldset
        disabled={props.isPending}
        style={{ display: "flex", flexWrap: "wrap", gap: 12 }}
      >
        <legend>Chọn ghế</legend>
        {props.layout.items.map((seat) => (
          <SeatCell
            key={seat.id}
            seat={seat}
            selectedSeatIds={props.selectedSeatIds}
            onToggle={props.onToggle}
          />
        ))}
      </fieldset>
    </section>
  );
}
