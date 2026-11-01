import { DriverPhoto, DriverDocument } from "./DriverAttachments";
import * as Dialog from "@radix-ui/react-dialog";
import { useRef, useState, type FormEvent, type ReactElement } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { OperatorSidebar } from "../components/OperatorSidebar";
import { Button } from "@/shared/ui/Button/Button";
import { Input } from "@/shared/ui/Input/Input";
import { PageState } from "@/shared/ui/PageState/PageState";
import {
  DRIVER_STATUSES,
  LICENSE_CLASSES,
  driverInputSchema,
  type OperatorDriver,
  type DriverStatus,
} from "./drivers.schema";
import {
  changeDriverStatus,
  getDrivers,
  saveDriver,
} from "./driversRepository";
import navTrips from "@/assets/operator/drivers/imgFrame.svg";
import navBookings from "@/assets/operator/drivers/imgFrame1.svg";
import navRoutes from "@/assets/operator/drivers/imgFrame2.svg";
import navVehicles from "@/assets/operator/drivers/imgFrame3.svg";
import navDrivers from "@/assets/operator/drivers/imgFrame4.svg";
import navReports from "@/assets/operator/drivers/imgFrame5.svg";
import navMembers from "@/assets/operator/drivers/imgFrame6.svg";
import navCancel from "@/assets/operator/drivers/imgFrame7.svg";
import addIcon from "@/assets/operator/drivers/imgIconUserPlus.svg";
import chevron from "@/assets/operator/drivers/imgIconChevronDown.svg";
import availableDot from "@/assets/operator/drivers/imgStatusDot.svg";
import runningDot from "@/assets/operator/drivers/imgStatusDot1.svg";
import pausedDot from "@/assets/operator/drivers/imgStatusDot2.svg";
import "../schedule/SchedulePage.css";
import "./DriversPage.css";

const NAV_ICONS = {
  "Chuyến đi": navTrips,
  "Đặt chỗ & giao dịch": navBookings,
  "Tuyến & điểm dừng": navRoutes,
  "Xe & sơ đồ ghế": navVehicles,
  "Tài xế": navDrivers,
  "Báo cáo": navReports,
  "Tổ chức & thành viên": navMembers,
  "Hủy vé & hoàn tiền": navCancel,
};
const dateLabel = (value: string): string =>
  value.split("-").reverse().join("/");
const phoneLabel = (value: string): string =>
  `${value.slice(0, 4)} ${value.slice(4, 7)} ${value.slice(7)}`;
const initials = (value: string): string =>
  value
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((s) => s[0])
    .join("");
const normalize = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/\s+/g, "");
function StatusBadge({ status }: { status: DriverStatus }): ReactElement {
  return (
    <span className="operator-drivers__badge">
      <img
        src={
          status === "running"
            ? runningDot
            : status === "paused"
              ? pausedDot
              : availableDot
        }
        width={8}
        height={8}
        alt=""
      />
      {DRIVER_STATUSES[status]}
    </span>
  );
}
function Field({
  label,
  value,
}: {
  label: string;
  value: string;
}): ReactElement {
  return (
    <div className="operator-drivers__value">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
function DriverForm({
  driver,
  saved,
  cancel,
}: {
  driver?: OperatorDriver;
  saved: (driver: OperatorDriver) => void;
  cancel: () => void;
}): ReactElement {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const mutation = useMutation({
    mutationFn: (form: FormData) => {
      const parsed = driverInputSchema.safeParse(Object.fromEntries(form));
      if (!parsed.success) {
        setErrors(
          Object.fromEntries(
            parsed.error.issues.map((issue) => [
              String(issue.path[0]),
              issue.message,
            ]),
          ),
        );
        throw Error("Vui lòng kiểm tra các trường được đánh dấu.");
      }
      setErrors({});
      return saveDriver(parsed.data, driver?.id);
    },
    onSuccess: saved,
  });
  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    mutation.mutate(new FormData(event.currentTarget));
  }
  return (
    <form onSubmit={submit} className="operator-drivers__form">
      <Input
        label="Họ và tên"
        name="name"
        required
        maxLength={80}
        defaultValue={driver?.name}
        error={errors.name}
      />
      <Input
        label="Số điện thoại"
        name="phone"
        type="tel"
        required
        defaultValue={driver?.phone}
        error={errors.phone}
      />
      <Input
        label="Email"
        name="email"
        type="email"
        maxLength={100}
        defaultValue={driver?.email}
        error={errors.email}
      />
      <Input
        label="Ngày sinh"
        name="birthDate"
        type="date"
        defaultValue={driver?.birthDate}
        error={errors.birthDate}
      />
      <Input
        label="Địa chỉ"
        name="address"
        maxLength={200}
        defaultValue={driver?.address}
        error={errors.address}
      />
      <Input
        label="Số giấy phép"
        name="licenseNumber"
        required
        inputMode="numeric"
        maxLength={12}
        defaultValue={driver?.licenseNumber}
        error={errors.licenseNumber}
      />
      <label className="operator-drivers__select">
        <span>Hạng giấy phép</span>
        <select
          aria-label="Hạng giấy phép"
          name="licenseClass"
          defaultValue={driver?.licenseClass ?? "D"}
        >
          {LICENSE_CLASSES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <Input
        label="Ngày cấp"
        name="issuedAt"
        type="date"
        required
        defaultValue={driver?.issuedAt}
        error={errors.issuedAt}
      />
      <Input
        label="Ngày hết hạn"
        name="expiresAt"
        type="date"
        required
        defaultValue={driver?.expiresAt}
        error={errors.expiresAt}
      />
      {mutation.error && <p role="alert">{mutation.error.message}</p>}
      <footer>
        <Button
          type="button"
          variant="secondary"
          onClick={cancel}
          disabled={mutation.isPending}
        >
          Hủy
        </Button>
        <Button type="submit" isLoading={mutation.isPending}>
          {driver ? "Lưu hồ sơ" : "Tạo tài xế"}
        </Button>
      </footer>
    </form>
  );
}
type Modal =
  | { kind: "add" }
  | { kind: "edit" | "status" | "front" | "back"; driver: OperatorDriver };
export function DriversPage(): ReactElement {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [modal, setModal] = useState<Modal | null>(null),
    [notice, setNotice] = useState("");
  const focusReturn = useRef<HTMLElement | null>(null);
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["operator-drivers"],
    queryFn: ({ signal }) => getDrivers(signal),
  });
  const search = params.get("q") ?? "",
    status = params.get("status") ?? "",
    license = params.get("license") ?? "";
  const filtered = (query.data ?? []).filter(
    (d) =>
      (!status || d.status === status) &&
      (!license || d.licenseClass === license) &&
      normalize(`${d.name}${d.id}${d.phone}`).includes(normalize(search)),
  );
  const selected =
    filtered.find((d) => d.id === params.get("driver")) ?? filtered[0];
  function updateParam(key: string, value: string): void {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (value) next.set(key, value);
        else next.delete(key);
        if (key !== "driver") next.delete("driver");
        return next;
      },
      { replace: true },
    );
  }
  function saved(driver: OperatorDriver): void {
    client.setQueryData<OperatorDriver[]>(["operator-drivers"], (previous) =>
      previous?.some((d) => d.id === driver.id)
        ? previous.map((d) => (d.id === driver.id ? driver : d))
        : [...(previous ?? []), driver],
    );
    setParams({ driver: driver.id }, { replace: true });
    setNotice("Đã lưu thay đổi trong dữ liệu mock của phiên này.");
    setModal(null);
  }
  const statusMutation = useMutation({
    mutationFn: (d: OperatorDriver) =>
      changeDriverStatus(d.id, d.status === "paused" ? "available" : "paused"),
    onSuccess: saved,
  });
  function open(value: Modal): void {
    statusMutation.reset();
    setModal(value);
  }
  return (
    <div className="operator-schedule operator-drivers">
      <a className="operator-schedule__skip" href="#drivers-main">
        Đến nội dung chính
      </a>
      <OperatorSidebar iconsOverride={NAV_ICONS} />
      <main className="operator-schedule__main" id="drivers-main">
        <header className="operator-schedule__header">
          <h1>Quản lý tài xế</h1>
        </header>
        <section className="operator-drivers__toolbar" aria-label="Lọc tài xế">
          <Input
            label="Tìm kiếm"
            placeholder="Tên, mã hoặc số điện thoại"
            value={search}
            onChange={(e) => updateParam("q", e.target.value)}
          />
          <label className="operator-drivers__select">
            <span>Trạng thái</span>
            <select
              aria-label="Trạng thái"
              value={status}
              onChange={(e) => updateParam("status", e.target.value)}
              style={{ backgroundImage: `url("${chevron}")` }}
            >
              <option value="">Tất cả trạng thái</option>
              {Object.entries(DRIVER_STATUSES).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="operator-drivers__select">
            <span>Giấy phép lái xe</span>
            <select
              aria-label="Giấy phép lái xe"
              value={license}
              onChange={(e) => updateParam("license", e.target.value)}
              style={{ backgroundImage: `url("${chevron}")` }}
            >
              <option value="">Tất cả hạng</option>
              {LICENSE_CLASSES.map((c) => (
                <option key={c} value={c}>
                  Hạng {c}
                </option>
              ))}
            </select>
          </label>
          <Button
            className="operator-drivers__add"
            onClick={() => navigate("/operator/drivers/new")}
          >
            <span>
              <img src={addIcon} width={18} height={18} alt="" />
            </span>
            Thêm tài xế
          </Button>
        </section>
        {notice && (
          <p className="operator-drivers__notice" role="status">
            {notice}
          </p>
        )}
        {query.isPending ? (
          <PageState
            title="Đang tải tài xế"
            description="Vui lòng chờ trong giây lát."
          />
        ) : query.isError ? (
          <PageState
            title="Không tải được danh sách"
            description={query.error.message}
            action={
              <Button onClick={() => void query.refetch()}>Thử lại</Button>
            }
          />
        ) : (
          <div className="operator-drivers__workspace">
            <section
              className="operator-drivers__list"
              aria-labelledby="drivers-list-title"
            >
              <header>
                <h2 id="drivers-list-title">Danh sách tài xế</h2>
                <span>{String(filtered.length).padStart(2, "0")} tài xế</span>
              </header>
              <p>Chọn tài xế để xem và cập nhật hồ sơ.</p>
              {filtered.map((d) => (
                <button
                  type="button"
                  className="operator-drivers__row"
                  key={d.id}
                  aria-pressed={d.id === selected?.id}
                  onClick={() => updateParam("driver", d.id)}
                  aria-label={`${d.name}, ${d.id}`}
                >
                  <span className="operator-drivers__avatar">
                    {d.avatar ? (
                      <DriverPhoto
                        attachment={d.avatar}
                        fallback={initials(d.name)}
                      />
                    ) : (
                      initials(d.name)
                    )}
                  </span>
                  <span className="operator-drivers__identity">
                    <strong>{d.name}</strong>
                    <small>
                      {d.id} / {phoneLabel(d.phone)}
                    </small>
                    <small>Giấy phép hạng {d.licenseClass}</small>
                  </span>
                  <StatusBadge status={d.status} />
                </button>
              ))}
              {!filtered.length && (
                <PageState
                  title="Không có tài xế phù hợp"
                  description="Thử thay đổi từ khóa hoặc bộ lọc."
                  action={
                    <Button variant="secondary" onClick={() => setParams({})}>
                      Xóa bộ lọc
                    </Button>
                  }
                />
              )}
            </section>
            {selected ? (
              <article
                className="operator-drivers__profile"
                aria-label="Hồ sơ tài xế"
              >
                <header className="operator-drivers__profile-heading">
                  <span className="operator-drivers__avatar">
                    {selected.avatar ? (
                      <DriverPhoto
                        attachment={selected.avatar}
                        fallback={initials(selected.name)}
                      />
                    ) : (
                      initials(selected.name)
                    )}
                  </span>
                  <div>
                    <h2>{selected.name}</h2>
                    <p>
                      {selected.id} / Tham gia {dateLabel(selected.joinedAt)}
                    </p>
                  </div>
                  <StatusBadge status={selected.status} />
                </header>
                <section className="operator-drivers__personal">
                  <h3>Thông tin cá nhân</h3>
                  <dl>
                    <Field
                      label="Số điện thoại"
                      value={phoneLabel(selected.phone)}
                    />
                    <Field label="Email" value={selected.email || "—"} />
                    <Field
                      label="Ngày sinh"
                      value={
                        selected.birthDate ? dateLabel(selected.birthDate) : "—"
                      }
                    />
                    <Field label="Địa chỉ" value={selected.address || "—"} />
                  </dl>
                </section>
                <section className="operator-drivers__license">
                  <h3>Giấy phép lái xe</h3>
                  <dl>
                    <Field
                      label="Số giấy phép"
                      value={selected.licenseNumber}
                    />
                    <Field
                      label="Hạng giấy phép"
                      value={selected.licenseClass}
                    />
                    <Field
                      label="Ngày cấp"
                      value={dateLabel(selected.issuedAt)}
                    />
                    <Field
                      label="Ngày hết hạn"
                      value={dateLabel(selected.expiresAt)}
                    />
                  </dl>
                </section>
                <section className="operator-drivers__documents">
                  <h3>Hồ sơ đính kèm</h3>
                  <div>
                    <Button
                      variant="secondary"
                      onClick={() => open({ kind: "front", driver: selected })}
                    >
                      GPLX · Mặt trước
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => open({ kind: "back", driver: selected })}
                    >
                      GPLX · Mặt sau
                    </Button>
                  </div>
                </section>
                {selected.notes && (
                  <section>
                    <h3>Ghi chú nội bộ</h3>
                    <p
                      style={{
                        whiteSpace: "pre-wrap",
                        overflowWrap: "anywhere",
                        fontSize: 13,
                        marginTop: 8,
                      }}
                    >
                      {selected.notes}
                    </p>
                  </section>
                )}
                <footer className="operator-drivers__actions">
                  <Button
                    variant="secondary"
                    onClick={() => open({ kind: "status", driver: selected })}
                  >
                    {selected.status === "paused"
                      ? "Khôi phục hoạt động"
                      : "Tạm ngưng hoạt động"}
                  </Button>
                  <Button
                    onClick={() =>
                      navigate(
                        `/operator/drivers/${encodeURIComponent(selected.id)}/edit`,
                      )
                    }
                  >
                    Chỉnh sửa hồ sơ
                  </Button>
                </footer>
              </article>
            ) : (
              <section className="operator-drivers__profile">
                <PageState
                  title="Chưa chọn tài xế"
                  description="Chọn tài xế trong danh sách để xem hồ sơ."
                />
              </section>
            )}
          </div>
        )}
      </main>
      <Dialog.Root
        open={Boolean(modal)}
        onOpenChange={(value) => {
          if (!value && !statusMutation.isPending) setModal(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="operator-drivers__overlay" />
          <Dialog.Content
            className="operator-drivers__dialog"
            onOpenAutoFocus={() => {
              focusReturn.current =
                document.activeElement instanceof HTMLElement
                  ? document.activeElement
                  : null;
            }}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              focusReturn.current?.focus();
            }}
          >
            <Dialog.Title>
              {modal?.kind === "add"
                ? "Thêm tài xế"
                : modal?.kind === "edit"
                  ? "Chỉnh sửa hồ sơ"
                  : modal?.kind === "status"
                    ? modal.driver.status === "paused"
                      ? "Khôi phục hoạt động"
                      : "Tạm ngưng hoạt động"
                    : `GPLX · Mặt ${modal?.kind === "front" ? "trước" : "sau"}`}
            </Dialog.Title>
            <Dialog.Description>
              {modal?.kind === "add" || modal?.kind === "edit"
                ? "Thông tin được lưu trong dữ liệu mock của phiên hiện tại."
                : modal?.kind === "status"
                  ? `${modal.driver.name} · ${modal.driver.id}`
                  : "Tài liệu đính kèm của tài xế."}
            </Dialog.Description>
            {modal?.kind === "add" || modal?.kind === "edit" ? (
              <DriverForm
                driver={modal.kind === "edit" ? modal.driver : undefined}
                saved={saved}
                cancel={() => setModal(null)}
              />
            ) : modal?.kind === "status" ? (
              <>
                <p>
                  {modal.driver.status === "running"
                    ? "Tài xế đang chạy chuyến, chưa thể tạm ngưng hoạt động."
                    : modal.driver.status === "paused"
                      ? "Xác nhận chuyển tài xế về trạng thái Sẵn sàng?"
                      : "Xác nhận chuyển tài xế về trạng thái Tạm nghỉ?"}
                </p>
                {statusMutation.error && (
                  <p role="alert">{statusMutation.error.message}</p>
                )}
                <footer>
                  <Button
                    variant="secondary"
                    onClick={() => setModal(null)}
                    disabled={statusMutation.isPending}
                  >
                    Hủy
                  </Button>
                  {modal.driver.status !== "running" && (
                    <Button
                      onClick={() => statusMutation.mutate(modal.driver)}
                      isLoading={statusMutation.isPending}
                    >
                      Xác nhận
                    </Button>
                  )}
                </footer>
              </>
            ) : (
              modal && (
                <>
                  <p>
                    {modal.driver.name} · {modal.driver.licenseNumber}
                  </p>
                  <DriverDocument
                    attachment={
                      modal.kind === "front"
                        ? modal.driver.licenseFront
                        : modal.driver.licenseBack
                    }
                  />
                </>
              )
            )}
            <Dialog.Close asChild>
              <Button
                variant="ghost"
                className="operator-drivers__close"
                aria-label="Đóng"
                disabled={statusMutation.isPending}
              >
                ×
              </Button>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
