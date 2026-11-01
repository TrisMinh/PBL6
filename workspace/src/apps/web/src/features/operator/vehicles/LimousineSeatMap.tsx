import type { ReactElement } from "react";
import { vehicleSeatCodes, type OperatorVehicle } from "./vehicles.schema";
import "./LimousineSeatMap.css";

export function LimousineSeatMap({
  vehicle,
  pending,
  toggle,
}: {
  vehicle: OperatorVehicle;
  pending: boolean;
  toggle: (code: string, enabled: boolean) => void;
}): ReactElement {
  const rearSeats = vehicle.rearSeats ?? 3;
  const codes = vehicleSeatCodes(vehicle.type, rearSeats);
  return (
    <div
      className={`operator-vehicles__map operator-limousine ${vehicle.type === 3 ? "operator-limousine--10" : ""}`}
      aria-label={`Sơ đồ ${vehicle.plate}`}
    >
      <div className="operator-limousine__cabin">
        {vehicle.type === 3 && (
          <strong className="operator-limousine__cabin-title">
            Khoang hành khách
          </strong>
        )}
        <p className="operator-limousine__description">
          1 tầng · 2+1 · 1 lối · {codes.length} ghế
        </p>
        <span
          className="operator-limousine__steering"
          role="img"
          aria-label="Vị trí tài xế"
        />
        {codes.map((code, index) => {
          const enabled = !vehicle.disabledSeats.includes(code);
          const x =
            vehicle.type === 3
              ? index < 6
                ? [47, 107, 213][index % 3]
                : index === 6
                  ? 47
                  : [47, 130, 213][index - 7]
              : index < 6
                ? [47, 107, 213][index % 3]
                : index < 8
                  ? [47, 213][index - 6]
                  : rearSeats === 2
                    ? [47, 213][index - 8]
                    : rearSeats === 3
                      ? [47, 130, 213][index - 8]
                      : [17, 88, 159, 230][index - 8];
          const y =
            vehicle.type === 3
              ? index < 6
                ? 83 + Math.floor(index / 3) * 64
                : index === 6
                  ? 211
                  : 279
              : index < 6
                ? 83 + Math.floor(index / 3) * 64
                : index < 8
                  ? 211
                  : 279;
          return (
            <button
              key={code}
              type="button"
              className={`operator-limousine__seat ${enabled ? "" : "operator-limousine__seat--off"}`}
              style={{ left: x, top: y }}
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
