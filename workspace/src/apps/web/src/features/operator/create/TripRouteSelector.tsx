import { useState, type ReactElement, type ReactNode } from "react";
import { Link } from "react-router";
import swapIcon from "@/assets/operator/create/imgIconSwap.svg";
import { ResourcePicker, type ResourceOption } from "./ResourcePicker";
import { TripStops } from "../TripWorkflowUI";
import { displayCode } from "../components/displayCode";
import { durationLabel } from "./tripTiming";
import type { Route } from "../tripWorkflow";
import {
  routeProvince,
  routeEndpoint,
  stopChoiceKey,
  selectionForRoute,
  matchingRoutes,
  type RouteSelection,
} from "./tripRouteChoices";

export function TripRouteSelector({
  routes,
  routeId,
  onChange,
  children,
}: {
  routes: Route[];
  routeId: string;
  onChange: (id: string) => void;
  children: ReactNode;
}): ReactElement {
  const [draft, setDraft] = useState<RouteSelection | null>(null);
  const route = routes.find((item) => item.id === routeId);
  const selection = draft ?? selectionForRoute(route);
  const available = routes.filter(
    (item) =>
      (item.status === "ACTIVE" || item.id === routeId) &&
      routeProvince(item.origin) &&
      routeProvince(item.destination),
  );
  const pair = matchingRoutes(available, selection, false);
  const exact = matchingRoutes(available, selection);
  const options = (names: string[]): ResourceOption[] =>
    [...new Set(names)]
      .sort((a, b) => a.localeCompare(b, "vi"))
      .map((name) => ({
        id: name,
        label: name,
        description: "",
        conflicts: [],
      }));
  const stopOptions = (pickup: boolean): ResourceOption[] => [
    ...new Map(
      pair.flatMap((item) => {
        const stop = routeEndpoint(item, pickup);
        return stop
          ? [
              [
                stopChoiceKey(stop),
                {
                  id: stopChoiceKey(stop),
                  label: stop.name,
                  description: stop.address ?? "",
                  conflicts: [],
                } as ResourceOption,
              ] as const,
            ]
          : [];
      }),
    ).values(),
  ];
  const change = (next: RouteSelection): void => {
    setDraft(next);
    onChange(matchingRoutes(available, next)[0]?.id ?? "");
  };
  return (
    <>
      <div className="operator-create__route-fields">
        <ResourcePicker
          label="Điểm đi"
          placeholder="Chọn tỉnh, thành phố"
          value={selection.origin}
          options={options(available.map((item) => routeProvince(item.origin)))}
          disabled={false}
          onChange={(origin) =>
            change({ origin, destination: "", pickup: "", dropoff: "" })
          }
        />
        <button
          className="operator-create__swap"
          type="button"
          aria-label="Đổi điểm đi và điểm đến"
          disabled={
            !selection.destination ||
            !available.some(
              (item) =>
                routeProvince(item.origin) === selection.destination &&
                routeProvince(item.destination) === selection.origin,
            )
          }
          onClick={() =>
            change({
              origin: selection.destination,
              destination: selection.origin,
              pickup: "",
              dropoff: "",
            })
          }
        >
          <img src={swapIcon} alt="" width={16} height={16} />
        </button>
        <ResourcePicker
          label="Điểm đến"
          placeholder="Chọn tỉnh, thành phố"
          value={selection.destination}
          options={options(
            available
              .filter((item) => routeProvince(item.origin) === selection.origin)
              .map((item) => routeProvince(item.destination)),
          )}
          disabled={!selection.origin}
          onChange={(destination) =>
            change({ ...selection, destination, pickup: "", dropoff: "" })
          }
        />
      </div>
      {children}
      <div className="operator-route-selector__stops">
        <ResourcePicker
          label="Điểm đón"
          placeholder="Chọn điểm đón"
          value={selection.pickup}
          options={stopOptions(true)}
          disabled={!selection.destination}
          onChange={(pickup) => {
            const next = { ...selection, pickup };
            if (
              !pair.some(
                (item) =>
                  stopChoiceKey(routeEndpoint(item, true)) === pickup &&
                  stopChoiceKey(routeEndpoint(item, false)) ===
                    selection.dropoff,
              )
            )
              next.dropoff = "";
            change(next);
          }}
        />
        <ResourcePicker
          label="Điểm trả"
          placeholder="Chọn điểm trả"
          value={selection.dropoff}
          options={stopOptions(false).filter(
            (option) =>
              !selection.pickup ||
              pair.some(
                (item) =>
                  stopChoiceKey(routeEndpoint(item, true)) ===
                    selection.pickup &&
                  stopChoiceKey(routeEndpoint(item, false)) === option.id,
              ),
          )}
          disabled={!selection.pickup}
          onChange={(dropoff) => change({ ...selection, dropoff })}
        />
      </div>
      {exact.length > 1 && (
        <details className="operator-route-selector__variant">
          <summary>{exact.length} tuyến phù hợp · Đổi tuyến khai thác</summary>
          <ResourcePicker
            label="Tuyến khai thác"
            placeholder="Chọn tuyến"
            value={routeId}
            options={exact.map((item) => ({
              id: item.id,
              label: displayCode(item.id, "TU"),
              description: `${item.name}${item.durationMinutes ? ` · ${durationLabel(item.durationMinutes)}` : ""}`,
              conflicts: [],
            }))}
            disabled={false}
            onChange={onChange}
          />
        </details>
      )}
      {!available.length && (
        <p role="status">
          Chưa có tuyến được khai báo tỉnh, thành phố.{" "}
          <Link to="/operator/routes">Cập nhật tuyến và điểm dừng</Link>.
        </p>
      )}
      {route && route.stops.length > 2 && (
        <details className="operator-route-selector__details">
          <summary>Các điểm dừng phục vụ trên tuyến</summary>
          <TripStops route={route} />
        </details>
      )}
    </>
  );
}
