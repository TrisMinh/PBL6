import { stateLabel } from "@/shared/api/livePresentation";
/** Resource forms shared by the operator workspace. Trip creation uses its dedicated workflow. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactElement, type ReactNode } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { z } from "zod";
import {
  liveApiJson as apiJson,
  getLiveRows,
  liveQueryKey,
} from "@/shared/api/liveRequest";
import { ApiFailure, type ApiRow } from "@/shared/api/ResourcePage";
import { Button } from "@/shared/ui/Button/Button";

const row = z.record(z.string(), z.unknown());
const get = getLiveRows;
const text = (value: unknown) => (typeof value === "string" ? value : "");
const number = (value: unknown) => (typeof value === "number" ? value : 0);
const id = (item: ApiRow) => text(item.id);
const refresh = (client: ReturnType<typeof useQueryClient>) =>
  client.invalidateQueries({ queryKey: ["live-api"] });

function Screen({
  title,
  back,
  children,
}: {
  title: string;
  back: string;
  children: ReactNode;
}): ReactElement {
  return (
    <section className="live-api">
      <nav aria-label="Điều hướng">
        <Link to={back}>← Quay lại danh sách</Link>
      </nav>
      <h1>{title}</h1>
      {children}
    </section>
  );
}
function Field({
  label,
  value,
  onChange,
  type = "text",
  required = true,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  children?: ReactNode;
}): ReactElement {
  return (
    <label>
      {label}
      {children ? (
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required={required}
        >
          {children}
        </select>
      ) : (
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required={required}
        />
      )}
    </label>
  );
}
function ErrorMessage({ error }: { error: Error | null }): ReactElement | null {
  return error ? <ApiFailure error={error} /> : null;
}

export function LiveRouteEditor({
  edit = false,
}: {
  edit?: boolean;
}): ReactElement {
  const { routeId = "" } = useParams();
  const navigate = useNavigate();
  const client = useQueryClient();
  const all = useQuery({
    queryKey: liveQueryKey("operator-routes"),
    queryFn: ({ signal }) => get("/api/v1/operator/routes", signal),
    enabled: edit,
  });
  const existing = all.data?.find((r) => id(r) === routeId);
  const [form, setForm] = useState({
    name: "",
    origin: "",
    destination: "",
    distanceKm: "",
    durationMinutes: "60",
  });
  const [loadedId, setLoadedId] = useState("");
  const [editVersion, setEditVersion] = useState(0);
  useEffect(() => {
    if (!existing || loadedId === id(existing)) return;
    setForm({
      name: text(existing.name),
      origin: text(existing.origin),
      destination: text(existing.destination),
      distanceKm:
        existing.distanceKm == null ? "" : String(existing.distanceKm),
      durationMinutes: String(existing.durationMinutes ?? 60),
    });
    setEditVersion(number(existing.expectedVersion));
    setLoadedId(id(existing));
  }, [existing, loadedId]);
  const mutation = useMutation({
    mutationFn: async () => {
      const body = {
        name: form.name.trim(),
        origin: form.origin.trim(),
        destination: form.destination.trim(),
        distanceKm: form.distanceKm ? Number(form.distanceKm) : null,
        durationMinutes: Number(form.durationMinutes),
        expectedVersion: edit ? editVersion : 0,
      };
      if (body.origin === body.destination)
        throw Error("Điểm đi và điểm đến phải khác nhau.");
      const saved = await apiJson(
        edit
          ? `/api/v1/operator/routes/${encodeURIComponent(routeId)}`
          : "/api/v1/operator/routes",
        row,
        {
          method: edit ? "PATCH" : "POST",
          body,
          ...(edit ? {} : { idempotent: true }),
        },
      );
      return saved;
    },
    onSuccess: () => {
      void refresh(client);
      void navigate("/operator/routes");
    },
    retry: false,
  });
  if (edit && all.isPending)
    return (
      <Screen title="Chỉnh sửa tuyến" back="/operator/routes">
        <p>Đang tải…</p>
      </Screen>
    );
  if (edit && (all.isError || !existing))
    return (
      <Screen title="Chỉnh sửa tuyến" back="/operator/routes">
        {all.isError ? (
          <ApiFailure error={all.error} />
        ) : (
          <p>Không tìm thấy tuyến.</p>
        )}
      </Screen>
    );
  return (
    <Screen
      title={edit ? "Chỉnh sửa tuyến" : "Tạo tuyến mới"}
      back="/operator/routes"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate();
        }}
      >
        <Field
          label="Tên tuyến"
          value={form.name}
          onChange={(v) => setForm({ ...form, name: v })}
        />
        <Field
          label="Điểm đi"
          value={form.origin}
          onChange={(v) => setForm({ ...form, origin: v })}
        />
        <Field
          label="Điểm đến"
          value={form.destination}
          onChange={(v) => setForm({ ...form, destination: v })}
        />
        <Field
          label="Khoảng cách (km)"
          type="number"
          required={false}
          value={form.distanceKm}
          onChange={(v) => setForm({ ...form, distanceKm: v })}
        />
        <Field
          label="Thời gian (phút)"
          type="number"
          value={form.durationMinutes}
          onChange={(v) => setForm({ ...form, durationMinutes: v })}
        />
        <Button type="submit" isLoading={mutation.isPending}>
          {edit ? "Lưu thay đổi" : "Tạo tuyến"}
        </Button>
        <ErrorMessage error={mutation.error} />
      </form>
    </Screen>
  );
}

export function LiveDriverEditor({
  edit = false,
}: {
  edit?: boolean;
}): ReactElement {
  const { driverId = "" } = useParams();
  const navigate = useNavigate();
  const client = useQueryClient();
  const all = useQuery({
    queryKey: liveQueryKey("operator-drivers"),
    queryFn: ({ signal }) => get("/api/v1/operator/drivers", signal),
    enabled: edit,
  });
  const existing = all.data?.find((r) => id(r) === driverId);
  const [form, setForm] = useState({
    userId: "",
    licenseNumber: "",
    licenseExpiresOn: "",
  });
  const [loadedId, setLoadedId] = useState("");
  const [editVersion, setEditVersion] = useState(0);
  useEffect(() => {
    if (existing && loadedId !== id(existing)) {
      setForm({
        userId: text(existing.userId),
        licenseNumber: text(existing.licenseNumber),
        licenseExpiresOn: text(existing.licenseExpiresOn).slice(0, 10),
      });
      setEditVersion(number(existing.expectedVersion));
      setLoadedId(id(existing));
    }
  }, [existing, loadedId]);
  const mutation = useMutation({
    mutationFn: () =>
      apiJson(
        edit
          ? `/api/v1/operator/drivers/${encodeURIComponent(driverId)}`
          : "/api/v1/operator/drivers",
        row,
        {
          method: edit ? "PATCH" : "POST",
          body: { ...form, expectedVersion: edit ? editVersion : 0 },
          ...(edit ? {} : { idempotent: true }),
        },
      ),
    onSuccess: () => {
      void refresh(client);
      void navigate("/operator/drivers");
    },
    retry: false,
  });
  if (edit && all.isPending)
    return (
      <Screen title="Chỉnh sửa tài xế" back="/operator/drivers">
        <p>Đang tải…</p>
      </Screen>
    );
  if (edit && (all.isError || !existing))
    return (
      <Screen title="Chỉnh sửa tài xế" back="/operator/drivers">
        {all.isError ? (
          <ApiFailure error={all.error} />
        ) : (
          <p>Không tìm thấy tài xế.</p>
        )}
      </Screen>
    );
  return (
    <Screen
      title={edit ? "Chỉnh sửa tài xế" : "Thêm tài xế"}
      back="/operator/drivers"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate();
        }}
      >
        <Field
          label="Mã người dùng (UUID)"
          value={form.userId}
          onChange={(v) => setForm({ ...form, userId: v })}
        />
        <Field
          label="Số giấy phép lái xe"
          value={form.licenseNumber}
          onChange={(v) => setForm({ ...form, licenseNumber: v })}
        />
        <Field
          label="Ngày hết hạn giấy phép"
          type="date"
          value={form.licenseExpiresOn}
          onChange={(v) => setForm({ ...form, licenseExpiresOn: v })}
        />
        <Button type="submit" isLoading={mutation.isPending}>
          {edit ? "Cập nhật tài xế" : "Thêm tài xế"}
        </Button>
        <ErrorMessage error={mutation.error} />
      </form>
    </Screen>
  );
}

export function LiveVehicleEditor(): ReactElement {
  const [search] = useSearchParams();
  const vehicleId = search.get("edit") ?? "";
  const client = useQueryClient();
  const navigate = useNavigate();
  const all = useQuery({
    queryKey: liveQueryKey("operator-buses"),
    queryFn: ({ signal }) => get("/api/v1/operator/buses", signal),
    enabled: !!vehicleId,
  });
  const existing = all.data?.find((r) => id(r) === vehicleId);
  const [form, setForm] = useState({
    plateNumber: "",
    type: "SEAT",
    amenities: "",
  });
  const [loadedId, setLoadedId] = useState("");
  const [editVersion, setEditVersion] = useState(0);
  useEffect(() => {
    if (existing && loadedId !== id(existing)) {
      setForm({
        plateNumber: text(existing.plateNumber),
        type: text(existing.type),
        amenities: Array.isArray(existing.amenities)
          ? existing.amenities.join(", ")
          : "",
      });
      setEditVersion(number(existing.expectedVersion));
      setLoadedId(id(existing));
    }
  }, [existing, loadedId]);
  const mutation = useMutation({
    mutationFn: () =>
      apiJson(
        vehicleId
          ? `/api/v1/operator/buses/${encodeURIComponent(vehicleId)}`
          : "/api/v1/operator/buses",
        row,
        {
          method: vehicleId ? "PATCH" : "POST",
          body: {
            plateNumber: form.plateNumber,
            type: form.type,
            amenities: form.amenities
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
            expectedVersion: vehicleId ? editVersion : 0,
          },
          ...(vehicleId ? {} : { idempotent: true }),
        },
      ),
    onSuccess: () => {
      void refresh(client);
      void navigate("/operator/vehicles");
    },
    retry: false,
  });
  if (vehicleId && all.isPending)
    return (
      <Screen title="Cập nhật xe" back="/operator/vehicles">
        <p>Đang tải…</p>
      </Screen>
    );
  if (vehicleId && (all.isError || !existing))
    return (
      <Screen title="Cập nhật xe" back="/operator/vehicles">
        {all.isError ? (
          <ApiFailure error={all.error} />
        ) : (
          <p>Không tìm thấy xe.</p>
        )}
      </Screen>
    );
  return (
    <Screen
      title={vehicleId ? "Chỉnh sửa xe" : "Thêm xe"}
      back="/operator/vehicles"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate();
        }}
      >
        <Field
          label="Biển số"
          value={form.plateNumber}
          onChange={(v) => setForm({ ...form, plateNumber: v })}
        />
        <Field
          label="Loại xe"
          value={form.type}
          onChange={(v) => setForm({ ...form, type: v })}
        />
        <Field
          label="Tiện ích (cách nhau bằng dấu phẩy)"
          required={false}
          value={form.amenities}
          onChange={(v) => setForm({ ...form, amenities: v })}
        />
        <Button type="submit" isLoading={mutation.isPending}>
          {vehicleId ? "Lưu thông tin xe" : "Thêm xe"}
        </Button>
        <ErrorMessage error={mutation.error} />
      </form>
    </Screen>
  );
}

export function LiveVehicleSeats({ bus }: { bus: ApiRow }): ReactElement {
  const client = useQueryClient();
  const [additional, setAdditional] = useState(1);
  const seats = Array.isArray(bus.seats)
    ? bus.seats.map((seat) => row.parse(seat))
    : [];
  const mutation = useMutation({
    mutationFn: (next: ApiRow[]) =>
      apiJson(
        `/api/v1/operator/buses/${encodeURIComponent(id(bus))}/seats`,
        row,
        {
          method: "PUT",
          idempotent: true,
          body: next.map((s) => ({
            code: text(s.code),
            deck: number(s.deck),
            row: number(s.row),
            column: number(s.column),
            type: text(s.type),
            enabled: s.enabled === true,
          })),
        },
      ),
    onSuccess: () => {
      void refresh(client);
    },
    retry: false,
  });
  return (
    <div>
      <p>Sơ đồ ghế: {seats.length} ghế</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {seats.map((seat, index) => (
          <Button
            key={text(seat.code)}
            variant="secondary"
            isLoading={mutation.isPending}
            onClick={() =>
              mutation.mutate(
                seats.map((s, i) =>
                  i === index ? { ...s, enabled: !s.enabled } : s,
                ),
              )
            }
          >
            {text(seat.code)}: {seat.enabled ? "Cho đặt" : "Đang khóa"}
          </Button>
        ))}
      </div>
      <label>
        Thêm số ghế (không thay đổi ghế đã có)
        <input
          type="number"
          min={1}
          max={50}
          value={additional}
          onChange={(e) => setAdditional(Number(e.target.value))}
        />
      </label>
      <Button
        disabled={
          additional < 1 || additional > 50 || seats.length + additional > 100
        }
        isLoading={mutation.isPending}
        onClick={() => {
          const used = new Set(seats.map((seat) => text(seat.code)));
          const next = [...seats];
          let sequence = 1;
          while (next.length < seats.length + additional) {
            const code = `S${sequence++}`;
            if (used.has(code)) continue;
            used.add(code);
            const index = next.length;
            next.push({
              code,
              deck: 1,
              row: Math.floor(index / 4) + 1,
              column: (index % 4) + 1,
              type: "STANDARD",
              enabled: true,
            });
          }
          mutation.mutate(next);
        }}
      >
        Thêm ghế vào sơ đồ
      </Button>
      <ErrorMessage error={mutation.error} />
    </div>
  );
}

export function LiveDeactivate({
  endpoint,
  label,
}: {
  endpoint: string;
  label: string;
}): ReactElement {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: () =>
      apiJson(endpoint, z.unknown(), { method: "POST", idempotent: true }),
    onSuccess: () => {
      void refresh(client);
    },
    retry: false,
  });
  return (
    <>
      <Button
        variant="secondary"
        isLoading={mutation.isPending}
        onClick={() => {
          if (window.confirm(`Xác nhận vô hiệu hóa ${label}?`))
            mutation.mutate();
        }}
      >
        Vô hiệu hóa
      </Button>
      <ErrorMessage error={mutation.error} />
    </>
  );
}

export function LiveCancelTrip({ trip }: { trip: ApiRow }): ReactElement {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: (reason: string) =>
      apiJson(
        `/api/v1/operator/trips/${encodeURIComponent(id(trip))}/cancel`,
        z.unknown(),
        {
          method: "POST",
          idempotent: true,
          body: { reason, expectedVersion: number(trip.rowVersion) },
        },
      ),
    onSuccess: () => {
      void refresh(client);
    },
    retry: false,
  });
  if (trip.status === "CANCELLED" || trip.status === "COMPLETED") return <></>;
  return (
    <>
      <Button
        variant="secondary"
        isLoading={mutation.isPending}
        onClick={() => {
          const reason = window.prompt(
            "Nhập lý do hủy chuyến (không thể hoàn tác):",
          );
          if (reason?.trim()) mutation.mutate(reason.trim());
        }}
      >
        Hủy chuyến
      </Button>
      <ErrorMessage error={mutation.error} />
    </>
  );
}

export function LiveTripTransition({ trip }: { trip: ApiRow }): ReactElement {
  const next: Record<string, string> = {
    SCHEDULED: "BOARDING",
    BOARDING: "DEPARTED",
    DEPARTED: "IN_TRANSIT",
    IN_TRANSIT: "ARRIVED",
    ARRIVED: "COMPLETED",
  };
  const target = next[text(trip.status)];
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: () =>
      apiJson(
        `/api/v1/operator/trips/${encodeURIComponent(id(trip))}/status-transitions`,
        row,
        {
          method: "POST",
          body: {
            expectedVersion: number(trip.rowVersion),
            targetStatus: target,
            reason: null,
          },
          idempotent: true,
        },
      ),
    onSuccess: () => {
      void refresh(client);
    },
    retry: false,
  });
  if (!target) return <></>;
  return (
    <>
      <Button
        variant="secondary"
        isLoading={mutation.isPending}
        onClick={() => {
          if (
            window.confirm(
              `Chuyển chuyến sang trạng thái ${stateLabel(target)}?`,
            )
          )
            mutation.mutate();
        }}
      >
        {stateLabel(target)}
      </Button>
      <ErrorMessage error={mutation.error} />
    </>
  );
}

export function LiveRouteStopsEditor(): ReactElement {
  const [search] = useSearchParams();
  const routeId = search.get("stops") ?? "";
  const client = useQueryClient();
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: liveQueryKey("route-stops", routeId),
    queryFn: ({ signal }) => get("/api/v1/operator/routes", signal),
    enabled: !!routeId,
  });
  const existing = query.data?.find((r) => id(r) === routeId);
  type StopForm = {
    name: string;
    address: string;
    offsetMinutes: string;
    pickupAllowed: boolean;
    dropoffAllowed: boolean;
  };
  const [stops, setStops] = useState<StopForm[]>([]);
  const [loadedId, setLoadedId] = useState("");
  useEffect(() => {
    if (!existing || loadedId === id(existing)) return;
    setStops(
      Array.isArray(existing.stops)
        ? existing.stops.map((raw) => {
            const stop = row.parse(raw);
            return {
              name: text(stop.name),
              address: text(stop.address),
              offsetMinutes: String(stop.offsetMinutes ?? 0),
              pickupAllowed: stop.pickupAllowed === true,
              dropoffAllowed: stop.dropoffAllowed === true,
            };
          })
        : [],
    );
    setLoadedId(id(existing));
  }, [existing, loadedId]);
  const mutation = useMutation({
    mutationFn: () =>
      apiJson(
        `/api/v1/operator/routes/${encodeURIComponent(routeId)}/stops`,
        row,
        {
          method: "PUT",
          body: stops.map((stop, sequence) => ({
            ...stop,
            sequence,
            offsetMinutes: Number(stop.offsetMinutes),
          })),
        },
      ),
    onSuccess: () => {
      void refresh(client);
      void navigate("/operator/routes");
    },
    retry: false,
  });
  const update = (i: number, value: StopForm) =>
    setStops((current) =>
      current.map((stop, index) => (index === i ? value : stop)),
    );
  return (
    <Screen title="Điểm dừng của tuyến" back="/operator/routes">
      {query.isPending ? (
        <p>Đang tải…</p>
      ) : query.isError ? (
        <ApiFailure error={query.error} />
      ) : !existing ? (
        <p>Không tìm thấy tuyến.</p>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate();
          }}
        >
          {stops.map((stop, index) => (
            <fieldset key={index}>
              <legend>Điểm {index + 1}</legend>
              <Field
                label="Tên điểm"
                value={stop.name}
                onChange={(v) => update(index, { ...stop, name: v })}
              />
              <Field
                label="Địa chỉ"
                value={stop.address}
                required={false}
                onChange={(v) => update(index, { ...stop, address: v })}
              />
              <Field
                label="Phút từ điểm xuất phát"
                type="number"
                value={stop.offsetMinutes}
                onChange={(v) => update(index, { ...stop, offsetMinutes: v })}
              />
              <label>
                <input
                  type="checkbox"
                  checked={stop.pickupAllowed}
                  onChange={(e) =>
                    update(index, { ...stop, pickupAllowed: e.target.checked })
                  }
                />{" "}
                Cho đón khách
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={stop.dropoffAllowed}
                  onChange={(e) =>
                    update(index, { ...stop, dropoffAllowed: e.target.checked })
                  }
                />{" "}
                Cho trả khách
              </label>
              {index > 0 && index < stops.length - 1 && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setStops(stops.filter((_, i) => i !== index))}
                >
                  Xóa điểm trung gian
                </Button>
              )}
            </fieldset>
          ))}
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              setStops((current) => [
                ...current.slice(0, -1),
                {
                  name: "",
                  address: "",
                  offsetMinutes: "0",
                  pickupAllowed: true,
                  dropoffAllowed: true,
                },
                ...current.slice(-1),
              ])
            }
          >
            Thêm điểm trung gian
          </Button>
          <Button
            type="submit"
            disabled={stops.length < 2}
            isLoading={mutation.isPending}
          >
            Lưu điểm dừng
          </Button>
          <ErrorMessage error={mutation.error} />
        </form>
      )}
    </Screen>
  );
}
