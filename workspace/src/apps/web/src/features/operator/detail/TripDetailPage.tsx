import { useState, type ReactElement, type FormEvent } from "react";
import { Link, useParams } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/shared/ui/Button/Button";
import { PageState } from "@/shared/ui/PageState/PageState";
import { OperatorSidebar } from "../components/OperatorSidebar";
import { readTrip, updateTrip } from "./detailRepository";
import { tripEditSchema, type TripDetail } from "./detail.schema";
import "../schedule/SchedulePage.css";
import "../create/CreateTripPage.css";
import "./TripDetailPage.css";
import swap from "@/assets/operator/detail/imgIconSwap.svg";
import pin from "@/assets/operator/detail/imgIconPin.svg";
import plus from "@/assets/operator/detail/imgIconPlus.svg";

function DetailField({
  label,
  value,
  onChange,
  options,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options?: string[];
  type?: string;
}): ReactElement {
  return (
    <label className="operator-create__field">
      <span>{label}</span>
      {options ? (
        <select
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          {options.map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      ) : (
        <input
          aria-label={label}
          type={type}
          value={value}
          required
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  );
}
function DetailContent({ trip }: { trip: TripDetail }): ReactElement {
  const [draft, setDraft] = useState(trip);
  const [search, setSearch] = useState("");
  const [waiting, setWaiting] = useState(false);
  const [full, setFull] = useState(false);
  const [message, setMessage] = useState("");
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: (data: unknown) => updateTrip(trip.id, data),
    onSuccess: (data) => {
      client.setQueryData(["operator", "detail", trip.id], data);
      void client.invalidateQueries({
        queryKey: ["operator", "schedule-preview"],
      });
      setMessage("Đã lưu thay đổi trong môi trường mô phỏng.");
    },
    onError: () =>
      setMessage("Không lưu được thay đổi. Dữ liệu nhập được giữ lại."),
  });
  const change = (key: keyof TripDetail, value: string): void => {
    setDraft((old) => ({ ...old, [key]: value }));
    setMessage("Có thay đổi chưa lưu");
  };
  const submit = (e: FormEvent): void => {
    e.preventDefault();
    const data = {
      origin: draft.origin,
      destination: draft.destination,
      date: draft.date,
      departure: draft.departure,
      vehicle: draft.vehicle,
      driver: draft.driver,
      assistant: draft.assistant,
      pickup: draft.pickup,
      dropoff: draft.dropoff,
      note: draft.note,
    };
    const result = tripEditSchema.safeParse(data);
    if (!result.success) {
      setMessage(result.error.issues.map((i) => i.message).join(" "));
      return;
    }
    mutation.mutate(result.data);
  };
  const normalize = (s: string): string =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/đ/g, "d")
      .replace(/\s/g, "");
  const filtered = trip.passengerList.filter(
    (p) =>
      (!waiting || !p.confirmed) &&
      normalize(p.name + p.phone).includes(normalize(search)),
  );
  const ready =
    draft.vehicle !== "Chưa phân công" && draft.driver !== "Chưa phân công";
  return (
    <>
      <header className="operator-schedule__header">
        <h1>Chi tiết chuyến {trip.id}</h1>
        <Link className="operator-create__back" to="/operator/trips">
          ← Lịch chuyến
        </Link>
      </header>
      <div className="operator-detail__columns">
        <form onSubmit={submit}>
          <section className="operator-create__panel operator-detail__route">
            <h2>Tuyến &amp; thời gian</h2>
            <p>Chọn hành trình và thời điểm xuất bến.</p>
            <div className="operator-create__route-fields">
              <DetailField
                label="ĐIỂM ĐI"
                value={draft.origin}
                onChange={(v) => change("origin", v)}
                options={["TP.HCM", "Đà Lạt", "Nha Trang", "Phan Thiết"]}
              />
              <button
                type="button"
                aria-label="Đổi chiều hành trình"
                className="operator-schedule__swap"
                onClick={() =>
                  setDraft((old) => ({
                    ...old,
                    origin: old.destination,
                    destination: old.origin,
                    pickup: old.dropoff,
                    dropoff: old.pickup,
                  }))
                }
              >
                <img src={swap} alt="" width={16} height={16} />
              </button>
              <DetailField
                label="ĐIỂM ĐẾN"
                value={draft.destination}
                onChange={(v) => change("destination", v)}
                options={["Đà Lạt", "TP.HCM", "Nha Trang", "Phan Thiết"]}
              />
            </div>
            <div className="operator-create__three">
              <DetailField
                label="NGÀY CHẠY"
                type="date"
                value={draft.date}
                onChange={(v) => change("date", v)}
              />
              <DetailField
                label="GIỜ KHỞI HÀNH"
                type="time"
                value={draft.departure}
                onChange={(v) => change("departure", v)}
              />
              <label className="operator-create__field">
                <span>THỜI GIAN DỰ KIẾN</span>
                <strong>{duration(trip.departure, trip.arrival)}</strong>
              </label>
            </div>
            <div className="operator-create__two">
              {(["pickup", "dropoff"] as const).map((key) => (
                <div key={key} className="operator-create__stops">
                  <label htmlFor={`detail-${key}`}>
                    {key === "pickup" ? "Điểm đón" : "Điểm trả"}
                  </label>
                  <button
                    type="button"
                    aria-label={`Sửa ${key === "pickup" ? "điểm đón" : "điểm trả"}`}
                    onClick={() =>
                      document.getElementById(`detail-${key}`)?.focus()
                    }
                  >
                    <img src={plus} alt="" width={14} height={14} />
                  </button>
                  <div>
                    <img src={pin} alt="" width={17} height={17} />
                    <textarea
                      id={`detail-${key}`}
                      value={draft[key]}
                      onChange={(e) => change(key, e.target.value)}
                      required
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section className="operator-create__panel operator-detail__crew">
            <h2>Xe &amp; nhân sự</h2>
            <p>Phân công nguồn lực phù hợp cho lịch chạy.</p>
            <div className="operator-create__two">
              <DetailField
                label="PHƯƠNG TIỆN"
                value={draft.vehicle}
                onChange={(v) => change("vehicle", v)}
                options={[
                  ...new Set([
                    trip.vehicle,
                    "Chưa phân công",
                    "45B-204.12",
                    "51B-208.36",
                  ]),
                ]}
              />
              <DetailField
                label="TÀI XẾ"
                value={draft.driver}
                onChange={(v) => change("driver", v)}
                options={[
                  ...new Set([
                    trip.driver,
                    "Chưa phân công",
                    "Hoàng Nam",
                    "Minh Khang",
                  ]),
                ]}
              />
            </div>
            <div className="operator-create__three">
              <label className="operator-create__field">
                <span>LOẠI XE</span>
                <strong>{trip.vehicleLabel}</strong>
              </label>
              <label className="operator-create__field">
                <span>SỨC CHỨA</span>
                <strong>{trip.capacity} ghế</strong>
              </label>
              <DetailField
                label="PHỤ XE"
                value={draft.assistant}
                onChange={(v) => change("assistant", v)}
                options={["Chưa phân công", "Thuận Phát"]}
              />
            </div>
            <div
              className={`operator-detail__assignment${ready ? "operator-detail__assignment--ready" : ""}`}
            >
              <strong>
                {ready ? "Đã chọn nguồn lực" : "Chưa đủ nguồn lực"}
              </strong>
              <small>
                {ready
                  ? "Dữ liệu phân công mô phỏng; chưa kiểm tra xung đột lịch."
                  : "Chọn phương tiện và tài xế trước khi lưu thay đổi."}
              </small>
            </div>
          </section>
          <section className="operator-create__panel operator-detail__notes">
            <h2>Ghi chú vận hành</h2>
            <p>Thông tin nội bộ dành cho nhân viên phụ trách chuyến.</p>
            <textarea
              aria-label="Ghi chú vận hành"
              maxLength={1000}
              placeholder="Chưa có ghi chú cho chuyến này."
              value={draft.note}
              onChange={(e) => change("note", e.target.value)}
            />
          </section>
          <footer className="operator-detail__actions">
            <Button
              type="button"
              variant="danger"
              onClick={() =>
                setMessage(
                  "Hủy chuyến cần quy trình xử lý vé và hoàn tiền riêng. Chưa có chuyến hoặc vé nào bị hủy.",
                )
              }
            >
              Hủy chuyến
            </Button>
            <Button type="submit" isLoading={mutation.isPending}>
              Lưu thay đổi
            </Button>
          </footer>
          <p className="operator-detail__message" role="status">
            {message}
          </p>
        </form>
        <aside className="operator-detail__passengers">
          <header>
            <h2>Danh sách hành khách</h2>
            <span>{trip.passengerList.length} hành khách</span>
          </header>
          <p>0/{trip.capacity} hành khách đã check-in</p>
          <input
            type="search"
            aria-label="Tìm hành khách"
            placeholder="Tìm tên hoặc số điện thoại"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="operator-detail__tabs">
            <button aria-pressed={!waiting} onClick={() => setWaiting(false)}>
              Tất cả
            </button>
            <button aria-pressed={waiting} onClick={() => setWaiting(true)}>
              Chờ check-in
            </button>
          </div>
          <div className="operator-detail__passenger-list">
            {(full ? filtered : filtered.slice(0, 4)).map((p) => (
              <article key={p.seat}>
                <strong>{p.name}</strong>
                <span className="operator-detail__seat">{p.seat}</span>
                <p>{p.phone}</p>
                <small>ĐIỂM ĐÓN</small>
                <div>
                  <span>{p.pickup}</span>
                  <b
                    className={p.confirmed ? "operator-detail__confirmed" : ""}
                  >
                    {p.confirmed ? "Đã xác nhận" : "Chờ check-in"}
                  </b>
                </div>
              </article>
            ))}
            {!filtered.length && (
              <p role="status">Không tìm thấy hành khách phù hợp.</p>
            )}
          </div>
          <section className="operator-detail__summary">
            <strong>
              {trip.passengerList.length} vé đã đặt ·{" "}
              {Math.max(0, trip.capacity - trip.passengerList.length)} ghế trống
            </strong>
            <p>Check-in sẽ mở trước giờ khởi hành.</p>
          </section>
          <Button
            variant="secondary"
            onClick={() => {
              setFull((v) => !v);
              setSearch("");
              setWaiting(false);
            }}
          >
            {full ? "Thu gọn danh sách" : "Xem danh sách đầy đủ"}
          </Button>
        </aside>
      </div>
    </>
  );
}
function duration(start: string, end: string): string {
  const minutes = (value: string): number =>
    Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
  const total = (minutes(end) - minutes(start) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")} giờ ${String(total % 60).padStart(2, "0")} phút`;
}
export function TripDetailPage(): ReactElement {
  const { tripId = "" } = useParams();
  const query = useQuery({
    queryKey: ["operator", "detail", tripId],
    queryFn: ({ signal }) => readTrip(tripId, signal),
    retry: false,
  });
  return (
    <div className="operator-schedule operator-detail">
      <OperatorSidebar />
      <main className="operator-schedule__main">
        {query.isPending ? (
          <p role="status">Đang tải chi tiết chuyến…</p>
        ) : query.isError ? (
          <PageState
            title={query.error.message}
            description="Kiểm tra mã chuyến hoặc thử lại."
            action={
              <>
                <Button onClick={() => void query.refetch()}>Thử lại</Button>
                <Link to="/operator/trips">Về lịch chuyến</Link>
              </>
            }
          />
        ) : (
          <DetailContent key={tripId} trip={query.data} />
        )}
      </main>
    </div>
  );
}
