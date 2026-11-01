import type { ReactElement } from "react";
import { vehicleSeatCodes, type OperatorVehicle } from "./vehicles.schema";
import "./VipSeatedSeatMap.css";

export function VipSeatedSeatMap({
  vehicle,
  pending,
  toggle,
}: {
  vehicle: OperatorVehicle;
  pending: boolean;
  toggle: (code: string, enabled: boolean) => void;
}): ReactElement {
  const rearSeats = vehicle.rearSeats ?? (vehicle.type === 4 ? 3 : 5);
  const codes = vehicleSeatCodes(vehicle.type, rearSeats);
  return (
    <div
      className={`operator-vehicles__map operator-vip29 ${vehicle.type === 4 ? "operator-vip29--limo24" : ""}`}
      aria-label={`Sơ đồ ${vehicle.plate}`}
    >
      <div className="operator-vip29__cabin">
        {vehicle.type === 4 && (
          <strong className="operator-vip29__cabin-title">
            Khoang hành khách
          </strong>
        )}
        <p className="operator-vip29__description">
          1 tầng · {vehicle.type === 4 ? "2+1" : "2+2"} · 1 lối · {codes.length}{" "}
          ghế
        </p>
        <span
          className="operator-vip29__steering"
          role="img"
          aria-label="Vị trí tài xế"
        />
        {codes.map((code, index) => {
          const enabled = !vehicle.disabledSeats.includes(code);
          const left =
            vehicle.type === 4
              ? index < 21
                ? [64, 116, 272][index % 3]
                : (rearSeats === 2
                    ? [64, 272]
                    : rearSeats === 3
                      ? [64, 116, 272]
                      : [64, 116, 220, 272])[index - 21]
              : index < 24
                ? [64, 116, 220, 272][index % 4]
                : (rearSeats === 5
                    ? [64, 116, 168, 220, 272]
                    : [64, 116, 220, 272])[index - 24];
          const top =
            vehicle.type === 4
              ? index < 21
                ? 75 + Math.floor(index / 3) * 42
                : 369
              : index < 24
                ? 71 + Math.floor(index / 4) * 47
                : 353;
          return (
            <button
              key={code}
              type="button"
              className={`operator-vip29__seat ${enabled ? "" : "operator-vip29__seat--off"}`}
              style={{ left, top }}
              aria-label={`Vị trí ${code.slice(1)}`}
              aria-pressed={enabled}
              title={`${code.slice(1)}: ${enabled ? "Được đặt — bấm để tắt" : "Đã tắt — bấm để bật"}`}
              disabled={pending}
              onClick={() => toggle(code, !enabled)}
            >
              <span aria-hidden="true" />
              <small>{code.slice(1)}</small>
            </button>
          );
        })}
      </div>
    </div>
  );
}
