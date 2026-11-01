import { VipSeatedSeatMap } from "./VipSeatedSeatMap";
import limousineRoutesIcon from "@/assets/operator/vehicles/limousine/imgFrame2.svg";
import { LimousineSeatMap } from "./LimousineSeatMap";
import * as Dialog from "@radix-ui/react-dialog";
import { useRef, useState, type FormEvent, type ReactElement } from "react";
import { useSearchParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { OperatorSidebar } from "../components/OperatorSidebar";
import { Button } from "@/shared/ui/Button/Button";
import { Input } from "@/shared/ui/Input/Input";
import { PageState } from "@/shared/ui/PageState/PageState";
import {
  setVehicleRoomConfiguration,
  setVehicleCabinConfiguration,
  setVehicleRearConfiguration,
  getOperatorVehicles,
  setVehicleSeatPermission,
  createOperatorVehicle,
} from "./vehiclesRepository";
import {
  vehicleCapacity,
  VEHICLE_TYPES,
  vehicleSeatCodes,
  vehicleInputSchema,
  type OperatorVehicle,
  type VehicleInput,
} from "./vehicles.schema";
import bus from "@/assets/operator/vehicles/imgIconBus.svg";
import search from "@/assets/operator/vehicles/imgIconSearch.svg";
import filter from "@/assets/operator/vehicles/imgIconFilter.svg";
import busPlus from "@/assets/operator/vehicles/imgIconBusPlus.svg";
import dot from "@/assets/operator/vehicles/imgStatusDot.svg";
import direction from "@/assets/operator/vehicles/imgTripRouteDirection.svg";
import "../schedule/SchedulePage.css";
import "./VehicleManagementPage.css";

const QUERY = ["operator-vehicles"];
function VehicleSeatMap({
  vehicle,
  pending,
  toggle,
}: {
  vehicle: OperatorVehicle;
  pending: boolean;
  toggle: (code: string, enabled: boolean) => void;
}): ReactElement {
  if (vehicle.type === 2 || vehicle.type === 4)
    return (
      <VipSeatedSeatMap vehicle={vehicle} pending={pending} toggle={toggle} />
    );
  if (vehicle.type === 1 || vehicle.type === 3)
    return (
      <LimousineSeatMap vehicle={vehicle} pending={pending} toggle={toggle} />
    );
  const config = VEHICLE_TYPES[vehicle.type];
  const codes = vehicleSeatCodes(
    vehicle.type,
    vehicle.rearSeats,
    vehicle.cabinCapacity,
    vehicle.lowerRooms,
  );
  const decks =
    config.decks === 2
      ? [
          codes.filter((c) => c.startsWith("D")),
          codes.filter((c) => c.startsWith("T")),
        ]
      : [codes];
  return (
    <div
      className="operator-vehicles__map"
      aria-label={`Sơ đồ ${vehicle.plate}`}
    >
      {decks.map((deck, deckIndex) => (
        <div
          className={`operator-vehicles__deck ${vehicle.type === 5 ? "operator-vehicles__deck--40 operator-vehicles__deck--36" : vehicle.type === 0 ? "operator-vehicles__deck--40" : vehicle.type === 6 || vehicle.type === 7 ? "operator-vehicles__deck--40 operator-vehicles__deck--34" : vehicle.type === 8 || vehicle.type === 9 || vehicle.type === 14 || vehicle.type === 10 || vehicle.type === 11 || vehicle.type === 12 || vehicle.type === 13 ? "operator-vehicles__deck--40 operator-vehicles__deck--22" : ""}`}
          key={deckIndex}
        >
          <div className="operator-vehicles__deck-heading">
            <strong>
              {config.decks === 1
                ? "Khoang hành khách"
                : deckIndex === 0
                  ? "Tầng dưới"
                  : "Tầng trên"}
            </strong>
            <span>
              {vehicle.type === 0
                ? "3 dãy · 2 lối · 20 giường"
                : vehicle.type === 5 || vehicle.type === 6 || vehicle.type === 7
                  ? `3 dãy · 2 lối · ${deck.length} giường`
                  : vehicle.type === 8 ||
                      vehicle.type === 9 ||
                      vehicle.type === 14 ||
                      vehicle.type === 10 ||
                      vehicle.type === 11 ||
                      vehicle.type === 12 ||
                      vehicle.type === 13
                    ? `2 dãy · 1 lối · ${deck.length} ${vehicle.type === 14 ? "cabin" : vehicle.type === 10 || vehicle.type === 11 || vehicle.type === 12 || vehicle.type === 13 ? "phòng" : "giường"}`
                    : `${deck.length} vị trí`}
            </span>
          </div>
          {deckIndex === 0 && (
            <span
              className="operator-vehicles__steering"
              aria-label="Vị trí tài xế"
              role="img"
            />
          )}
          <div className="operator-vehicles__positions">
            {deck.map((code, index) => {
              const enabled = !vehicle.disabledSeats.includes(code);
              return (
                <button
                  key={code}
                  type="button"
                  className={`operator-vehicles__seat ${enabled ? "" : "operator-vehicles__seat--off"}`}
                  aria-label={`Vị trí ${code}`}
                  aria-pressed={enabled}
                  title={`${code}: ${enabled ? "Được đặt — bấm để tắt" : "Đã tắt — bấm để bật"}`}
                  disabled={pending}
                  onClick={() => toggle(code, !enabled)}
                  style={
                    vehicle.type === 5
                      ? {
                          left:
                            index < 15
                              ? 17 + (index % 3) * 80
                              : (vehicle.rearSeats ?? 3) === 3
                                ? [17, 97, 177][index - 15]
                                : vehicle.rearSeats === 4
                                  ? [17, 57, 137, 177][index - 15]
                                  : 17 + (index - 15) * 40,
                          top:
                            index < 15 ? 83 + Math.floor(index / 3) * 53 : 348,
                        }
                      : vehicle.type === 8 ||
                          vehicle.type === 9 ||
                          vehicle.type === 14 ||
                          vehicle.type === 10 ||
                          vehicle.type === 11 ||
                          vehicle.type === 12 ||
                          vehicle.type === 13
                        ? {
                            left:
                              vehicle.type === 11 &&
                              deck.length % 2 === 1 &&
                              index === deck.length - 1
                                ? 97
                                : 37 + (index % 2) * 120,
                            top: 83 + Math.floor(index / 2) * 53,
                          }
                        : vehicle.type === 6 || vehicle.type === 7
                          ? {
                              left:
                                index < 12
                                  ? 17 + (index % 3) * 80
                                  : (vehicle.rearSeats ??
                                        (vehicle.type === 7 ? 3 : 5)) === 3
                                    ? [17, 97, 177][index - 12]
                                    : vehicle.rearSeats === 4
                                      ? [17, 57, 137, 177][index - 12]
                                      : 17 + (index - 12) * 40,
                              top:
                                index < 12
                                  ? 83 + Math.floor(index / 3) * 62
                                  : 331,
                            }
                          : vehicle.type === 0
                            ? {
                                left:
                                  index < 15
                                    ? 17 + (index % 3) * 80
                                    : 17 + (index - 15) * 40,
                                top:
                                  index < 15
                                    ? 83 + Math.floor(index / 3) * 53
                                    : 348,
                              }
                            : undefined
                  }
                >
                  <span aria-hidden="true" />
                  <small>{code}</small>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function AddVehicleForm({
  pending,
  error,
  save,
}: {
  pending: boolean;
  error: string;
  save: (input: VehicleInput) => void;
}): ReactElement {
  const [plate, setPlate] = useState("");
  const [type, setType] = useState(0);
  const [validation, setValidation] = useState("");
  const submit = (event: FormEvent): void => {
    event.preventDefault();
    const result = vehicleInputSchema.safeParse({ plate, type });
    if (!result.success) {
      setValidation("Nhập biển số theo định dạng 45B-204.12 và chọn loại xe.");
      return;
    }
    setValidation("");
    save(result.data);
  };
  return (
    <form onSubmit={submit} className="operator-vehicles__add-form">
      <Input
        label="Biển số xe"
        value={plate}
        onChange={(e) => setPlate(e.target.value.toUpperCase())}
        placeholder="45B-204.12"
        required
        maxLength={10}
        disabled={pending}
      />
      <label>
        Loại xe
        <select
          value={type}
          onChange={(e) => setType(Number(e.target.value))}
          disabled={pending}
        >
          {VEHICLE_TYPES.map((t, i) => (
            <option key={t.name} value={i}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <p>
        Sức chứa: {VEHICLE_TYPES[type].capacity} chỗ. Xe mới chưa được phân công
        chuyến.
      </p>
      {(validation || error) && <p role="alert">{validation || error}</p>}
      <footer>
        <Dialog.Close asChild>
          <Button type="button" variant="secondary" disabled={pending}>
            Hủy
          </Button>
        </Dialog.Close>
        <Button type="submit" isLoading={pending}>
          Thêm xe
        </Button>
      </footer>
    </form>
  );
}

export function VehicleManagementPage(): ReactElement {
  const [params, setParams] = useSearchParams();
  const [term, setTerm] = useState(params.get("q") ?? "");
  const [type, setType] = useState(params.get("type") ?? "all");
  const [addOpen, setAddOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const lock = useRef(false);
  const client = useQueryClient();
  const query = useQuery({
    queryKey: QUERY,
    queryFn: ({ signal }) => getOperatorVehicles(signal),
  });
  const selectVehicle = (id: string): void => {
    setNotice("");
    setParams(
      (p) => {
        p.set("vehicle", id);
        return p;
      },
      { replace: true },
    );
  };
  const permission = useMutation({
    mutationFn: ({
      id,
      code,
      enabled,
    }: {
      id: string;
      code: string;
      enabled: boolean;
    }) => setVehicleSeatPermission(id, code, enabled),
    onSuccess: (saved, input) => {
      client.setQueryData<OperatorVehicle[]>(QUERY, (current) =>
        current?.map((v) => (v.id === saved.id ? saved : v)),
      );
      setNotice(
        `${saved.plate} · ${input.code}: ${input.enabled ? "Đã bật" : "Đã tắt"} quyền đặt.`,
      );
    },
    onError: (error: Error) => setNotice(error.message),
    onSettled: () => {
      lock.current = false;
    },
  });
  const rear = useMutation({
    mutationFn: ({ id, rearSeats }: { id: string; rearSeats: number }) =>
      setVehicleRearConfiguration(id, rearSeats),
    onSuccess: (saved) => {
      client.setQueryData<OperatorVehicle[]>(QUERY, (current) =>
        current?.map((v) => (v.id === saved.id ? saved : v)),
      );
      setNotice(
        `Đã lưu cấu hình hàng cuối ${saved.rearSeats} ${saved.type === 5 || saved.type === 6 || saved.type === 7 ? "giường / tầng" : "ghế"} · ${vehicleCapacity(saved)} chỗ.`,
      );
    },
    onError: (error: Error) => setNotice(error.message),
    onSettled: () => {
      lock.current = false;
    },
  });
  const cabin = useMutation({
    mutationFn: ({ id, capacity }: { id: string; capacity: number }) =>
      setVehicleCabinConfiguration(id, capacity),
    onSuccess: (saved) => {
      client.setQueryData<OperatorVehicle[]>(QUERY, (current) =>
        current?.map((v) => (v.id === saved.id ? saved : v)),
      );
      setNotice(`Đã lưu cấu hình ${saved.cabinCapacity} phòng.`);
    },
    onError: (error: Error) => setNotice(error.message),
    onSettled: () => {
      lock.current = false;
    },
  });
  const room = useMutation({
    mutationFn: ({ id, lowerRooms }: { id: string; lowerRooms: number }) =>
      setVehicleRoomConfiguration(id, lowerRooms),
    onSuccess: (saved) => {
      client.setQueryData<OperatorVehicle[]>(QUERY, (current) =>
        current?.map((v) => (v.id === saved.id ? saved : v)),
      );
      setNotice(
        `Đã lưu ${saved.lowerRooms} dưới / ${21 - (saved.lowerRooms ?? 10)} trên.`,
      );
    },
    onError: (error: Error) => setNotice(error.message),
    onSettled: () => {
      lock.current = false;
    },
  });
  const create = useMutation({
    mutationFn: createOperatorVehicle,
    onSuccess: (saved) => {
      client.setQueryData<OperatorVehicle[]>(QUERY, (current) => [
        ...(current ?? []),
        saved,
      ]);
      setAddOpen(false);
      setTerm("");
      setType("all");
      setParams({ vehicle: saved.id });
      setNotice(`Đã thêm xe ${saved.plate}.`);
    },
    onSettled: () => {
      lock.current = false;
    },
  });
  const items = query.data ?? [];
  const q = (params.get("q") ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const appliedType = params.get("type") ?? "all";
  const filtered = items.filter(
    (v) =>
      v.plate.replace(/[^A-Z0-9]/g, "").includes(q) &&
      (appliedType === "all" || String(v.type) === appliedType),
  );
  const vehicle =
    filtered.find((v) => v.id === params.get("vehicle")) ?? filtered[0];
  const apply = (event: FormEvent): void => {
    event.preventDefault();
    setParams((p) => {
      if (term.trim()) p.set("q", term.trim());
      else p.delete("q");
      if (type !== "all") p.set("type", type);
      else p.delete("type");
      p.delete("vehicle");
      return p;
    });
    setNotice("");
  };
  return (
    <div
      className={`operator-schedule operator-vehicles ${vehicle?.type === 8 || vehicle?.type === 9 || vehicle?.type === 14 || vehicle?.type === 10 || vehicle?.type === 11 || vehicle?.type === 12 || vehicle?.type === 13 || vehicle?.type === 7 ? "operator-vehicles--sleeper22" : ""} ${vehicle?.type === 1 || vehicle?.type === 2 || vehicle?.type === 3 || vehicle?.type === 4 ? "operator-vehicles--limousine" : ""}`}
    >
      <a className="operator-schedule__skip" href="#operator-vehicles-main">
        Đến nội dung chính
      </a>
      <OperatorSidebar
        routesIconOverride={
          vehicle?.type === 1 || vehicle?.type === 3
            ? limousineRoutesIcon
            : undefined
        }
      />
      <main className="operator-schedule__main" id="operator-vehicles-main">
        <header className="operator-schedule__header">
          <h1>Xe & sơ đồ ghế</h1>
        </header>
        <form className="operator-vehicles__toolbar" onSubmit={apply}>
          <label className="operator-vehicles__field operator-vehicles__search">
            <span>TÌM KIẾM</span>
            <div>
              <img src={search} alt="" width={15} height={15} />
              <input
                aria-label="Tìm biển số xe"
                placeholder="Nhập biển số xe"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
              />
            </div>
          </label>
          <label className="operator-vehicles__field operator-vehicles__type">
            <span>LOẠI XE</span>
            <select
              aria-label="Loại xe"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="all">Tất cả {VEHICLE_TYPES.length} loại xe</option>
              {VEHICLE_TYPES.map((t, i) => (
                <option key={t.name} value={i}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <Button
            type="submit"
            variant="secondary"
            className="operator-vehicles__filter"
          >
            <img src={filter} alt="" width={16} height={16} />
            Lọc xe
          </Button>
          <Button
            type="button"
            className="operator-vehicles__add"
            onClick={() => {
              create.reset();
              setAddOpen(true);
            }}
          >
            <img src={busPlus} alt="" width={20} height={20} />
            Thêm xe
          </Button>
        </form>
        {query.isPending ? (
          <PageState
            title="Đang tải xe"
            description="Vui lòng đợi trong giây lát."
          />
        ) : query.isError ? (
          <PageState
            title="Không tải được xe"
            description={query.error.message}
            action={
              <Button onClick={() => void query.refetch()}>Thử lại</Button>
            }
          />
        ) : (
          <div className="operator-vehicles__panels">
            <section
              className="operator-vehicles__list"
              aria-labelledby="vehicle-list-heading"
            >
              <header>
                <h2 id="vehicle-list-heading">Danh sách xe</h2>
                <p>
                  {filtered.length} xe ·{" "}
                  {new Set(filtered.map((v) => v.type)).size} cấu hình
                </p>
              </header>
              <div className="operator-vehicles__scroll">
                {[...filtered]
                  .sort((a, b) =>
                    vehicle?.type === 1 ||
                    vehicle?.type === 2 ||
                    vehicle?.type === 3 ||
                    vehicle?.type === 6 ||
                    vehicle?.type === 8 ||
                    vehicle?.type === 9 ||
                    vehicle?.type === 14 ||
                    vehicle?.type === 10 ||
                    vehicle?.type === 11 ||
                    vehicle?.type === 12 ||
                    vehicle?.type === 13 ||
                    vehicle?.type === 4 ||
                    vehicle?.type === 7 ||
                    vehicle?.type === 5
                      ? Number(b.id === vehicle.id) -
                        Number(a.id === vehicle.id)
                      : 0,
                  )
                  .map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      className="operator-vehicles__row"
                      aria-pressed={vehicle?.id === v.id}
                      onClick={() => selectVehicle(v.id)}
                    >
                      <span className="operator-vehicles__illustration">
                        <img src={bus} alt="" width={64} height={42} />
                      </span>
                      <span className="operator-vehicles__row-copy">
                        <strong>{v.plate}</strong>
                        <span>{VEHICLE_TYPES[v.type].name}</span>
                      </span>
                      <small>
                        {vehicleCapacity(v)}{" "}
                        {v.type >= 10 && v.type <= 13
                          ? "phòng"
                          : v.type === 14
                            ? "cabin"
                            : "chỗ"}
                      </small>
                    </button>
                  ))}
                {!filtered.length && (
                  <p className="operator-vehicles__empty">
                    Không tìm thấy xe phù hợp.
                  </p>
                )}
              </div>
              <p className="operator-vehicles__list-footer">
                {filtered.length
                  ? `Cuộn để xem toàn bộ ${filtered.length} xe`
                  : "Thử biển số hoặc loại xe khác"}
              </p>
            </section>
            {vehicle ? (
              <section
                className={`operator-vehicles__detail ${vehicle.type === 1 || vehicle.type === 3 ? "operator-vehicles__detail--limousine" : vehicle.type === 2 || vehicle.type === 4 ? "operator-vehicles__detail--vip29" : vehicle.type === 6 || vehicle.type === 7 ? "operator-vehicles__detail--sleeper34" : vehicle.type === 13 || vehicle.type === 11 ? "operator-vehicles__detail--cabin2122" : vehicle.type === 5 ? "operator-vehicles__detail--sleeper36" : ""}`}
                aria-label={`Chi tiết xe ${vehicle.plate}`}
              >
                <header>
                  <h2>{vehicle.plate}</h2>
                  <p>{VEHICLE_TYPES[vehicle.type].name}</p>
                </header>
                <h3>Thông tin xe</h3>
                <div className="operator-vehicles__facts">
                  {[
                    ["BIỂN SỐ", vehicle.plate],
                    ["LOẠI XE", VEHICLE_TYPES[vehicle.type].name],
                    [
                      "SỨC CHỨA",
                      `${vehicleCapacity(vehicle)} ${vehicle.type === 14 ? "cabin" : vehicle.type === 10 || vehicle.type === 11 || vehicle.type === 12 || vehicle.type === 13 ? "phòng" : "chỗ"}`,
                    ],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <span>{label}</span>
                      <strong>{value}</strong>
                    </div>
                  ))}
                </div>
                {vehicle.assignment ? (
                  <div className="operator-vehicles__assignment">
                    <strong>
                      <img src={dot} alt="" width={8} height={8} />
                      Đang chạy
                    </strong>
                    <div>
                      <small>CHUYẾN ĐANG DÙNG XE</small>
                      <div className="operator-vehicles__route">
                        <b>{vehicle.assignment.code}</b>
                        <span>{vehicle.assignment.origin}</span>
                        <img src={direction} alt="đến" width={34} height={12} />
                        <span>{vehicle.assignment.destination}</span>
                      </div>
                    </div>
                    <div>
                      <small>LỊCH CHẠY</small>
                      <p>{vehicle.assignment.time}</p>
                    </div>
                  </div>
                ) : (
                  <div className="operator-vehicles__assignment operator-vehicles__assignment--empty">
                    Chưa có chuyến được phân công
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
                  {vehicle.type === 2 || vehicle.type === 4
                    ? "Bấm vào vị trí để bật hoặc tắt quyền đặt vé"
                    : "Bấm vào vị trí để bật hoặc tắt quyền đặt."}
                </p>
                <VehicleSeatMap
                  vehicle={vehicle}
                  pending={
                    permission.isPending ||
                    rear.isPending ||
                    cabin.isPending ||
                    room.isPending
                  }
                  toggle={(code, enabled) => {
                    if (lock.current) return;
                    lock.current = true;
                    permission.mutate({ id: vehicle.id, code, enabled });
                  }}
                />
                {(vehicle.type === 1 ||
                  vehicle.type === 2 ||
                  vehicle.type === 6 ||
                  vehicle.type === 4 ||
                  vehicle.type === 7 ||
                  vehicle.type === 5) && (
                  <label className="operator-vehicles__rear">
                    <span>CẤU HÌNH HÀNG CUỐI</span>
                    <select
                      aria-label="Cấu hình hàng cuối"
                      value={
                        vehicle.rearSeats ??
                        (vehicle.type === 2 || vehicle.type === 6 ? 5 : 3)
                      }
                      disabled={
                        permission.isPending ||
                        rear.isPending ||
                        cabin.isPending ||
                        room.isPending
                      }
                      onChange={(event) => {
                        if (lock.current) return;
                        lock.current = true;
                        rear.mutate({
                          id: vehicle.id,
                          rearSeats: Number(event.target.value),
                        });
                      }}
                    >
                      {(vehicle.type === 2 || vehicle.type === 6
                        ? [4, 5]
                        : vehicle.type === 7 || vehicle.type === 5
                          ? [3, 4, 5]
                          : [2, 3, 4]
                      ).map((count) => (
                        <option key={count} value={count}>
                          {count}{" "}
                          {vehicle.type === 5 ||
                          vehicle.type === 6 ||
                          vehicle.type === 7
                            ? "giường / tầng"
                            : "ghế"}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {vehicle.type === 13 && (
                  <label className="operator-vehicles__rear">
                    <span>CẤU HÌNH CABIN</span>
                    <select
                      aria-label="Cấu hình cabin"
                      value={vehicle.cabinCapacity ?? 22}
                      disabled={
                        permission.isPending ||
                        rear.isPending ||
                        cabin.isPending ||
                        room.isPending
                      }
                      onChange={(event) => {
                        if (lock.current) return;
                        lock.current = true;
                        cabin.mutate({
                          id: vehicle.id,
                          capacity: Number(event.target.value),
                        });
                      }}
                    >
                      <option value={22}>22 phòng · 10 dưới / 12 trên</option>
                      <option value={21}>21 phòng · 9 dưới / 12 trên</option>
                    </select>
                  </label>
                )}
                {vehicle.type === 11 && (
                  <label className="operator-vehicles__rear">
                    <span>CẤU HÌNH HÀNG CUỐI</span>
                    <select
                      aria-label="Cấu hình hàng cuối"
                      value={vehicle.lowerRooms ?? 10}
                      disabled={
                        permission.isPending ||
                        rear.isPending ||
                        cabin.isPending ||
                        room.isPending
                      }
                      onChange={(event) => {
                        if (lock.current) return;
                        lock.current = true;
                        room.mutate({
                          id: vehicle.id,
                          lowerRooms: Number(event.target.value),
                        });
                      }}
                    >
                      <option value={10}>10 dưới / 11 trên</option>
                      <option value={11}>11 dưới / 10 trên</option>
                    </select>
                  </label>
                )}
                {vehicle.type !== 0 &&
                  vehicle.type !== 1 &&
                  vehicle.type !== 2 &&
                  vehicle.type !== 3 &&
                  vehicle.type !== 6 &&
                  vehicle.type !== 9 &&
                  vehicle.type !== 14 &&
                  vehicle.type !== 8 &&
                  vehicle.type !== 12 &&
                  vehicle.type !== 13 &&
                  vehicle.type !== 10 &&
                  vehicle.type !== 11 &&
                  vehicle.type !== 4 &&
                  vehicle.type !== 7 &&
                  vehicle.type !== 5 && (
                    <p className="operator-vehicles__template-note">
                      Sơ đồ mẫu theo sức chứa; bố trí chi tiết sẽ được cập nhật
                      theo thiết kế từng loại xe.
                    </p>
                  )}
                <p role="status" className="operator-vehicles__notice">
                  {notice}
                </p>
              </section>
            ) : (
              <PageState
                title="Chưa có xe phù hợp"
                description="Thay đổi bộ lọc để xem thông tin và sơ đồ xe."
              />
            )}
          </div>
        )}
      </main>
      <Dialog.Root
        open={addOpen}
        onOpenChange={(open) => {
          if (!create.isPending) setAddOpen(open);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="operator-vehicles__overlay" />
          <Dialog.Content className="operator-vehicles__dialog">
            <Dialog.Title>Thêm xe</Dialog.Title>
            <Dialog.Description>
              Thêm xe vào danh sách Operator với cấu hình sức chứa có sẵn.
            </Dialog.Description>
            <AddVehicleForm
              pending={create.isPending}
              error={create.error?.message ?? ""}
              save={(input) => {
                if (lock.current) return;
                lock.current = true;
                create.mutate(input);
              }}
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
