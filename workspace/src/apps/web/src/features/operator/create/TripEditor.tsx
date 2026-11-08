import {
  useCallback,
  useRef,
  useState,
  type FormEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router";
import { liveApiJson, liveQueryKey } from "@/shared/api/liveRequest";
import { Button } from "@/shared/ui/Button/Button";
import { Toast } from "@/shared/ui/Toast/Toast";
import {
  busLabel,
  canPublishTrip,
  driverLabel,
  emptyTripForm,
  rememberedDriver,
  rememberedTripId,
  rememberTrip,
  resourceIssues,
  tripInput,
  tripSchema,
  useOperatorTrip,
  useTripResources,
  vietnamLocal,
  type TripForm,
} from "../tripWorkflow";
import {
  CancellationPolicy,
  TripFact,
  TripStops,
  TripWorkflowShell,
  WorkflowError,
} from "../TripWorkflowUI";
import checkIcon from "@/assets/operator/create/imgFrame8.svg";
import reviewIcon from "@/assets/operator/create/imgFrame9.svg";
import { ResourcePicker, type ResourceOption } from "./ResourcePicker";
import { TripDateTimeField } from "./TripDateTimeField";
import {
  conflictLabel,
  conflictReason,
  localTripWindow,
  scheduleConflicts,
  useOperatorSchedule,
} from "../tripAvailability";

function Field({
  label,
  value,
  onChange,
  type = "text",
  children,
  disabled = false,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  children?: ReactNode;
  disabled?: boolean;
  error?: string;
}): ReactElement {
  if (type === "datetime-local")
    return (
      <TripDateTimeField
        label={label}
        value={value}
        onChange={onChange}
        disabled={disabled}
        error={error}
      />
    );
  return (
    <label className="operator-create__field">
      <span>{label}</span>
      {children ? (
        <select
          aria-label={label}
          required
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          {children}
        </select>
      ) : (
        <input
          aria-label={label}
          required
          type={type}
          min={type === "number" ? 1 : undefined}
          step={type === "number" ? 1 : undefined}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  );
}
function hasInvalidTimeOrder(form: TripForm): boolean {
  const departure = Date.parse(`${form.departureAt}:00+07:00`);
  const arrival = Date.parse(`${form.arrivalAt}:00+07:00`);
  return (
    Number.isFinite(departure) &&
    Number.isFinite(arrival) &&
    arrival <= departure
  );
}

export function CreateTripPage({
  mode = "create",
}: { mode?: "create" | "edit" } = {}): ReactElement {
  const [params] = useSearchParams();
  const tripId =
    mode === "edit" ? (params.get("tripId") ?? rememberedTripId()) : "";
  const existing = useOperatorTrip(tripId),
    resources = useTripResources();
  const navigate = useNavigate(),
    client = useQueryClient();
  const [form, setForm] = useState<TripForm>(emptyTripForm);
  const [loadedId, setLoadedId] = useState("");
  const [version, setVersion] = useState(0);
  const [changed, setChanged] = useState(false);
  const [timeNotice, setTimeNotice] = useState(false);
  const [timeNoticeKey, setTimeNoticeKey] = useState(0);
  const closeTimeNotice = useCallback(() => setTimeNotice(false), []);
  const submitting = useRef(false);
  if (existing.data && loadedId !== existing.data.id) {
    const t = existing.data;
    setForm({
      routeId: t.routeId ?? "",
      busId: t.busId ?? "",
      driverId: t.driverId ?? rememberedDriver(t.id),
      departureAt: vietnamLocal(t.departureAt),
      arrivalAt: vietnamLocal(t.arrivalAt),
      fare: String(t.fare.amount),
    });
    setVersion(t.rowVersion);
    setLoadedId(t.id);
    setChanged(false);
  }
  const route = resources.routes.data?.find((r) => r.id === form.routeId);
  const bus = resources.buses.data?.find((b) => b.id === form.busId);
  const driver = resources.drivers.data?.find((d) => d.id === form.driverId);
  const window = localTripWindow(form.departureAt, form.arrivalAt);
  const invalidTimeOrder = hasInvalidTimeOrder(form);
  const serviceDate = window
    ? new Date(window[1]).toISOString().slice(0, 10)
    : "";
  const driverExpired =
    !!driver && !!serviceDate && driver.licenseExpiresOn < serviceDate;
  const schedule = useOperatorSchedule(!!window);
  const conflicts =
    window && schedule.data
      ? scheduleConflicts(schedule.data, window, tripId)
      : null;
  const busConflicts = conflicts?.buses.get(form.busId) ?? [];
  const driverConflicts = conflicts?.drivers.get(form.driverId) ?? [];
  const hasConflict =
    schedule.isSuccess &&
    (busConflicts.length > 0 || driverConflicts.length > 0);
  const busOptions: ResourceOption[] = (resources.buses.data ?? [])
    .filter((b) => b.status === "ACTIVE")
    .map((b) => {
      const matches = schedule.isSuccess
        ? (conflicts?.buses.get(b.id) ?? [])
        : [];
      const noSeats = !b.seats.some((s) => s.enabled);
      return {
        id: b.id,
        label: b.plateNumber,
        description: `${busLabel(b)} · ${b.seats.length} chỗ`,
        disabled: noSeats || matches.length > 0,
        disabledReason: noSeats
          ? "Chưa có ghế bán"
          : conflictReason(matches, window),
        conflicts: matches,
      };
    });
  const driverOptions: ResourceOption[] = (resources.drivers.data ?? [])
    .filter(
      (d) =>
        d.status === "ACTIVE" &&
        (!serviceDate || d.licenseExpiresOn >= serviceDate),
    )
    .map((d) => {
      const matches = schedule.isSuccess
        ? (conflicts?.drivers.get(d.id) ?? [])
        : [];
      return {
        id: d.id,
        label: driverLabel(d),
        description: "",
        disabled: matches.length > 0,
        disabledReason: conflictReason(matches, window),
        conflicts: matches,
      };
    });
  const mutation = useMutation({
    mutationFn: async (action: "save" | "review") => {
      if (!canPublishTrip())
        throw Error("Bạn không có quyền tạo hoặc sửa chuyến.");
      if (action === "review" && hasConflict)
        throw Error(
          `Xe hoặc tài xế đã chọn: ${conflictReason([...busConflicts, ...driverConflicts], window)}. Vui lòng chọn lại; bạn vẫn có thể lưu bản nháp.`,
        );
      const input = tripInput(form);
      const issues = resourceIssues(bus, driver, input.arrivalAt, route);
      if (issues.length) throw Error(issues.join(" "));
      if (mode === "edit" && !changed && existing.data)
        return { trip: existing.data, action };
      const trip = await liveApiJson(
        tripId ? `/api/v1/operator/trips/${tripId}` : "/api/v1/operator/trips",
        tripSchema,
        {
          method: tripId ? "PATCH" : "POST",
          body: { ...input, expectedVersion: tripId ? version : 0 },
          idempotent: !tripId,
        },
      );
      rememberTrip(trip.id, form.driverId);
      return { trip, action };
    },
    onSuccess: ({ trip, action }) => {
      client.setQueryData(liveQueryKey("operator-trip-workflow", trip.id), {
        ...trip,
        routeId: form.routeId,
        busId: form.busId,
        driverId: form.driverId,
      });
      void client.invalidateQueries({ queryKey: ["live-api"] });
      setVersion(trip.rowVersion);
      setChanged(false);
      void navigate(
        action === "review"
          ? `/operator/trips/review?tripId=${trip.id}`
          : `/operator/trips/draft/edit?tripId=${trip.id}`,
        { replace: true },
      );
    },
    onSettled: () => {
      submitting.current = false;
    },
    retry: false,
  });
  const change = (key: keyof TripForm, value: string): void => {
    const next = { ...form, [key]: value };
    setForm(next);
    if (key === "departureAt" || key === "arrivalAt") {
      if (!hasInvalidTimeOrder(next)) setTimeNotice(false);
      else if (!invalidTimeOrder) {
        setTimeNotice(true);
        setTimeNoticeKey((value) => value + 1);
      }
    }
    setChanged(true);
    mutation.reset();
  };
  const submit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    if (invalidTimeOrder) {
      setTimeNotice(true);
      setTimeNoticeKey((value) => value + 1);
      e.currentTarget
        .querySelector<HTMLElement>('input[aria-invalid="true"]')
        ?.focus();
      return;
    }
    if (submitting.current) return;
    submitting.current = true;
    const button = (e.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement | null;
    mutation.mutate(button?.value === "save" ? "save" : "review");
  };
  const pending =
    resources.pending || (mode === "edit" && !!tripId && existing.isPending);
  const error = resources.error ?? existing.error;
  const retry = (): void => {
    void resources.routes.refetch();
    void resources.buses.refetch();
    void resources.drivers.refetch();
    if (tripId) void existing.refetch().then(() => setLoadedId(""));
  };
  const duration =
    (Date.parse(form.arrivalAt + "+07:00") -
      Date.parse(form.departureAt + "+07:00")) /
    3600000;
  return (
    <TripWorkflowShell
      title={mode === "edit" ? "Chỉnh sửa bản nháp" : "Tạo chuyến"}
      status={
        mutation.isPending
          ? "Đang lưu bản nháp…"
          : changed
            ? "Có thay đổi chưa lưu"
            : mode === "edit"
              ? "Bản nháp đã lưu"
              : "Bản nháp mới"
      }
    >
      {invalidTimeOrder && timeNotice && (
        <Toast
          key={timeNoticeKey}
          tone="error"
          message="Giờ đến phải sau giờ đi."
          onClose={closeTimeNotice}
        />
      )}
      {pending ? (
        <div className="operator-create__panel" role="status">
          Đang tải tuyến, xe và tài xế…
        </div>
      ) : error ? (
        <WorkflowError error={error} retry={retry} />
      ) : mode === "edit" && (!tripId || existing.data?.status !== "DRAFT") ? (
        <div className="operator-create__panel">
          <h2>{!tripId ? "Chưa chọn bản nháp" : "Chuyến đã được phát hành"}</h2>
          <p>Chọn một bản nháp trong lịch chuyến để chỉnh sửa.</p>
          <Link to="/operator/trips">Về lịch chuyến</Link>
        </div>
      ) : (
        <form onSubmit={submit}>
          <WorkflowError
            error={mutation.error}
            retry={mutation.error ? retry : undefined}
          />
          {!canPublishTrip() && (
            <p className="operator-trip-workflow__warning" role="alert">
              Bạn không có quyền tạo hoặc phát hành chuyến.
            </p>
          )}
          <div className="operator-create__columns">
            <div>
              <section className="operator-create__panel operator-create__route">
                <h2>Tuyến &amp; thời gian</h2>
                <p>Chọn hành trình và thời điểm xuất bến.</p>
                <Field
                  label="Tuyến"
                  value={form.routeId}
                  onChange={(v) => change("routeId", v)}
                >
                  <option value="">Chọn tuyến xe</option>
                  {resources.routes.data
                    ?.filter(
                      (r) => r.status === "ACTIVE" || r.id === form.routeId,
                    )
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                        {r.status !== "ACTIVE" ? " · Ngừng hoạt động" : ""}
                      </option>
                    ))}
                </Field>
                <div className="operator-create__two">
                  <TripFact label="Điểm đi">
                    {route?.origin ?? "Chưa chọn tuyến"}
                  </TripFact>
                  <TripFact label="Điểm đến">
                    {route?.destination ?? "Chưa chọn tuyến"}
                  </TripFact>
                </div>
                <div className="operator-trip-workflow__times">
                  <Field
                    label="Khởi hành (giờ Việt Nam)"
                    type="datetime-local"
                    value={form.departureAt}
                    onChange={(v) => change("departureAt", v)}
                  />
                  <Field
                    label="Đến nơi (giờ Việt Nam)"
                    type="datetime-local"
                    value={form.arrivalAt}
                    error={
                      invalidTimeOrder ? "Giờ đến phải sau giờ đi." : undefined
                    }
                    onChange={(v) => change("arrivalAt", v)}
                  />
                  <TripFact label="Thời gian dự kiến">
                    {Number.isFinite(duration) && duration > 0
                      ? `${Math.floor(duration)} giờ ${Math.round((duration % 1) * 60)} phút`
                      : "Chưa xác định"}
                  </TripFact>
                </div>
                <TripStops route={route} />
                <p>Các điểm đón/trả được lấy từ tuyến đã chọn.</p>
              </section>
              <section className="operator-create__panel operator-create__crew">
                <h2>Xe &amp; nhân sự</h2>
                <p>Phân công xe và tài xế cho chuyến đi.</p>
                <div
                  className="operator-trip-workflow__schedule"
                  aria-live="polite"
                >
                  {!window ? (
                    <p>
                      Nhập giờ đi và giờ đến hợp lệ để kiểm tra lịch xe, tài xế.
                    </p>
                  ) : schedule.isPending ? (
                    <p role="status">Đang tải lịch phân công…</p>
                  ) : schedule.isError ? (
                    <p role="alert">
                      Chưa tải được lịch phân công. Danh sách chưa được lọc; hệ
                      thống sẽ kiểm tra khi phát hành.
                    </p>
                  ) : (
                    <p>
                      Đã đối chiếu lịch, có tính khoảng đệm 1 giờ trước và sau
                      mỗi chuyến. Cập nhật lúc{" "}
                      {new Date(schedule.dataUpdatedAt).toLocaleTimeString(
                        "vi-VN",
                        {
                          hour: "2-digit",
                          minute: "2-digit",
                          timeZone: "Asia/Ho_Chi_Minh",
                        },
                      )}
                      .
                    </p>
                  )}
                  {window && (
                    <Button
                      type="button"
                      variant="secondary"
                      isLoading={schedule.isFetching}
                      onClick={() => void schedule.refetch()}
                    >
                      Cập nhật lịch
                    </Button>
                  )}
                </div>
                {conflicts?.incompleteDrivers && schedule.isSuccess && (
                  <p className="operator-trip-workflow__warning">
                    Một số chuyến chưa có đủ thông tin tài xế. Kết quả đối chiếu
                    tài xế có thể chưa đầy đủ.
                  </p>
                )}
                <div className="operator-create__two">
                  <ResourcePicker
                    label="Xe"
                    placeholder="Chọn phương tiện"
                    value={form.busId}
                    selectedLabel={bus?.plateNumber}
                    options={busOptions}
                    disabled={!window || schedule.isPending}
                    onChange={(v) => change("busId", v)}
                  />
                  <ResourcePicker
                    label="Tài xế"
                    placeholder="Chọn tài xế"
                    value={form.driverId}
                    selectedLabel={driver ? driverLabel(driver) : undefined}
                    options={driverOptions}
                    disabled={!window || schedule.isPending}
                    onChange={(v) => change("driverId", v)}
                  />
                </div>
                {driverExpired && (
                  <p className="operator-trip-workflow__warning" role="alert">
                    GPLX của tài xế đang chọn không còn đủ hạn cho chuyến này.
                    Vui lòng chọn tài xế khác.
                  </p>
                )}
                {hasConflict && (
                  <div className="operator-trip-workflow__warning" role="alert">
                    {busConflicts.length > 0 && (
                      <p>
                        Xe {bus?.plateNumber}:{" "}
                        {conflictReason(busConflicts, window)} ·{" "}
                        {conflictLabel(busConflicts)}.
                      </p>
                    )}
                    {driverConflicts.length > 0 && (
                      <p>
                        Tài xế {driver ? driverLabel(driver) : ""}:{" "}
                        {conflictReason(driverConflicts, window)} ·{" "}
                        {conflictLabel(driverConflicts)}.
                      </p>
                    )}
                    <p>
                      Vui lòng chọn lại nguồn lực hoặc đổi thời gian. Thông tin
                      đang chọn được giữ để bạn kiểm tra; vẫn có thể lưu nháp.
                    </p>
                  </div>
                )}
                <div className="operator-create__three">
                  <TripFact label="Loại xe">{busLabel(bus)}</TripFact>
                  <TripFact label="Sức chứa">
                    {bus ? `${bus.seats.length} chỗ` : "Chưa chọn xe"}
                  </TripFact>
                  <TripFact label="GPLX có hiệu lực đến">
                    {driver
                      ? driver.licenseExpiresOn.split("-").reverse().join("/")
                      : "Chưa chọn tài xế"}
                  </TripFact>
                </div>
                <div className="operator-create__note">
                  <img src={checkIcon} alt="" width={20} height={20} />
                  <div>
                    <strong>Thông tin phân công</strong>
                    <small>
                      Lưu bản nháp trước khi kiểm tra và xác nhận phát hành.
                    </small>
                  </div>
                </div>
                {mode === "edit" && !form.driverId && (
                  <p className="operator-trip-workflow__warning">
                    Vui lòng chọn lại tài xế trước khi lưu bản nháp này.
                  </p>
                )}
              </section>
            </div>
            <aside>
              <section className="operator-create__panel operator-create__fare">
                <h2>Giá vé &amp; chính sách hủy</h2>
                <p>
                  {route
                    ? `Áp dụng cho tuyến ${route.name}.`
                    : "Chọn tuyến để thiết lập giá vé."}
                </p>
                <Field
                  label="Giá vé (VND)"
                  type="number"
                  value={form.fare}
                  onChange={(v) => change("fare", v)}
                />
                <CancellationPolicy />
              </section>
              <section className="operator-create__panel operator-create__validation">
                <h2>Kiểm tra nguồn lực</h2>
                <ul className="operator-trip-workflow__checks">
                  <li>
                    Xe:{" "}
                    {bus
                      ? bus.status === "ACTIVE"
                        ? "Đang hoạt động"
                        : "Không hoạt động"
                      : "Chưa chọn"}
                  </li>
                  <li>
                    Tài xế:{" "}
                    {driver
                      ? driver.status === "ACTIVE"
                        ? "Đang hoạt động"
                        : "Không hoạt động"
                      : "Chưa chọn"}
                  </li>
                  <li>
                    Sơ đồ ghế:{" "}
                    {bus
                      ? `${bus.seats.filter((s) => s.enabled).length} vị trí được bán`
                      : "Chưa chọn xe"}
                  </li>
                </ul>
                <p>
                  Lịch xe và tài xế được hệ thống xác nhận khi phát hành chuyến.
                </p>
              </section>
            </aside>
          </div>
          <footer className="operator-create__actions">
            <Link to="/operator/trips">Hủy</Link>
            <Button
              type="submit"
              value="save"
              variant="secondary"
              disabled={!canPublishTrip() || mutation.isPending}
            >
              Lưu bản nháp
            </Button>
            <Button
              type="submit"
              value="review"
              disabled={!canPublishTrip() || hasConflict}
              isLoading={mutation.isPending}
            >
              <img src={reviewIcon} alt="" width={17} height={17} />
              Kiểm tra chuyến
            </Button>
          </footer>
        </form>
      )}
    </TripWorkflowShell>
  );
}
