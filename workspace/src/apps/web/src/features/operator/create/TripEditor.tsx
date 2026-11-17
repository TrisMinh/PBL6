import { z } from "zod";
import {
  RecurrenceFields,
  RecurringTripResults,
  recurringDates,
  type Recurrence,
} from "./RecurringTrips";
import { BrandLoading } from "@/shared/ui/BrandLogo/BrandLoading";
import {
  useCallback,
  useRef,
  useState,
  type FormEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TripArtwork } from "../components/TripArtwork";
import { TripRouteSelector } from "./TripRouteSelector";
import { tripPictures, saveTripPicture } from "./tripPresentation";
import { storeDriverFile, validateDriverFile } from "../drivers/driverFiles";
import type { DriverAttachment } from "../drivers/drivers.schema";
import { UploadSimple } from "@phosphor-icons/react/dist/csr/UploadSimple";
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
  type Route,
  type Bus,
  type Driver,
  type Trip,
} from "../tripWorkflow";
import {
  CancellationPolicy,
  TripFact,
  TripWorkflowShell,
  WorkflowError,
} from "../TripWorkflowUI";
import reviewIcon from "@/assets/operator/create/imgFrame9.svg";
import { ResourcePicker, type ResourceOption } from "./ResourcePicker";
import { TripDateTimeField } from "./TripDateTimeField";
import "./TripEditorTheme.css";
import {
  suggestedArrival,
  durationLabel,
  timingError,
  routeTiming,
} from "./tripTiming";
import { getVietnamTodayDate } from "@/shared/lib/getVietnamTodayDate";
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
  minDate,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  children?: ReactNode;
  disabled?: boolean;
  error?: string;
  minDate?: string;
}): ReactElement {
  if (type === "datetime-local")
    return (
      <TripDateTimeField
        label={label}
        value={value}
        onChange={onChange}
        disabled={disabled}
        error={error}
        minDate={minDate}
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

export interface TripEditorPreview {
  initialForm: TripForm;
  routes: Route[];
  buses: Bus[];
  drivers: Driver[];
  onSave: (form: TripForm) => void;
}
function TripWizardSummary({
  confirmed,
  routes,
  buses,
  drivers,
  step,
  picture,
  pictureFile,
  pictureError,
  onPicture,
}: {
  confirmed: TripForm | null;
  routes: Route[];
  buses: Bus[];
  drivers: Driver[];
  step: number;
  picture?: DriverAttachment;
  pictureFile?: File;
  pictureError: string;
  onPicture: (file: File) => void;
}): ReactElement {
  const route = routes.find((item) => item.id === confirmed?.routeId);
  const bus = buses.find((item) => item.id === confirmed?.busId);
  const driver = drivers.find((item) => item.id === confirmed?.driverId);
  const date = (value?: string): string =>
    value
      ? `${value.slice(11, 16)} · ${value.slice(0, 10).split("-").reverse().join("/")}`
      : "Chưa xác nhận";
  return (
    <aside
      className="operator-trip-wizard__summary"
      aria-label="Tóm tắt chuyến"
      aria-live="polite"
    >
      <h2>Chuyến đi của bạn</h2>
      <div className="operator-trip-wizard__identity">
        <TripArtwork
          className="operator-trip-wizard__picture"
          photo={picture}
          file={pictureFile}
        />
        <div className="operator-trip-wizard__identity-text">
          <span className="operator-trip-wizard__draft">BẢN NHÁP CHUYẾN</span>
          <strong>
            {route
              ? `${route.origin} → ${route.destination}`
              : "Chưa chọn hành trình"}
          </strong>
          <label className="operator-trip-wizard__upload">
            <UploadSimple size={15} />{" "}
            {pictureFile || picture ? "Đổi ảnh chuyến" : "Tải ảnh chuyến"}
            <input
              type="file"
              accept="image/jpeg,image/png"
              aria-label="Ảnh chuyến"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) onPicture(file);
              }}
            />
          </label>
        </div>
      </div>
      <small>
        {pictureFile
          ? pictureFile.name
          : picture
            ? picture.name
            : "Ảnh minh họa · JPG, PNG, tối đa 5 MB"}
      </small>
      {pictureError && (
        <p role="alert" className="operator-trip-wizard__picture-error">
          {pictureError}
        </p>
      )}
      <dl>
        <div>
          <dt>Khởi hành</dt>
          <dd>{date(confirmed?.departureAt)}</dd>
        </div>
        <div>
          <dt>Đến dự kiến</dt>
          <dd>{date(confirmed?.arrivalAt)}</dd>
        </div>
        <div>
          <dt>Xe</dt>
          <dd>{bus?.plateNumber ?? "Chưa phân công"}</dd>
        </div>
        <div>
          <dt>Loại xe / sức chứa</dt>
          <dd>
            {bus
              ? `${busLabel(bus)} · ${bus.seats.filter((s) => s.enabled).length} chỗ`
              : "Chưa chọn xe"}
          </dd>
        </div>
        <div>
          <dt>Tài xế</dt>
          <dd className="operator-trip-wizard__driver">
            {driver && (
              <span
                className="operator-schedule__driver-avatar"
                aria-hidden="true"
              >
                {(driver.fullName || "Tài xế")
                  .split(" ")
                  .slice(-2)
                  .map((part) => part[0])
                  .join("")}
              </span>
            )}
            {driver ? driver.fullName || driverLabel(driver) : "Chưa phân công"}
          </dd>
        </div>
        <div>
          <dt>Giá vé</dt>
          <dd>
            {confirmed?.fare
              ? `${Number(confirmed.fare).toLocaleString("vi-VN")} đ`
              : "Chưa xác nhận"}
          </dd>
        </div>
      </dl>
      <div className="operator-trip-wizard__summary-progress">
        Bước {step + 1}/3 ·{" "}
        {step === 0
          ? "Tuyến & thời gian"
          : step === 1
            ? "Xe & tài xế"
            : "Giá vé & xác nhận"}
      </div>
      <small>Chuyến chỉ mở bán sau khi kiểm tra và phát hành thành công.</small>
    </aside>
  );
}
export function CreateTripPage({
  mode = "create",
  preview,
  embedded = false,
  tripIdOverride,
  onSaved,
  onCancel,
}: {
  mode?: "create" | "edit";
  preview?: TripEditorPreview;
  embedded?: boolean;
  tripIdOverride?: string;
  onSaved?: () => void;
  onCancel?: () => void;
} = {}): ReactElement {
  const [params] = useSearchParams();
  const tripId =
    mode === "edit"
      ? (tripIdOverride ?? params.get("tripId") ?? rememberedTripId())
      : "";
  const existing = useOperatorTrip(tripId),
    liveResources = useTripResources();
  const resources = preview
    ? {
        ...liveResources,
        routes: { ...liveResources.routes, data: preview.routes },
        buses: { ...liveResources.buses, data: preview.buses },
        drivers: { ...liveResources.drivers, data: preview.drivers },
        pending: false,
        error: null,
      }
    : liveResources;
  const navigate = useNavigate(),
    client = useQueryClient();
  const [form, setForm] = useState<TripForm>(
    preview?.initialForm ?? emptyTripForm,
  );
  const [loadedId, setLoadedId] = useState("");
  const [version, setVersion] = useState(0);
  const [changed, setChanged] = useState(false);
  const [timeNotice, setTimeNotice] = useState(false);
  const [timeNoticeKey, setTimeNoticeKey] = useState(0);
  const closeTimeNotice = useCallback(() => setTimeNotice(false), []);
  const submitting = useRef(false);
  const [pictureFile, setPictureFile] = useState<File>();
  const [pictureError, setPictureError] = useState("");
  const uploadedPicture = useRef<{
    file: File;
    attachment: DriverAttachment;
  } | null>(null);
  const savedDuringAttempt = useRef<{ trip: Trip; input: string } | null>(null);
  const pictures = useQuery({
    queryKey: liveQueryKey("operator-trip-pictures", tripId),
    queryFn: ({ signal }) => tripPictures(signal),
    enabled: !!tripId && !preview,
  });
  const selectPicture = async (file: File): Promise<void> => {
    try {
      await validateDriverFile(file, true);
      setPictureFile(file);
      setPictureError("");
      setChanged(true);
      mutation.reset();
    } catch (reason) {
      setPictureError(
        reason instanceof Error ? reason.message : "Không đọc được ảnh.",
      );
    }
  };
  const wizard = !embedded;
  const [step, setStep] = useState(0);
  const [recurrence, setRecurrence] = useState<Recurrence>({
    enabled: false,
    endDate: "",
    days: [0, 1, 2, 3, 4, 5, 6],
  });
  const [series, setSeries] = useState<Trip[] | null>(null);
  const savedSeries = useRef<{ key: string; trips: Trip[] } | null>(null);
  const canRepeat =
    !preview && (mode === "create" || existing.data?.status === "DRAFT");
  const recurrenceEnabled = canRepeat && recurrence.enabled;
  const dates = recurringDates(form.departureAt.slice(0, 10), recurrence);
  const [confirmed, setConfirmed] = useState<TripForm | null>(null);
  const [stepError, setStepError] = useState("");
  const formRegion = useRef<HTMLDivElement>(null);
  const [manualDeparture, setManualDeparture] = useState(
    !!preview?.initialForm.departureAt,
  );
  const [manualArrival, setManualArrival] = useState(
    !!preview?.initialForm.arrivalAt,
  );
  const [unusualTimingAccepted, setUnusualTimingAccepted] = useState(false);
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
    setManualDeparture(true);
    setManualArrival(true);
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
  const schedule = useOperatorSchedule(
    !!window && !preview,
    JSON.stringify([
      tripId,
      form.departureAt,
      form.arrivalAt,
      form.busId,
      form.driverId,
    ]),
  );

  const conflicts =
    window && schedule.data && !preview
      ? scheduleConflicts(schedule.data, window, tripId)
      : null;
  const busConflicts = conflicts?.buses.get(form.busId) ?? [];
  const driverConflicts = conflicts?.drivers.get(form.driverId) ?? [];
  const hasConflict =
    schedule.isSuccess &&
    (busConflicts.length > 0 || driverConflicts.length > 0);
  const assignmentStatus = preview
    ? { state: "demo", label: "Bản minh họa" }
    : !window
      ? { state: "waiting", label: "Chờ giờ chạy" }
      : schedule.isFetching
        ? { state: "checking", label: "Đang kiểm tra" }
        : schedule.isError
          ? { state: "error", label: "Chưa kiểm tra được" }
          : driverExpired
            ? { state: "conflict", label: "GPLX hết hạn" }
            : hasConflict
              ? { state: "conflict", label: "Trùng lịch" }
              : !bus || !driver
                ? { state: "waiting", label: "Chờ phân công" }
                : conflicts?.incompleteDrivers
                  ? { state: "warning", label: "Cần kiểm tra thêm" }
                  : { state: "ready", label: "Sẵn sàng" };
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
      if (
        !preview &&
        action === "review" &&
        (!schedule.isSuccess || schedule.isFetching)
      )
        throw Error(
          "Chờ hệ thống kiểm tra xong lịch xe và tài xế trước khi kiểm tra chuyến.",
        );
      if (action === "review" && hasConflict)
        throw Error(
          `Xe hoặc tài xế đã chọn: ${conflictReason([...busConflicts, ...driverConflicts], window)}. Vui lòng chọn lại; bạn vẫn có thể lưu bản nháp.`,
        );
      const input = tripInput(form);
      const issues = resourceIssues(bus, driver, input.arrivalAt, route);
      if (issues.length) throw Error(issues.join(" "));
      if (preview) {
        return {
          trip: tripSchema.parse({
            id: "DEMO-TAI-XE",
            organizationId: "demo",
            ...input,
            origin: route?.origin,
            destination: route?.destination,
            status: "DRAFT",
            sellable: false,
            rowVersion: 0,
            stops: route?.stops ?? [],
          }),
          action,
        };
      }
      if (recurrenceEnabled) {
        if (!dates.length)
          throw Error(
            "Chọn ngày kết thúc và ít nhất một ngày chạy hợp lệ trong tuần.",
          );
        const body = {
          template: {
            ...input,
            expectedVersion: mode === "edit" ? version : 0,
          },
          ...(mode === "edit" ? { sourceTripId: tripId } : {}),
          endDate: recurrence.endDate,
          weekdays: recurrence.days,
        };
        const key = JSON.stringify(body);
        const trips =
          savedSeries.current?.key === key
            ? savedSeries.current.trips
            : await liveApiJson(
                "/api/v1/operator/trips/recurring",
                z.array(tripSchema),
                { method: "POST", body, idempotent: true },
              );
        savedSeries.current = { key, trips };
        if (pictureFile) {
          if (uploadedPicture.current?.file !== pictureFile)
            uploadedPicture.current = {
              file: pictureFile,
              attachment: await storeDriverFile(pictureFile, true),
            };
          for (const trip of trips)
            await saveTripPicture(
              trip.id,
              trip.organizationId,
              uploadedPicture.current.attachment,
            );
        }
        return { trip: trips[0], action, series: trips };
      }
      if (mode === "edit" && !changed && existing.data)
        return { trip: existing.data, action };
      const saved = savedDuringAttempt.current;
      const effectiveTripId = tripId || saved?.trip.id;
      const trip =
        saved?.input === JSON.stringify(input)
          ? saved.trip
          : await liveApiJson(
              effectiveTripId
                ? `/api/v1/operator/trips/${effectiveTripId}`
                : "/api/v1/operator/trips",
              tripSchema,
              {
                method: effectiveTripId ? "PATCH" : "POST",
                body: {
                  ...input,
                  expectedVersion:
                    saved?.trip.rowVersion ?? (tripId ? version : 0),
                },
                idempotent: !effectiveTripId,
              },
            );
      savedDuringAttempt.current = { trip, input: JSON.stringify(input) };
      rememberTrip(trip.id, form.driverId);
      if (pictureFile) {
        try {
          if (uploadedPicture.current?.file !== pictureFile)
            uploadedPicture.current = {
              file: pictureFile,
              attachment: await storeDriverFile(pictureFile, true),
            };
          await saveTripPicture(
            trip.id,
            trip.organizationId,
            uploadedPicture.current.attachment,
          );
        } catch {
          throw Error(
            "Bản nháp đã lưu nhưng ảnh chưa lưu được. Bấm lưu lại để thử tải ảnh, hệ thống không tạo thêm chuyến.",
          );
        }
      }
      return { trip, action };
    },
    onSuccess: (result) => {
      const { trip, action } = result;
      if ("series" in result && result.series) {
        setSeries(result.series);
        setChanged(false);
        void client.invalidateQueries({ queryKey: ["live-api"] });
        void client.invalidateQueries({
          queryKey: ["operator", "schedule-preview"],
        });
        return;
      }
      if (preview) {
        preview.onSave(form);
        return;
      }
      client.setQueryData(liveQueryKey("operator-trip-workflow", trip.id), {
        ...trip,
        routeId: form.routeId,
        busId: form.busId,
        driverId: form.driverId,
      });
      void client.invalidateQueries({ queryKey: ["live-api"] });
      void client.invalidateQueries({
        queryKey: ["operator", "schedule-preview"],
      });
      setVersion(trip.rowVersion);
      setChanged(false);
      if (embedded && action === "save") {
        onSaved?.();
        return;
      }
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
    setStepError("");
    const next = { ...form, [key]: value };
    if (key === "arrivalAt") setManualArrival(true);
    if (key === "departureAt") {
      setManualDeparture(true);
      if (!manualArrival)
        next.arrivalAt = suggestedArrival(value, route?.durationMinutes);
    }
    if (key === "routeId") {
      const chosenRoute = resources.routes.data?.find(
        (item) => item.id === value,
      );
      if (chosenRoute)
        Object.assign(
          next,
          routeTiming(next, chosenRoute.durationMinutes, {
            departure: manualDeparture,
            arrival: manualArrival,
          }),
        );
    }
    if (["routeId", "departureAt", "arrivalAt"].includes(key))
      setUnusualTimingAccepted(false);
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
  const moveStep = (next: number): void => {
    setStep(next);
    setStepError("");
    requestAnimationFrame(() => {
      formRegion.current?.focus({ preventScroll: true });
      formRegion.current?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    });
  };
  const nextStep = (): void => {
    if (step === 0) {
      if (!route || route.status !== "ACTIVE") {
        setStepError(
          "Chọn tỉnh, thành phố đi/đến và điểm đón, điểm trả của tuyến.",
        );
        return;
      }
      if (recurrenceEnabled && !dates.length) {
        setStepError(
          "Chọn ngày kết thúc và ít nhất một ngày chạy hợp lệ trong tuần (tối đa 3 tháng mỗi lần).",
        );
        return;
      }
      const invalidTiming = timingError(
        form.departureAt,
        form.arrivalAt,
        mode === "create" && !preview,
      );
      if (invalidTiming) {
        setStepError(invalidTiming);
        return;
      }
      if (unusualTiming && !unusualTimingAccepted) {
        setStepError(
          "Thời lượng đang khác nhiều so với tuyến. Dùng giờ đến gợi ý hoặc xác nhận lịch đặc biệt bên dưới.",
        );
        return;
      }
      setConfirmed((previous) => ({
        ...(previous?.routeId === form.routeId &&
        previous.departureAt === form.departureAt &&
        previous.arrivalAt === form.arrivalAt
          ? previous
          : emptyTripForm),
        routeId: form.routeId,
        departureAt: form.departureAt,
        arrivalAt: form.arrivalAt,
      }));
    } else {
      const issues = resourceIssues(
        bus,
        driver,
        form.arrivalAt ? form.arrivalAt + ":00+07:00" : "",
        route,
      );
      if (issues.length) {
        setStepError(issues.join(" "));
        return;
      }
      if (!preview && (!schedule.isSuccess || schedule.isFetching)) {
        setStepError(
          "Hệ thống đang tự kiểm tra lịch xe và tài xế. Vui lòng đợi kiểm tra thành công trước khi tiếp tục.",
        );
        return;
      }
      if (hasConflict) {
        setStepError(
          "Xe hoặc tài xế đang trùng lịch. Chọn lại nguồn lực trước khi tiếp tục.",
        );
        return;
      }
      setConfirmed((previous) => ({
        ...(previous ?? emptyTripForm),
        ...form,
        fare: previous?.fare ?? "",
      }));
    }
    moveStep(step + 1);
  };
  const submit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    if (wizard && step < 2) {
      nextStep();
      return;
    }
    if (wizard) {
      try {
        tripInput(form);
      } catch (reason) {
        setStepError(
          reason instanceof Error
            ? reason.message
            : "Kiểm tra thông tin chuyến.",
        );
        return;
      }
      setConfirmed({ ...form });
    }
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
  const error = resources.error ?? (preview ? null : existing.error);
  const readOnly =
    embedded &&
    !preview &&
    mode === "edit" &&
    existing.data?.status !== "DRAFT";
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
  const arrivalSuggestion = suggestedArrival(
    form.departureAt,
    route?.durationMinutes,
  );
  const unusualTiming =
    Number.isFinite(duration) &&
    !!route?.durationMinutes &&
    duration > 0 &&
    Math.abs(duration * 60 - route.durationMinutes) >
      Math.max(360, route.durationMinutes * 0.5);
  if (series)
    return (
      <TripWorkflowShell
        title="Lịch chạy lặp"
        status={`Đã tạo ${series.length} chuyến`}
        step={2}
      >
        <RecurringTripResults
          trips={series}
          onPublished={() => {
            void client.invalidateQueries({ queryKey: ["live-api"] });
            void client.invalidateQueries({
              queryKey: ["operator", "schedule-preview"],
            });
          }}
        />
      </TripWorkflowShell>
    );
  return (
    <TripWorkflowShell
      step={wizard ? step : undefined}
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
        <BrandLoading compact title="Đang tải tuyến, xe và tài xế…" />
      ) : error ? (
        <WorkflowError error={error} retry={retry} />
      ) : !embedded &&
        mode === "edit" &&
        (!tripId || existing.data?.status !== "DRAFT") ? (
        <div className="operator-create__panel">
          <h2>{!tripId ? "Chưa chọn bản nháp" : "Chuyến đã được phát hành"}</h2>
          <p>Chọn một bản nháp trong lịch chuyến để chỉnh sửa.</p>
          <Link to="/operator/trips">Về lịch chuyến</Link>
        </div>
      ) : (
        <form
          onSubmit={submit}
          noValidate={wizard}
          className={wizard ? "operator-trip-wizard" : undefined}
        >
          {readOnly && (
            <p className="operator-trip-workflow__warning">
              Chuyến đã phát hành hoặc kết thúc: thông tin được khóa chỉnh sửa
              theo trạng thái hiện tại.
            </p>
          )}
          <WorkflowError
            error={mutation.error}
            retry={mutation.error ? retry : undefined}
          />
          {!canPublishTrip() && (
            <p className="operator-trip-workflow__warning" role="alert">
              Bạn không có quyền tạo hoặc phát hành chuyến.
            </p>
          )}
          <fieldset
            className="operator-trip-editor__fields"
            disabled={readOnly || !!series || mutation.isPending}
          >
            <div className="operator-create__columns">
              <div
                ref={formRegion}
                tabIndex={-1}
                className="operator-trip-wizard__stage"
                data-step={step}
              >
                {wizard && stepError && (
                  <p role="alert" className="operator-trip-wizard__error">
                    {stepError}
                  </p>
                )}
                <section
                  hidden={wizard && step !== 0}
                  className="operator-create__panel operator-create__route"
                >
                  <h2>Tuyến &amp; thời gian</h2>
                  <p>Chọn hành trình và thời điểm xuất bến.</p>
                  <TripRouteSelector
                    key={loadedId}
                    routes={resources.routes.data ?? []}
                    routeId={form.routeId}
                    onChange={(id) => change("routeId", id)}
                  >
                    <div className="operator-trip-workflow__times">
                      <Field
                        label="Khởi hành (giờ Việt Nam)"
                        type="datetime-local"
                        value={form.departureAt}
                        minDate={
                          mode === "create" && !preview
                            ? getVietnamTodayDate()
                            : undefined
                        }
                        onChange={(v) => change("departureAt", v)}
                      />
                      <Field
                        label="Đến nơi (giờ Việt Nam)"
                        type="datetime-local"
                        value={form.arrivalAt}
                        minDate={form.departureAt.slice(0, 10) || undefined}
                        error={
                          invalidTimeOrder
                            ? "Giờ đến phải sau giờ đi."
                            : undefined
                        }
                        onChange={(v) => change("arrivalAt", v)}
                      />
                      <TripFact label="Thời gian dự kiến">
                        {durationLabel(duration * 60)}
                      </TripFact>
                    </div>
                    {canRepeat && (
                      <RecurrenceFields
                        start={form.departureAt.slice(0, 10)}
                        value={recurrence}
                        onChange={(value) => {
                          setRecurrence(value);
                          setChanged(true);
                          setStepError("");
                          mutation.reset();
                        }}
                      />
                    )}
                    {route?.durationMinutes ? (
                      <p className="operator-trip-wizard__time-hint">
                        Thời lượng tuyến:{" "}
                        <strong>{durationLabel(route.durationMinutes)}</strong>.
                        {!manualDeparture && form.departureAt
                          ? "Khởi hành gợi ý theo giờ tròn kế tiếp. "
                          : ""}
                        Giờ đến tính theo thời lượng tuyến; giữ nguyên giờ bạn
                        đã tự chỉnh.
                      </p>
                    ) : null}
                    {unusualTiming && (
                      <div className="operator-trip-wizard__time-warning">
                        <p>
                          Thời lượng đang chọn{" "}
                          <strong>{durationLabel(duration * 60)}</strong>, khác
                          với tuyến dự kiến{" "}
                          <strong>
                            {durationLabel(route?.durationMinutes ?? 0)}
                          </strong>
                          . Kiểm tra lại ngày đến.
                        </p>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => {
                            change("arrivalAt", arrivalSuggestion);
                            setManualArrival(false);
                          }}
                        >
                          Dùng giờ đến gợi ý
                        </Button>
                        <label>
                          <input
                            type="checkbox"
                            checked={unusualTimingAccepted}
                            onChange={(event) =>
                              setUnusualTimingAccepted(event.target.checked)
                            }
                          />{" "}
                          Tôi xác nhận đây là lịch có thời lượng đặc biệt
                        </label>
                      </div>
                    )}
                  </TripRouteSelector>
                </section>
                <section
                  hidden={wizard && step !== 1}
                  className="operator-create__panel operator-create__crew"
                >
                  <h2>Xe &amp; nhân sự</h2>
                  <p>Phân công xe và tài xế cho chuyến đi.</p>
                  <div className="operator-crew__resources">
                    <div className="operator-crew__resource">
                      <ResourcePicker
                        label="Xe"
                        placeholder="Chọn phương tiện"
                        value={form.busId}
                        selectedLabel={bus?.plateNumber}
                        options={busOptions}
                        disabled={!window}
                        onChange={(v) => change("busId", v)}
                      />
                      <dl className="operator-crew__facts">
                        <div>
                          <dt>Loại xe</dt>
                          <dd>{busLabel(bus)}</dd>
                        </div>
                        <div>
                          <dt>Sức chứa</dt>
                          <dd>
                            {bus ? `${bus.seats.length} chỗ` : "Chưa chọn xe"}
                          </dd>
                        </div>
                      </dl>
                    </div>
                    <div className="operator-crew__resource">
                      <ResourcePicker
                        label="Tài xế"
                        placeholder="Chọn tài xế"
                        value={form.driverId}
                        selectedLabel={driver ? driverLabel(driver) : undefined}
                        options={driverOptions}
                        disabled={!window}
                        onChange={(v) => change("driverId", v)}
                      />
                      <dl className="operator-crew__facts">
                        <div>
                          <dt>GPLX có hiệu lực đến</dt>
                          <dd>
                            {driver
                              ? driver.licenseExpiresOn
                                  .split("-")
                                  .reverse()
                                  .join("/")
                              : "Chưa chọn tài xế"}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                  {driverExpired && (
                    <p className="operator-trip-workflow__warning" role="alert">
                      GPLX của tài xế đang chọn không còn đủ hạn cho chuyến này.
                      Vui lòng chọn tài xế khác.
                    </p>
                  )}
                  {hasConflict && (
                    <div
                      className="operator-trip-workflow__warning"
                      role="alert"
                    >
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
                        Vui lòng chọn lại nguồn lực hoặc đổi thời gian. Thông
                        tin đang chọn được giữ để bạn kiểm tra; vẫn có thể lưu
                        nháp.
                      </p>
                    </div>
                  )}
                  {conflicts?.incompleteDrivers && schedule.isSuccess && (
                    <p className="operator-trip-workflow__warning">
                      Một số chuyến chưa có đủ thông tin tài xế. Kết quả đối
                      chiếu tài xế có thể chưa đầy đủ.
                    </p>
                  )}
                  <div className="operator-crew__availability">
                    <div className="operator-crew__availability-copy">
                      <p>
                        Lưu bản nháp trước khi kiểm tra và xác nhận phát hành.
                      </p>
                      <small>
                        {preview ? (
                          "DEMO · Không cập nhật lịch vận hành thật."
                        ) : !window ? (
                          "Nhập giờ đi và giờ đến để tự kiểm tra lịch."
                        ) : (
                          <>
                            Tự đối chiếu lịch · Khoảng đệm 1 giờ trước và sau
                            chuyến
                            {schedule.dataUpdatedAt > 0
                              ? ` · ${new Date(schedule.dataUpdatedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Ho_Chi_Minh" })}`
                              : ""}
                          </>
                        )}
                      </small>
                    </div>
                    <span
                      className="operator-crew__status"
                      data-state={assignmentStatus.state}
                      role="status"
                      aria-atomic="true"
                    >
                      <span
                        className="operator-crew__status-dot"
                        aria-hidden="true"
                      />
                      {assignmentStatus.label}
                    </span>
                  </div>
                  {!preview && schedule.isError && (
                    <p className="operator-trip-workflow__warning" role="alert">
                      Chưa kiểm tra được lịch. Hệ thống sẽ tự thử lại; bạn chưa
                      thể tiếp tục đến khi kiểm tra thành công.
                    </p>
                  )}
                  {mode === "edit" && !form.driverId && (
                    <p className="operator-trip-workflow__warning">
                      Vui lòng chọn lại tài xế trước khi lưu bản nháp này.
                    </p>
                  )}
                </section>
                <div hidden={wizard && step !== 2}>
                  {recurrenceEnabled && (
                    <section className="operator-create__panel">
                      <h2>Lịch chạy lặp · {dates.length} chuyến</h2>
                      <p>
                        Từ {dates[0]?.split("-").reverse().join("/")} đến{" "}
                        {dates.at(-1)?.split("-").reverse().join("/")} · Khởi
                        hành {form.departureAt.slice(11)} (giờ Việt Nam).
                      </p>
                      <p>
                        Áp dụng xe, tài xế, giá vé và chính sách đã chọn cho
                        từng ngày. Sau khi lưu, kiểm tra và phát hành các chuyến
                        bên dưới.
                      </p>
                    </section>
                  )}

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
                      Lịch xe và tài xế được hệ thống xác nhận khi phát hành
                      chuyến.
                    </p>
                  </section>
                </div>
              </div>
              {wizard && (
                <TripWizardSummary
                  confirmed={
                    step === 2 && confirmed
                      ? { ...confirmed, fare: form.fare }
                      : confirmed
                  }
                  routes={resources.routes.data ?? []}
                  buses={resources.buses.data ?? []}
                  drivers={resources.drivers.data ?? []}
                  step={step}
                  picture={pictures.data?.[tripId]}
                  pictureFile={pictureFile}
                  pictureError={pictureError}
                  onPicture={(file) => void selectPicture(file)}
                />
              )}
            </div>
          </fieldset>
          {!readOnly && !series && (
            <footer className="operator-create__actions">
              {onCancel ? (
                <Button type="button" variant="ghost" onClick={onCancel}>
                  Hủy thay đổi
                </Button>
              ) : (
                <Link
                  to="/operator/trips"
                  aria-disabled={mutation.isPending || undefined}
                  onClick={(event) => {
                    if (mutation.isPending) event.preventDefault();
                  }}
                >
                  Hủy
                </Link>
              )}
              {wizard && step > 0 && (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={mutation.isPending}
                  onClick={() => moveStep(step - 1)}
                >
                  Quay lại
                </Button>
              )}
              {wizard && step < 2 ? (
                <Button
                  type="submit"
                  value="next"
                  disabled={
                    !canPublishTrip() ||
                    (!preview && step === 1 && schedule.isFetching)
                  }
                >
                  Tiếp theo →
                </Button>
              ) : recurrenceEnabled ? (
                <Button
                  type="submit"
                  value="review"
                  disabled={
                    !canPublishTrip() ||
                    mutation.isPending ||
                    hasConflict ||
                    schedule.isFetching
                  }
                  isLoading={mutation.isPending}
                >
                  {mutation.isPending
                    ? "Đang tạo lịch…"
                    : `Tạo ${dates.length} chuyến`}
                </Button>
              ) : (
                <>
                  <Button
                    type="submit"
                    value="save"
                    variant={preview ? "primary" : "secondary"}
                    disabled={!canPublishTrip() || mutation.isPending}
                  >
                    {preview ? "Lưu thay đổi demo" : "Lưu bản nháp"}
                  </Button>
                  {!preview && (
                    <Button
                      type="submit"
                      value="review"
                      disabled={
                        !canPublishTrip() || hasConflict || schedule.isFetching
                      }
                      isLoading={mutation.isPending}
                    >
                      <img src={reviewIcon} alt="" width={17} height={17} />
                      Kiểm tra chuyến
                    </Button>
                  )}
                </>
              )}
            </footer>
          )}
        </form>
      )}
    </TripWorkflowShell>
  );
}
