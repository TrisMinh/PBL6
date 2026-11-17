import { useRef, useState, type ReactElement } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/shared/ui/Button/Button";
import { OperatorInput as Input } from "../components/OperatorInput";
import { ApiFailure } from "@/shared/api/ResourcePage";
import { liveApiJson, liveQueryKey } from "@/shared/api/liveRequest";
import { shortId } from "@/shared/api/livePresentation";
import {
  driverDate,
  getLiveDrivers,
  liveDriverSchema,
  type LiveDriver,
} from "./liveDrivers";
import photoIcon from "@/assets/operator/drivers/add/imgFrame8.svg";
import "./DriversPage.css";
import "./AddDriverPage.css";
import "./LiveDrivers.css";

const inputSchema = z.object({
  userId: z.uuid(),
  licenseNumber: z
    .string()
    .trim()
    .regex(/^\d{12}$/),
  licenseExpiresOn: z.iso.date(),
});
function DriverForm({ driver }: { driver?: LiveDriver }): ReactElement {
  const navigate = useNavigate();
  const client = useQueryClient();
  const saved = useRef(driver);
  const [userId, setUserId] = useState(driver?.userId ?? "");
  const [licenseNumber, setLicenseNumber] = useState(
    driver?.licenseNumber ?? "",
  );
  const [licenseExpiresOn, setExpires] = useState(
    driver?.licenseExpiresOn.slice(0, 10) ?? "",
  );
  const [status, setStatus] = useState(
    driver?.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
  );
  const [partiallySaved, setPartiallySaved] = useState(false);
  const valid = inputSchema.safeParse({
    userId,
    licenseNumber,
    licenseExpiresOn,
  }).success;
  const back = driver
    ? `/operator/drivers?driver=${driver.id}`
    : "/operator/drivers";
  const mutation = useMutation({
    mutationFn: async () => {
      const parsed = inputSchema.safeParse({
        userId,
        licenseNumber,
        licenseExpiresOn,
      });
      if (!parsed.success)
        throw Error(
          "Nhập ID tài khoản hợp lệ, số GPLX 12 chữ số và ngày hết hạn.",
        );
      const previous = saved.current;
      const existing = await getLiveDrivers();
      if (
        existing.some(
          (item) =>
            item.id !== previous?.id && item.userId === parsed.data.userId,
        )
      )
        throw Error(
          "Tài khoản này đã có hồ sơ tài xế. Hãy chỉnh sửa hồ sơ hiện có.",
        );
      if (
        existing.some(
          (item) =>
            item.id !== previous?.id &&
            item.licenseNumber === parsed.data.licenseNumber,
        )
      )
        throw Error("Số giấy phép này đã có trong danh sách tài xế.");
      const result = await liveApiJson(
        previous
          ? `/api/v1/operator/drivers/${previous.id}`
          : "/api/v1/operator/drivers",
        liveDriverSchema,
        {
          method: previous ? "PATCH" : "POST",
          body: {
            ...parsed.data,
            expectedVersion: previous?.expectedVersion ?? 0,
          },
          idempotent: true,
        },
      );
      saved.current = result;
      setPartiallySaved(true);
      if (status === "INACTIVE" && result.status !== "INACTIVE")
        await liveApiJson(
          `/api/v1/operator/drivers/${result.id}/deactivate`,
          z.unknown(),
          { method: "POST", idempotent: true },
        );
      return result;
    },
    onSuccess: async (result) => {
      await client.invalidateQueries({ queryKey: ["live-api"] });
      if (status === "INACTIVE")
        void navigate("/operator/drivers", {
          state: {
            driverNotice:
              "Đã lưu hồ sơ và ngừng hoạt động tài xế. Hồ sơ đã được ẩn khỏi danh sách.",
          },
        });
      else void navigate(`/operator/drivers?driver=${result.id}`);
    },
    onMutate: () => setPartiallySaved(false),
    retry: false,
  });
  const unsupported = (
    label: string,
    value?: string | null,
    type = "text",
  ): ReactElement => (
    <Input
      label={label}
      type={type}
      disabled
      value={value ?? ""}
      placeholder="Chưa có dữ liệu"
    />
  );
  return (
    <div className="operator-drivers driver-add live-drivers live-driver-form">
      <header className="live-drivers__heading">
        <h1>{driver ? "Chỉnh sửa hồ sơ tài xế" : "Thêm tài xế"}</h1>
      </header>
      <div className="driver-add__intro">
        <Link className="live-drivers__secondary" to={back}>
          ← Quay lại
        </Link>
        <p>
          {driver
            ? `${shortId(driver.id)} / Cập nhật thông tin và hồ sơ tài xế.`
            : "Tạo hồ sơ tài xế mới. Các trường có * là bắt buộc."}
        </p>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate();
        }}
      >
        <fieldset className="driver-add__layout" disabled={mutation.isPending}>
          <legend className="driver-add__sr-only">
            Thông tin hồ sơ tài xế
          </legend>
          <div className="driver-add__main">
            <section className="driver-add__card driver-add__personal">
              <h2>Thông tin cá nhân</h2>
              <div className="driver-add__fields">
                {unsupported("Họ và tên", driver?.fullName)}
                {unsupported("Số điện thoại", driver?.phone, "tel")}
                {unsupported("Ngày sinh", driverDate(driver?.birthDate))}
                {unsupported("Email", driver?.email, "email")}
                <div className="driver-add__wide">
                  {unsupported("Địa chỉ liên hệ", driver?.address)}
                </div>
                <div className="driver-add__wide">
                  <Input
                    label="Tài khoản liên kết (ID) *"
                    required
                    aria-label="Tài khoản liên kết"
                    value={userId}
                    onChange={(event) => {
                      setUserId(event.target.value.trim());
                      mutation.reset();
                    }}
                    placeholder="ID tài khoản tài xế đã có"
                  />
                </div>
              </div>
              <p className="live-drivers__muted">
                Thông tin cá nhân chưa được hỗ trợ cập nhật tại đây.
              </p>
            </section>
            <section className="driver-add__card driver-add__license">
              <h2>Giấy phép lái xe</h2>
              <div className="driver-add__fields">
                <Input
                  label="Số giấy phép *"
                  required
                  aria-label="Số giấy phép"
                  inputMode="numeric"
                  maxLength={12}
                  value={licenseNumber}
                  onChange={(event) => {
                    setLicenseNumber(event.target.value);
                    mutation.reset();
                  }}
                  placeholder="Nhập số giấy phép"
                />
                {unsupported("Hạng giấy phép", driver?.licenseClass)}
                {unsupported("Ngày cấp", driverDate(driver?.licenseIssuedOn))}
                <Input
                  label="Ngày hết hạn *"
                  required
                  aria-label="Ngày hết hạn"
                  type="date"
                  value={licenseExpiresOn}
                  onChange={(event) => {
                    setExpires(event.target.value);
                    mutation.reset();
                  }}
                />
              </div>
            </section>
            <section className="driver-add__notes">
              <label htmlFor="live-driver-notes">Ghi chú nội bộ</label>
              <textarea
                id="live-driver-notes"
                disabled
                value={driver?.notes ?? ""}
                placeholder="Chưa hỗ trợ lưu ghi chú nội bộ."
              />
            </section>
          </div>
          <aside
            className="driver-add__aside"
            aria-label="Ảnh và trạng thái hồ sơ"
          >
            <section className="driver-add__card driver-add__avatar">
              <h2>Ảnh đại diện</h2>
              <div className="driver-add__photo-row">
                <span className="driver-add__photo">
                  <img src={photoIcon} width={28} height={28} alt="" />
                </span>
                <Button type="button" variant="secondary" disabled>
                  Tải ảnh lên
                </Button>
              </div>
              <p className="live-drivers__muted">
                Chưa hỗ trợ lưu ảnh đại diện.
              </p>
            </section>
            <section className="driver-add__card driver-add__documents">
              <h2>Ảnh giấy phép lái xe</h2>
              {["Mặt trước giấy phép", "Mặt sau giấy phép"].map((label) => (
                <div className="driver-add__document-control" key={label}>
                  <button className="driver-add__drop" type="button" disabled>
                    <strong>{label}</strong>
                    <span>Chưa hỗ trợ lưu tệp</span>
                    <small>Chưa có tài liệu đính kèm</small>
                  </button>
                </div>
              ))}
            </section>
            <section className="driver-add__card driver-add__status">
              <h2>Trạng thái hồ sơ</h2>
              <label className="field">
                <span className="field__label">Trạng thái</span>
                <select
                  className="field__control"
                  aria-label="Trạng thái hồ sơ"
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                >
                  <option
                    value="ACTIVE"
                    disabled={driver?.status === "INACTIVE"}
                  >
                    Đang hoạt động
                  </option>
                  <option value="INACTIVE">Ngừng hoạt động</option>
                </select>
              </label>
              <p>
                Phân công tài xế theo từng chuyến đi, không gắn cố định với một
                xe.
              </p>
              {status === "INACTIVE" && (
                <p>
                  Hồ sơ ngừng hoạt động sẽ được ẩn khỏi danh sách sau khi lưu.
                </p>
              )}
            </section>
          </aside>
        </fieldset>
        {mutation.isError && (
          <>
            <ApiFailure error={mutation.error} />
            {partiallySaved && (
              <p className="live-drivers__muted">
                Hồ sơ đã được lưu. Bấm lưu lại để hoàn tất cập nhật trạng thái.
              </p>
            )}
          </>
        )}
        <footer className="driver-add__footer">
          <Link className="live-drivers__secondary" to={back}>
            Hủy
          </Link>
          <Button
            type="submit"
            disabled={!valid}
            isLoading={mutation.isPending}
          >
            {driver ? "Lưu thay đổi" : "Lưu tài xế"}
          </Button>
        </footer>
      </form>
    </div>
  );
}
export function LiveDriverEditorPage({
  edit = false,
}: {
  edit?: boolean;
}): ReactElement {
  const { driverId } = useParams();
  const query = useQuery({
    queryKey: liveQueryKey("operator-drivers"),
    queryFn: ({ signal }) => getLiveDrivers(signal),
    enabled: edit,
  });
  if (!edit) return <DriverForm />;
  if (query.isPending)
    return (
      <p className="live-drivers__loading" role="status">
        Đang tải hồ sơ tài xế…
      </p>
    );
  if (query.isError) return <ApiFailure error={query.error} />;
  const driver = query.data.find((driver) => driver.id === driverId);
  return driver ? (
    <DriverForm key={driver.id} driver={driver} />
  ) : (
    <p>
      Không tìm thấy tài xế.{" "}
      <Link to="/operator/drivers">Quay lại danh sách</Link>
    </p>
  );
}
