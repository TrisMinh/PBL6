import { OperatorStatusBadge } from "../components/OperatorStatusBadge";
import { Toast } from "@/shared/ui/Toast/Toast";
import { useState, type ReactElement } from "react";
import { Link, useSearchParams, useLocation } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/shared/ui/Button/Button";
import { Input } from "@/shared/ui/Input/Input";
import { ApiFailure } from "@/shared/api/ResourcePage";
import {
  getLiveRows,
  liveApiJson,
  liveQueryKey,
} from "@/shared/api/liveRequest";
import { normalizeSearch, shortId } from "@/shared/api/livePresentation";
import { getVietnamTodayDate } from "@/shared/lib/getVietnamTodayDate";
import {
  driverDate,
  driverInitials,
  driverName,
  driverState,
  getLiveDrivers,
  liveDriverSchema,
  type LiveDriver,
} from "./liveDrivers";
import addIcon from "@/assets/operator/drivers/imgIconUserPlus.svg";
import "./DriversPage.css";
import "./LiveDrivers.css";

function DriverBadge({ state }: { state: string }): ReactElement {
  return (
    <OperatorStatusBadge
      state={
        state === "Đang chạy"
          ? "running"
          : state === "Đang hoạt động"
            ? "active"
            : "inactive"
      }
    >
      {state}
    </OperatorStatusBadge>
  );
}
function Value({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}): ReactElement {
  return (
    <div className="operator-drivers__value">
      <dt>{label}</dt>
      <dd>{value || "—"}</dd>
    </div>
  );
}
function DriverProfile({
  driver,
  state,
  onDeactivated,
}: {
  driver: LiveDriver;
  state: string;
  onDeactivated: () => void;
}): ReactElement {
  const client = useQueryClient();
  const deactivate = useMutation({
    mutationFn: () =>
      liveApiJson(
        `/api/v1/operator/drivers/${driver.id}/deactivate`,
        liveDriverSchema,
        { method: "POST", idempotent: true },
      ),
    onMutate: () =>
      client.cancelQueries({ queryKey: liveQueryKey("operator-drivers") }),
    onSuccess: (updated) => {
      client.setQueryData<LiveDriver[]>(
        liveQueryKey("operator-drivers"),
        (previous) => previous?.filter((item) => item.id !== updated.id),
      );
      onDeactivated();
      return client.invalidateQueries({
        queryKey: liveQueryKey("operator-drivers"),
      });
    },
    retry: false,
  });
  return (
    <section className="operator-drivers__profile" aria-label="Hồ sơ tài xế">
      <header className="operator-drivers__profile-heading">
        <span className="operator-drivers__avatar" aria-hidden="true">
          {driverInitials(driver)}
        </span>
        <div>
          <h2>{driverName(driver)}</h2>
          <p>{shortId(driver.id)}</p>
        </div>
        <DriverBadge state={state} />
      </header>
      <section className="operator-drivers__personal">
        <h3>Thông tin cá nhân</h3>
        <dl>
          <Value label="Số điện thoại" value={driver.phone} />
          <Value label="Email" value={driver.email} />
          <Value label="Ngày sinh" value={driverDate(driver.birthDate)} />
          <Value label="Địa chỉ" value={driver.address} />
        </dl>
      </section>
      <section className="operator-drivers__license">
        <h3>Giấy phép lái xe</h3>
        <dl>
          <Value label="Số giấy phép" value={driver.licenseNumber} />
          <Value label="Hạng giấy phép" value={driver.licenseClass} />
          <Value label="Ngày cấp" value={driverDate(driver.licenseIssuedOn)} />
          <Value
            label="Ngày hết hạn"
            value={driverDate(driver.licenseExpiresOn)}
          />
        </dl>
      </section>
      <section className="operator-drivers__documents">
        <h3>Hồ sơ đính kèm</h3>
        <div>
          <Button type="button" variant="secondary" disabled>
            GPLX · Mặt trước
          </Button>
          <Button type="button" variant="secondary" disabled>
            GPLX · Mặt sau
          </Button>
        </div>
        <p className="live-drivers__muted">Chưa hỗ trợ lưu ảnh hồ sơ.</p>
      </section>
      <div className="operator-drivers__actions">
        {driver.status === "ACTIVE" && (
          <Button
            type="button"
            variant="secondary"
            isLoading={deactivate.isPending}
            onClick={() => {
              if (
                window.confirm(
                  "Ngừng hoạt động tài xế? Hồ sơ sẽ được ẩn khỏi danh sách.",
                )
              )
                deactivate.mutate();
            }}
          >
            Ngừng hoạt động
          </Button>
        )}
        <Link
          className="live-drivers__primary"
          to={`/operator/drivers/${driver.id}/edit`}
        >
          Chỉnh sửa hồ sơ
        </Link>
      </div>
      {deactivate.isError && <ApiFailure error={deactivate.error} />}
    </section>
  );
}
export function LiveDriversPage(): ReactElement {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const [notice, setNotice] = useState(() =>
    typeof location.state?.driverNotice === "string"
      ? location.state.driverNotice
      : "",
  );
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [license, setLicense] = useState("");
  const [today] = useState(getVietnamTodayDate);
  const drivers = useQuery({
    queryKey: liveQueryKey("operator-drivers"),
    queryFn: ({ signal }) => getLiveDrivers(signal),
  });
  const trips = useQuery({
    queryKey: liveQueryKey("operator-driver-trips"),
    queryFn: ({ signal }) => getLiveRows("/api/v1/operator/trips", signal),
    refetchInterval: 60_000,
  });
  const running = new Set(
    trips.data
      ?.filter((trip) =>
        ["DEPARTED", "IN_TRANSIT"].includes(String(trip.status)),
      )
      .map((trip) => trip.driverId),
  );
  const rows =
    drivers.data?.filter(
      (driver) =>
        normalizeSearch(
          `${driverName(driver)} ${driver.licenseNumber} ${driver.phone ?? ""} ${driver.id}`,
        ).includes(normalizeSearch(search)) &&
        (!status ||
          driverState(driver, today, running.has(driver.id)) === status) &&
        (!license || driver.licenseClass === license),
    ) ?? [];
  const selected =
    rows.find((driver) => driver.id === params.get("driver")) ?? rows[0];
  const classes = [
    ...new Set(
      drivers.data
        ?.map((driver) => driver.licenseClass)
        .filter((value): value is string => !!value),
    ),
  ];
  return (
    <div className="operator-drivers live-drivers">
      <header className="live-drivers__heading">
        <h1>Quản lý tài xế</h1>
      </header>
      <div className="operator-drivers__toolbar">
        <Input
          label="Tìm kiếm"
          aria-label="Tìm tài xế"
          placeholder="GPLX, mã hoặc thông tin tài xế"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <label className="operator-drivers__select">
          <span>Trạng thái</span>
          <select
            aria-label="Trạng thái"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">Tất cả trạng thái</option>
            {["Đang hoạt động", "Đang chạy", "Tạm ngừng", "GPLX hết hạn"].map(
              (value) => (
                <option key={value}>{value}</option>
              ),
            )}
          </select>
        </label>
        <label className="operator-drivers__select">
          <span>Giấy phép lái xe</span>
          <select
            aria-label="Giấy phép lái xe"
            value={license}
            disabled={!classes.length}
            onChange={(event) => setLicense(event.target.value)}
          >
            <option value="">
              {classes.length ? "Tất cả hạng" : "Chưa có dữ liệu hạng"}
            </option>
            {classes.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <Link
          className="live-drivers__primary operator-drivers__add"
          to="/operator/drivers/new"
        >
          <span>
            <img src={addIcon} width={18} height={18} alt="" />
          </span>
          Thêm tài xế
        </Link>
      </div>
      {notice && <Toast message={notice} onClose={() => setNotice("")} />}
      {drivers.isPending ? (
        <p className="live-drivers__loading" role="status">
          Đang tải tài xế…
        </p>
      ) : drivers.isError ? (
        <ApiFailure error={drivers.error} />
      ) : (
        <div className="operator-drivers__workspace">
          <section className="operator-drivers__list">
            <header>
              <h2>Danh sách tài xế</h2>
              <span>{rows.length} tài xế</span>
            </header>
            <p>Chọn tài xế để xem và cập nhật hồ sơ.</p>
            {rows.map((driver) => (
              <button
                className="operator-drivers__row"
                type="button"
                key={driver.id}
                aria-pressed={driver.id === selected?.id}
                onClick={() =>
                  setParams({ driver: driver.id }, { replace: true })
                }
              >
                <span className="operator-drivers__avatar" aria-hidden="true">
                  {driverInitials(driver)}
                </span>
                <span className="operator-drivers__identity">
                  <strong>{driverName(driver)}</strong>
                  <small>
                    {shortId(driver.id)}
                    {driver.phone ? ` / ${driver.phone}` : ""}
                  </small>
                  <small>
                    {driver.licenseClass
                      ? `Giấy phép hạng ${driver.licenseClass}`
                      : "Chưa có thông tin hạng GPLX"}
                  </small>
                </span>
                <DriverBadge
                  state={driverState(driver, today, running.has(driver.id))}
                />
              </button>
            ))}
            {!rows.length && <p>Không tìm thấy tài xế phù hợp.</p>}
          </section>
          {selected && (
            <DriverProfile
              key={selected.id}
              driver={selected}
              state={driverState(selected, today, running.has(selected.id))}
              onDeactivated={() => {
                setNotice(
                  "Đã ngừng hoạt động tài xế. Hồ sơ đã được ẩn khỏi danh sách.",
                );
                setParams({}, { replace: true });
              }}
            />
          )}
        </div>
      )}
      {trips.isError && <ApiFailure error={trips.error} />}
    </div>
  );
}
