import { useState, type FormEvent, type ReactElement } from "react";
import { useNavigate } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { OperatorSidebar } from "../components/OperatorSidebar";
import { Button } from "@/shared/ui/Button/Button";
import { Input } from "@/shared/ui/Input/Input";
import {
  createDriverSchema,
  updateDriverSchema,
  type DriverStatus,
  LICENSE_CLASSES,
  type DriverAttachment,
  type OperatorDriver,
} from "./drivers.schema";
import { createDriver, updateDriverProfile } from "./driversRepository";
import { storeDriverFile, deleteDriverFile } from "./driverFiles";
import { DriverUpload } from "./DriverUpload";
import navTrips from "@/assets/operator/drivers/add/imgFrame.svg";
import navBookings from "@/assets/operator/drivers/add/imgFrame1.svg";
import navRoutes from "@/assets/operator/drivers/add/imgFrame2.svg";
import navVehicles from "@/assets/operator/drivers/add/imgFrame3.svg";
import navDrivers from "@/assets/operator/drivers/add/imgFrame4.svg";
import navReports from "@/assets/operator/drivers/add/imgFrame5.svg";
import navMembers from "@/assets/operator/drivers/add/imgFrame6.svg";
import navCancel from "@/assets/operator/drivers/add/imgFrame7.svg";
import chevron from "@/assets/operator/drivers/add/imgIconChevronDown.svg";
import "../schedule/SchedulePage.css";
import "./DriversPage.css";
import "./AddDriverPage.css";

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
type FileSlot = "avatar" | "licenseFront" | "licenseBack";
const initial = {
  name: "",
  phone: "",
  birthDate: "",
  email: "",
  address: "",
  licenseNumber: "",
  licenseClass: "",
  issuedAt: "",
  expiresAt: "",
};
type FormKey = keyof typeof initial;
function driverDateInput(value: string): string {
  if (!value || /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const match = /^(\d{2})\s*\/\s*(\d{2})\s*\/\s*(\d{4})$/.exec(value.trim());
  return match ? `${match[3]}-${match[2]}-${match[1]}` : value;
}
export function DriverEditor({
  driver,
}: {
  driver?: OperatorDriver;
}): ReactElement {
  const navigate = useNavigate(),
    client = useQueryClient();
  const [values, setValues] = useState(() =>
      driver
        ? {
            name: driver.name,
            phone: driver.phone.replace(/^(\d{4})(\d{3})(\d{3})$/, "$1 $2 $3"),
            birthDate: driver.birthDate.split("-").reverse().join(" / "),
            email: driver.email,
            address: driver.address,
            licenseNumber: driver.licenseNumber,
            licenseClass: driver.licenseClass,
            issuedAt: driver.issuedAt.split("-").reverse().join(" / "),
            expiresAt: driver.expiresAt.split("-").reverse().join(" / "),
          }
        : initial,
    ),
    [touched, setTouched] = useState<Partial<Record<FormKey, boolean>>>({});
  const [notes, setNotes] = useState(driver?.notes ?? ""),
    [status, setStatus] = useState<DriverStatus>(driver?.status ?? "available");
  const [files, setFiles] = useState<Partial<Record<FileSlot, File | null>>>(
      {},
    ),
    [busyFiles, setBusyFiles] = useState<Partial<Record<FileSlot, boolean>>>(
      {},
    );
  const parsed = (driver ? updateDriverSchema : createDriverSchema).safeParse({
    ...values,
    birthDate: driverDateInput(values.birthDate),
    issuedAt: driverDateInput(values.issuedAt),
    expiresAt: driverDateInput(values.expiresAt),
    notes,
    status,
  });
  const errors: Record<string, string> = parsed.success
    ? {}
    : Object.fromEntries(
        [...parsed.error.issues]
          .reverse()
          .map((e) => [String(e.path[0]), e.message]),
      );
  const mutation = useMutation({
    mutationFn: async () => {
      if (!parsed.success) throw Error("Vui lòng kiểm tra thông tin bắt buộc.");
      const stored: Partial<Record<FileSlot, DriverAttachment>> = {};
      const removed: Partial<Record<FileSlot, null>> = {};
      try {
        for (const slot of ["avatar", "licenseFront", "licenseBack"] as const) {
          const file = files[slot];
          if (file === null && driver) removed[slot] = null;
          if (file)
            stored[slot] = await storeDriverFile(file, slot === "avatar");
        }
        return driver
          ? await updateDriverProfile(
              driver.id,
              updateDriverSchema.parse({
                ...parsed.data,
                ...stored,
                ...removed,
              }),
            )
          : await createDriver(
              createDriverSchema.parse({ ...parsed.data, ...stored }),
            );
      } catch (error) {
        await Promise.allSettled(
          Object.values(stored).map((file) => deleteDriverFile(file.id)),
        );
        throw error;
      }
    },
    onSuccess: (driver) => {
      client.setQueryData<OperatorDriver[]>(["operator-drivers"], (previous) =>
        previous?.some((d) => d.id === driver.id)
          ? previous.map((d) => (d.id === driver.id ? driver : d))
          : [...(previous ?? []), driver],
      );
      void client.invalidateQueries({ queryKey: ["operator-drivers"] });
      navigate(`/operator/drivers?driver=${encodeURIComponent(driver.id)}`);
    },
  });
  function field(
    key: FormKey,
    label: string,
    placeholder: string,
    extra: {
      type?: string;
      maxLength?: number;
      inputMode?: "numeric" | "tel";
    } = {},
  ): ReactElement {
    return (
      <Input
        label={label}
        placeholder={placeholder}
        name={key}
        value={values[key]}
        required={label.endsWith("*")}
        type={extra.type ?? "text"}
        inputMode={extra.inputMode}
        maxLength={extra.maxLength ?? 100}
        onChange={(e) => {
          setValues((previous) => ({ ...previous, [key]: e.target.value }));
          mutation.reset();
        }}
        onBlur={() => setTouched((previous) => ({ ...previous, [key]: true }))}
        error={touched[key] ? errors[key] : undefined}
      />
    );
  }
  function upload(slot: FileSlot, label: string): ReactElement {
    return (
      <DriverUpload
        avatar={slot === "avatar"}
        label={label}
        file={files[slot] ?? undefined}
        existing={files[slot] === undefined ? driver?.[slot] : undefined}
        referenceName={
          driver?.id === "TX-001" &&
          slot !== "avatar" &&
          files[slot] === undefined &&
          !driver[slot]
            ? slot === "licenseFront"
              ? "gplx_mat_truoc.jpg"
              : "gplx_mat_sau.jpg"
            : undefined
        }
        onChange={(file) =>
          setFiles((previous) => ({ ...previous, [slot]: file ?? null }))
        }
        onBusy={(busy) =>
          setBusyFiles((previous) => ({ ...previous, [slot]: busy }))
        }
      />
    );
  }
  function submit(event: FormEvent): void {
    event.preventDefault();
    if (parsed.success && !Object.values(busyFiles).some(Boolean))
      mutation.mutate();
  }
  const back = (): void => {
    if (!mutation.isPending)
      navigate(
        driver
          ? `/operator/drivers?driver=${encodeURIComponent(driver.id)}`
          : "/operator/drivers",
      );
  };
  return (
    <div className="operator-schedule operator-drivers driver-add">
      <a className="operator-schedule__skip" href="#add-driver-main">
        Đến nội dung chính
      </a>
      <OperatorSidebar iconsOverride={NAV_ICONS} />
      <main className="operator-schedule__main" id="add-driver-main">
        <header className="operator-schedule__header">
          <h1>{driver ? "Chỉnh sửa hồ sơ tài xế" : "Thêm tài xế"}</h1>
        </header>
        <div className="driver-add__intro">
          <Button
            type="button"
            variant="secondary"
            onClick={back}
            disabled={mutation.isPending}
          >
            ← Quay lại
          </Button>
          <p>
            {driver
              ? `${driver.id} / Cập nhật thông tin và hồ sơ tài xế.`
              : "Tạo hồ sơ tài xế mới. Các trường có * là bắt buộc."}
          </p>
        </div>
        <form noValidate onSubmit={submit}>
          <fieldset
            className="driver-add__layout"
            disabled={mutation.isPending}
          >
            <legend className="driver-add__sr-only">
              Thông tin hồ sơ tài xế
            </legend>
            <div className="driver-add__main">
              <section
                className="driver-add__card driver-add__personal"
                aria-labelledby="personal-title"
              >
                <h2 id="personal-title">Thông tin cá nhân</h2>
                <div className="driver-add__fields">
                  {field("name", "Họ và tên *", "Nhập họ và tên", {
                    maxLength: 80,
                  })}
                  {field("phone", "Số điện thoại *", "Nhập số điện thoại", {
                    type: "tel",
                    inputMode: "tel",
                    maxLength: 16,
                  })}
                  {field("birthDate", "Ngày sinh", "DD / MM / YYYY", {
                    inputMode: "numeric",
                    maxLength: 14,
                  })}
                  {field("email", "Email", "Nhập email", { type: "email" })}
                  <div className="driver-add__wide">
                    {field(
                      "address",
                      "Địa chỉ liên hệ",
                      "Số nhà, đường, phường / xã, tỉnh / thành phố",
                      { maxLength: 200 },
                    )}
                  </div>
                </div>
              </section>
              <section
                className="driver-add__card driver-add__license"
                aria-labelledby="license-title"
              >
                <h2 id="license-title">Giấy phép lái xe</h2>
                <div className="driver-add__fields">
                  {field(
                    "licenseNumber",
                    "Số giấy phép *",
                    "Nhập số giấy phép",
                    { inputMode: "numeric", maxLength: 12 },
                  )}
                  <div className="field">
                    <label
                      className="field__label"
                      htmlFor="driver-license-class"
                    >
                      Hạng giấy phép *
                    </label>
                    <select
                      id="driver-license-class"
                      name="licenseClass"
                      className="field__control"
                      value={values.licenseClass}
                      required
                      onChange={(e) =>
                        setValues((previous) => ({
                          ...previous,
                          licenseClass: e.target.value,
                        }))
                      }
                      onBlur={() =>
                        setTouched((previous) => ({
                          ...previous,
                          licenseClass: true,
                        }))
                      }
                      style={{ backgroundImage: `url("${chevron}")` }}
                      aria-invalid={Boolean(
                        touched.licenseClass && errors.licenseClass,
                      )}
                      aria-describedby={
                        touched.licenseClass && errors.licenseClass
                          ? "license-class-error"
                          : undefined
                      }
                    >
                      <option value="">Chọn hạng giấy phép</option>
                      {LICENSE_CLASSES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    {touched.licenseClass && errors.licenseClass && (
                      <p
                        id="license-class-error"
                        className="field__error"
                        role="alert"
                      >
                        {errors.licenseClass}
                      </p>
                    )}
                  </div>
                  {field("issuedAt", "Ngày cấp *", "DD / MM / YYYY", {
                    inputMode: "numeric",
                    maxLength: 14,
                  })}
                  {field("expiresAt", "Ngày hết hạn *", "DD / MM / YYYY", {
                    inputMode: "numeric",
                    maxLength: 14,
                  })}
                </div>
              </section>
              <section className="driver-add__notes">
                <label htmlFor="driver-notes">Ghi chú nội bộ</label>
                <textarea
                  id="driver-notes"
                  maxLength={1000}
                  placeholder="Kinh nghiệm, tuyến đường quen thuộc hoặc lưu ý khác…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </section>
            </div>
            <aside
              className="driver-add__aside"
              aria-label="Ảnh và trạng thái hồ sơ"
            >
              <section className="driver-add__card driver-add__avatar">
                <h2>Ảnh đại diện</h2>
                {upload("avatar", "Ảnh đại diện")}
              </section>
              <section className="driver-add__card driver-add__documents">
                <h2>Ảnh giấy phép lái xe</h2>
                {upload("licenseFront", "Mặt trước giấy phép")}
                {upload("licenseBack", "Mặt sau giấy phép")}
              </section>
              <section className="driver-add__card driver-add__status">
                <h2>Trạng thái hồ sơ</h2>
                <div className="field">
                  <label className="field__label" htmlFor="driver-status">
                    Trạng thái
                  </label>
                  <select
                    id="driver-status"
                    name="status"
                    className="field__control"
                    value={status}
                    disabled={driver?.status === "running"}
                    onChange={(e) =>
                      setStatus(
                        e.target.value === "paused" ? "paused" : "available",
                      )
                    }
                    style={{ backgroundImage: `url("${chevron}")` }}
                  >
                    {driver?.status === "running" && (
                      <option value="running">Đang chạy chuyến</option>
                    )}
                    <option value="available">Đang hoạt động</option>
                    <option value="paused">Tạm nghỉ</option>
                  </select>
                </div>
                <p>
                  Phân công tài xế theo từng chuyến đi,
                  <br />
                  không gắn cố định với một xe.
                </p>
              </section>
            </aside>
          </fieldset>
          {mutation.error && (
            <p className="driver-add__save-error" role="alert">
              {mutation.error.message}
            </p>
          )}
          <footer className="driver-add__footer">
            <Button
              type="button"
              variant="secondary"
              onClick={back}
              disabled={mutation.isPending}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              disabled={
                !parsed.success || Object.values(busyFiles).some(Boolean)
              }
              isLoading={mutation.isPending}
            >
              {driver ? "Lưu thay đổi" : "Lưu tài xế"}
            </Button>
          </footer>
        </form>
      </main>
    </div>
  );
}
