import { useState, type ReactElement } from "react";
import { Link, useSearchParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/shared/ui/Button/Button";
import { ApiFailure } from "@/shared/api/ResourcePage";
import {
  getLiveRows,
  liveApiJson,
  liveQueryKey,
} from "@/shared/api/liveRequest";
import { normalizeSearch, stateLabel } from "@/shared/api/livePresentation";
import { LiveDeactivate } from "../LiveOperatorForms";
import {
  configuredSeats,
  layoutPosition,
  vehicleTypeNames,
} from "./liveVehicleLayouts";
import busIcon from "@/assets/operator/vehicles/imgIconBus.svg";
import searchIcon from "@/assets/operator/vehicles/imgIconSearch.svg";
import filterIcon from "@/assets/operator/vehicles/imgIconFilter.svg";
import busPlus from "@/assets/operator/vehicles/imgIconBusPlus.svg";
import dot from "@/assets/operator/vehicles/imgStatusDot.svg";
import direction from "@/assets/operator/vehicles/imgTripRouteDirection.svg";
import "./VehicleManagementPage.css";
import "./LiveVehicleManagementPage.css";

const seatSchema = z.object({
  code: z.string(),
  deck: z.number(),
  row: z.number(),
  column: z.number(),
  type: z.string(),
  enabled: z.boolean(),
});
const busSchema = z.object({
  id: z.string(),
  plateNumber: z.string(),
  type: z.string(),
  status: z.string(),
  seats: z.array(seatSchema),
});
type Bus = z.infer<typeof busSchema>;
type Seat = z.infer<typeof seatSchema>;
const typeName = (bus: Bus): string =>
  bus.type === "CABIN_21_22"
    ? "Cabin 21–22 phòng"
    : `${vehicleTypeNames[bus.type] ?? stateLabel(bus.type)} ${bus.seats.length} ${bus.type.startsWith("CABIN_") ? "phòng" : "chỗ"}`;
const dateTime = (value: string): string =>
  new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value));

function VehicleDetail({ vehicle }: { vehicle: Bus }): ReactElement {
  const client = useQueryClient();
  const [notice, setNotice] = useState("");
  const trips = useQuery({
    queryKey: liveQueryKey("operator-trips"),
    queryFn: ({ signal }) => getLiveRows("/api/v1/operator/trips", signal),
    refetchInterval: 60_000,
  });
  const now = trips.dataUpdatedAt;
  const hasActiveTrips = trips.data?.some(
    (trip) =>
      trip.busId === vehicle.id &&
      !["DRAFT", "CANCELLED", "COMPLETED"].includes(String(trip.status)),
  );
  const canEditSeats =
    vehicle.status === "ACTIVE" && trips.isSuccess && !hasActiveTrips;
  const assignment = trips.data
    ?.filter(
      (trip) =>
        trip.busId === vehicle.id &&
        ["SCHEDULED", "BOARDING", "DEPARTED", "IN_TRANSIT"].includes(
          String(trip.status),
        ) &&
        new Date(String(trip.arrivalAt)).getTime() > now,
    )
    .sort(
      (a, b) =>
        new Date(String(a.departureAt)).getTime() -
        new Date(String(b.departureAt)).getTime(),
    )[0];
  const running =
    assignment && new Date(String(assignment.departureAt)).getTime() <= now;
  const decks = [...new Set(vehicle.seats.map((seat) => seat.deck))].sort(
    (a, b) => a - b,
  );
  const mutation = useMutation({
    mutationFn: (seats: Seat[]) =>
      liveApiJson(
        `/api/v1/operator/buses/${encodeURIComponent(vehicle.id)}/seats`,
        z.unknown(),
        {
          method: "PUT",
          idempotent: true,
          body: seats,
        },
      ),
    onMutate: () => setNotice(""),
    onSuccess: async () => {
      await client.invalidateQueries({
        queryKey: liveQueryKey("operator-buses"),
      });
      setNotice("Đã cập nhật sơ đồ ghế.");
    },
    retry: false,
  });
  return (
    <section
      className="operator-vehicles__detail"
      aria-label={`Thông tin xe ${vehicle.plateNumber}`}
    >
      <header>
        <h2>{vehicle.plateNumber}</h2>
        <p>{typeName(vehicle)}</p>
      </header>
      <h3>Thông tin xe</h3>
      <div className="operator-vehicles__facts">
        <div>
          <span>BIỂN SỐ</span>
          <strong>{vehicle.plateNumber}</strong>
        </div>
        <div>
          <span>LOẠI XE</span>
          <strong>{typeName(vehicle)}</strong>
        </div>
        <div>
          <span>SỨC CHỨA</span>
          <strong>
            {vehicle.seats.length}{" "}
            {vehicle.type.startsWith("CABIN_") ? "phòng" : "chỗ"}
          </strong>
        </div>
      </div>
      {trips.isError ? (
        <ApiFailure error={trips.error} />
      ) : assignment ? (
        <div className="operator-vehicles__assignment live-vehicles__assignment">
          <strong>
            <img src={dot} width={8} height={8} alt="" />
            {running ? "Đang chạy" : "Đã xếp lịch"}
          </strong>
          <div>
            <small>{running ? "CHUYẾN ĐANG DÙNG XE" : "CHUYẾN SẮP TỚI"}</small>
            <div className="operator-vehicles__route">
              <Link to={`/operator/trips/${String(assignment.id)}`}>
                {String(assignment.origin)}
              </Link>
              <img src={direction} width={34} height={12} alt="đến" />
              <span>{String(assignment.destination)}</span>
            </div>
          </div>
          <div>
            <small>LỊCH CHẠY</small>
            <p>
              {dateTime(String(assignment.departureAt))} –{" "}
              {dateTime(String(assignment.arrivalAt))}
            </p>
          </div>
        </div>
      ) : (
        <div
          className="operator-vehicles__assignment operator-vehicles__assignment--empty"
          role="status"
        >
          {trips.isPending
            ? "Đang tải lịch phân công…"
            : "Chưa có chuyến đang chạy hoặc sắp tới."}
        </div>
      )}
      <div className="operator-vehicles__map-heading">
        <h3>Sơ đồ ghế</h3>
        <div className="operator-vehicles__legend">
          <span>Được đặt</span>
          <span>Đã tắt</span>
        </div>
      </div>
      <p className="operator-vehicles__hint">
        {vehicle.status !== "ACTIVE"
          ? "Xe ngừng hoạt động. Sơ đồ ghế chỉ xem."
          : hasActiveTrips
            ? "Xe đã có chuyến đang hoạt động. Sơ đồ ghế chỉ xem."
            : trips.isSuccess
              ? "Bấm vào vị trí để bật hoặc tắt quyền đặt."
              : "Đang kiểm tra quyền chỉnh sửa sơ đồ ghế…"}
      </p>
      <div
        className="operator-vehicles__map live-vehicles__map"
        aria-label={`Sơ đồ ${vehicle.plateNumber}`}
      >
        {decks.map((deck, deckIndex) => {
          const seats = vehicle.seats.filter((seat) => seat.deck === deck);
          const rows = [...new Set(seats.map((seat) => seat.row))].sort(
            (a, b) => a - b,
          );
          return (
            <div
              className={[
                "operator-vehicles__deck",
                "live-vehicles__deck",
                vehicleTypeNames[vehicle.type] &&
                  `live-vehicles__deck--${vehicle.type.toLowerCase()}`,
              ]
                .filter(Boolean)
                .join(" ")}
              key={deck}
            >
              <div className="operator-vehicles__deck-heading">
                <strong>
                  {decks.length === 1
                    ? "Khoang hành khách"
                    : deckIndex === 0
                      ? "Tầng dưới"
                      : "Tầng trên"}
                </strong>
                <span>
                  {decks.length === 1 && vehicle.type.startsWith("LIMOUSINE_")
                    ? `1 tầng · 2+1 · 1 lối · ${seats.length} ghế`
                    : `${Math.max(...seats.map((s) => s.column))} dãy · ${seats.length} ${vehicle.type.startsWith("CABIN_") ? "phòng" : "vị trí"}`}
                </span>
              </div>
              {deckIndex === 0 && (
                <span
                  className="operator-vehicles__steering"
                  role="img"
                  aria-label="Vị trí tài xế"
                />
              )}
              <div className="live-vehicles__positions">
                {rows.map((row) => {
                  const rowSeats = seats.filter((seat) => seat.row === row);
                  const columns = Math.max(
                    ...rowSeats.map((seat) => seat.column),
                  );
                  return (
                    <div
                      className="live-vehicles__seat-row"
                      key={row}
                      style={{
                        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                      }}
                    >
                      {rowSeats.map((seat) => (
                        <button
                          key={seat.code}
                          type="button"
                          className={`operator-vehicles__seat ${seat.enabled ? "" : "operator-vehicles__seat--off"}`}
                          style={
                            layoutPosition(vehicle.type, seat, seats) ?? {
                              gridColumn: seat.column,
                            }
                          }
                          aria-label={`Vị trí ${seat.code}`}
                          aria-pressed={seat.enabled}
                          title={`${seat.code}: ${seat.enabled ? "Được đặt" : "Đã tắt"}${canEditSeats ? " — bấm để thay đổi" : ""}`}
                          disabled={mutation.isPending || !canEditSeats}
                          onClick={() =>
                            mutation.mutate(
                              vehicle.seats.map((item) =>
                                item.code === seat.code
                                  ? { ...item, enabled: !item.enabled }
                                  : item,
                              ),
                            )
                          }
                        >
                          <span aria-hidden="true" />
                          <small>{seat.code}</small>
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      {vehicle.type === "LIMOUSINE_24" && (
        <label className="operator-vehicles__field live-vehicles__configuration">
          <span>CẤU HÌNH HÀNG CUỐI</span>
          <select
            aria-label="Cấu hình hàng cuối"
            disabled={!canEditSeats || mutation.isPending}
            value={vehicle.seats.filter((seat) => seat.row === 8).length}
            onChange={(event) =>
              mutation.mutate(
                configuredSeats(
                  vehicle.type,
                  vehicle.seats,
                  Number(event.target.value),
                ),
              )
            }
          >
            {[2, 3, 4].map((count) => (
              <option key={count} value={count}>
                {count} ghế
              </option>
            ))}
          </select>
        </label>
      )}
      {vehicle.type === "CABIN_21_22" && (
        <label className="operator-vehicles__field live-vehicles__configuration">
          <span>CẤU HÌNH CABIN</span>
          <select
            aria-label="Cấu hình cabin"
            disabled={!canEditSeats || mutation.isPending}
            value={vehicle.seats.length}
            onChange={(event) =>
              mutation.mutate(
                configuredSeats(
                  vehicle.type,
                  vehicle.seats,
                  Number(event.target.value),
                ),
              )
            }
          >
            {[21, 22].map((count) => (
              <option key={count} value={count}>
                {count} phòng · {count - 12} dưới / 12 trên
              </option>
            ))}
          </select>
        </label>
      )}
      {vehicle.seats.length === 0 && (
        <p className="operator-vehicles__empty">Xe chưa có sơ đồ ghế.</p>
      )}
      <p className="live-vehicles__feedback" role="status">
        {mutation.isPending ? "Đang lưu…" : notice}
      </p>
      {mutation.isError && <ApiFailure error={mutation.error} />}
      <footer className="live-vehicles__footer">
        <span
          className={`live-vehicles__status ${vehicle.status === "ACTIVE" ? "is-active" : ""}`}
        >
          {stateLabel(vehicle.status)}
        </span>
        <Link to={`/operator/vehicles?edit=${vehicle.id}`}>Chỉnh sửa xe</Link>
        {vehicle.status === "ACTIVE" && (
          <LiveDeactivate
            endpoint={`/api/v1/operator/buses/${vehicle.id}/deactivate`}
            label="xe"
          />
        )}
      </footer>
    </section>
  );
}

export function LiveVehicleManagementPage(): ReactElement {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [filter, setFilter] = useState({ search: "", type: "" });
  const vehicles = useQuery({
    queryKey: liveQueryKey("operator-buses"),
    queryFn: async ({ signal }) =>
      (await getLiveRows("/api/v1/operator/buses", signal)).map((bus) =>
        busSchema.parse(bus),
      ),
  });
  const types = [...new Set(vehicles.data?.map((bus) => bus.type))];
  const rows =
    vehicles.data?.filter(
      (bus) =>
        (!filter.type || bus.type === filter.type) &&
        normalizeSearch(bus.plateNumber).includes(
          normalizeSearch(filter.search),
        ),
    ) ?? [];
  const selected =
    rows.find((bus) => bus.id === params.get("vehicle")) ?? rows[0];
  return (
    <div className="operator-vehicles live-vehicles">
      <form
        className="operator-vehicles__toolbar"
        onSubmit={(event) => {
          event.preventDefault();
          setFilter({ search, type });
        }}
      >
        <label className="operator-vehicles__field operator-vehicles__search">
          <span>TÌM KIẾM</span>
          <div>
            <img src={searchIcon} width={15} height={15} alt="" />
            <input
              aria-label="Tìm biển số xe"
              placeholder="Nhập biển số xe"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </label>
        <label className="operator-vehicles__field operator-vehicles__type">
          <span>LOẠI XE</span>
          <select
            aria-label="Loại xe"
            value={type}
            onChange={(event) => setType(event.target.value)}
          >
            <option value="">Tất cả loại xe</option>
            {types.map((type) => (
              <option key={type} value={type}>
                {vehicleTypeNames[type]
                  ? `${vehicleTypeNames[type]} (${type.split("_").slice(-1)[0]})`
                  : stateLabel(type)}
              </option>
            ))}
          </select>
        </label>
        <Button
          type="submit"
          variant="secondary"
          className="operator-vehicles__filter"
        >
          <img src={filterIcon} width={16} height={16} alt="" />
          Lọc xe
        </Button>
        <Link className="live-vehicles__add" to="/operator/vehicles?new">
          <img src={busPlus} width={20} height={20} alt="" />
          Thêm xe
        </Link>
      </form>
      {vehicles.isError ? (
        <ApiFailure error={vehicles.error} />
      ) : vehicles.isPending ? (
        <p role="status" className="operator-vehicles__empty">
          Đang tải danh sách xe…
        </p>
      ) : (
        <div className="operator-vehicles__panels">
          <section
            className="operator-vehicles__list"
            aria-labelledby="vehicle-list-title"
          >
            <header>
              <h2 id="vehicle-list-title">Danh sách xe</h2>
              <p>
                {rows.length} xe · {new Set(rows.map(typeName)).size} cấu hình
              </p>
            </header>
            <div className="operator-vehicles__scroll">
              {rows.map((bus) => (
                <button
                  type="button"
                  key={bus.id}
                  className="operator-vehicles__row"
                  aria-pressed={bus.id === selected?.id}
                  onClick={() =>
                    setParams({ vehicle: bus.id }, { replace: true })
                  }
                >
                  <span className="operator-vehicles__illustration">
                    <img src={busIcon} width={64} height={42} alt="" />
                  </span>
                  <span className="operator-vehicles__row-copy">
                    <strong>{bus.plateNumber}</strong>
                    <span>{typeName(bus)}</span>
                  </span>
                  <small>
                    {bus.seats.length}{" "}
                    {bus.type.startsWith("CABIN_") ? "phòng" : "chỗ"}
                  </small>
                </button>
              ))}
              {rows.length === 0 && (
                <p className="operator-vehicles__empty">
                  Không tìm thấy xe phù hợp.
                </p>
              )}
            </div>
            <p className="operator-vehicles__list-footer">
              {rows.length} xe trong danh sách
            </p>
          </section>
          {selected && <VehicleDetail key={selected.id} vehicle={selected} />}
        </div>
      )}
    </div>
  );
}
