import reassignedCheck from "@/assets/operator/edit/reassignedCheck.svg";
import { useQuery } from "@tanstack/react-query";
import {
  checkReview,
  isDraftAwaitingCheck,
  markDraftAwaitingCheck,
} from "../review/reviewRepository";
import { reviewDraftSchema, type ReviewDraft } from "../review/review.schema";
import { useState, type ReactElement, type FormEvent } from "react";
import { useLocation, useNavigate, Link } from "react-router";
import { z } from "zod";
import { Button } from "@/shared/ui/Button/Button";
import { OperatorSidebar } from "../components/OperatorSidebar";
import "../schedule/SchedulePage.css";
import "./CreateTripPage.css";
import back from "@/assets/operator/create/imgIconArrowLeft.svg";
import step1 from "@/assets/operator/create/imgStep1.svg";
import step2 from "@/assets/operator/create/imgStep2.svg";
import swap from "@/assets/operator/create/imgIconSwap.svg";
import pin from "@/assets/operator/create/imgIconPin.svg";
import plus from "@/assets/operator/create/imgIconPlus.svg";
import check from "@/assets/operator/create/imgFrame8.svg";
import reviewIcon from "@/assets/operator/create/imgFrame9.svg";

import editReviewIcon from "@/assets/operator/edit/imgFrame8.svg";
const schema = z
  .object({
    origin: z.string().min(1),
    destination: z.string().min(1),
    date: z.iso.date(),
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    duration: z.coerce.number().min(1).max(48),
    vehicle: z.string().min(1),
    driver: z.string().min(1),
    assistant: z.string(),
    fare: z.coerce.number().int().positive(),
    pickup: z.string().min(1),
    dropoff: z.string().min(1),
  })
  .refine((data) => data.origin !== data.destination, {
    message: "Điểm đi và điểm đến phải khác nhau.",
  });
const defaults = {
  origin: "TP.HCM",
  destination: "Đà Lạt",
  date: "2026-08-28",
  time: "07:30",
  duration: 7,
  vehicle: "45B-204.12",
  driver: "Hoàng Nam — GPLX hạng D",
  assistant: "Chưa phân công",
  fare: 320000,
  pickup: "Bến xe Miền Đông mới",
  dropoff: "Trung tâm Đà Lạt\nBến xe Liên tỉnh Đà Lạt",
};
type Draft = typeof defaults;
const KEY = "blue-operator-create-draft-v1";

function Field({
  label,
  value,
  onChange,
  options,
  type = "text",
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
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
          {options.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      ) : (
        <input
          aria-label={label}
          required
          type={type}
          min={type === "number" ? 1 : undefined}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  );
}
export function CreateTripPage({
  mode = "create",
  initialDraft,
}: {
  mode?: "create" | "edit";
  initialDraft?: ReviewDraft;
} = {}): ReactElement {
  const navigate = useNavigate();
  const location = useLocation();
  const [draft, setDraft] = useState<Draft>(() => {
    const parsed = schema.safeParse(
      initialDraft ?? location.state?.operatorDraft,
    );
    return parsed.success ? parsed.data : defaults;
  });
  const [requiresRecheck, setRequiresRecheck] = useState(
    () => mode === "edit" && isDraftAwaitingCheck(draft),
  );
  const [message, setMessage] = useState("");
  const resourceCheck = useQuery({
    queryKey: ["operator", "edit-resource-check", draft],
    queryFn: ({ signal }) => checkReview(draft, signal),
    enabled:
      mode === "edit" &&
      !requiresRecheck &&
      reviewDraftSchema.safeParse(draft).success,
    refetchOnWindowFocus: false,
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [review, setReview] = useState(false);
  const change = (key: keyof Draft, value: string): void => {
    setDraft((old) => ({
      ...old,
      [key]: key === "fare" || key === "duration" ? Number(value) : value,
    }));
    setReview(false);
    if (mode === "edit") setRequiresRecheck(true);
    setMessage("Có thay đổi chưa lưu");
  };
  const save = (): void => {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(draft));
      if (mode === "edit" && requiresRecheck) markDraftAwaitingCheck(draft);
      setMessage("Đã lưu bản nháp trong tab này");
    } catch {
      setMessage(
        "Không thể lưu trong trình duyệt này. Dữ liệu vẫn còn trên form.",
      );
    }
  };
  const restore = (): void => {
    try {
      const raw = sessionStorage.getItem(KEY);
      if (!raw) {
        setMessage("Chưa có bản nháp đã lưu");
        return;
      }
      const result = schema.safeParse(JSON.parse(raw));
      if (result.success) {
        setDraft(result.data);
        if (mode === "edit")
          setRequiresRecheck(isDraftAwaitingCheck(result.data));
        setMessage("Đã khôi phục bản nháp");
      } else setMessage("Bản nháp không hợp lệ");
    } catch {
      setMessage("Không đọc được bản nháp");
    }
  };
  const validate = (event: FormEvent): void => {
    event.preventDefault();
    const result = schema.safeParse(draft);
    const issues = result.success
      ? []
      : result.error.issues.map((issue) => issue.message);
    if (draft.vehicle === "Chưa phân công" || draft.driver === "Chưa phân công")
      issues.push("Cần phân công đủ xe và tài xế trước khi kiểm tra.");
    setErrors(issues);
    setReview(!issues.length);
    if (!issues.length) {
      try {
        sessionStorage.setItem(KEY, JSON.stringify(draft));
        if (mode === "edit" && requiresRecheck) markDraftAwaitingCheck(draft);
        void navigate("/operator/trips/review");
      } catch {
        setErrors([
          "Không lưu được bản nháp. Hãy cho phép lưu trữ để tiếp tục.",
        ]);
      }
    }
    setMessage(
      issues.length
        ? "Vui lòng kiểm tra các trường thông tin"
        : "Thông tin hợp lệ trong bản mô phỏng. Chưa phát hành chuyến.",
    );
  };
  return (
    <div
      className={[
        "operator-schedule",
        "operator-create",
        mode === "edit" && "operator-edit",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <OperatorSidebar />
      <main className="operator-schedule__main">
        <header className="operator-schedule__header">
          <h1>{mode === "edit" ? "Chỉnh sửa bản nháp" : "Tạo chuyến"}</h1>
          <span className="operator-create__save-status" role="status">
            {message || (mode === "edit" ? "Đã lưu bản nháp" : "Bản nháp mới")}
          </span>
          <Link className="operator-create__back" to="/operator/trips">
            <img src={back} alt="" width={16} height={16} />
            Lịch chuyến
          </Link>
        </header>
        <ol className="operator-create__steps">
          {[
            ["Thông tin chuyến", "Tuyến và thời gian"],
            ["Phân công", "Xe và nhân sự"],
            ["Xác nhận", "Kiểm tra và phát hành"],
          ].map(([title, subtitle], i) => (
            <li key={title}>
              <span className="operator-create__step-number">
                <img
                  src={i === 0 ? step1 : step2}
                  alt=""
                  width={32}
                  height={32}
                />
                <b>{i + 1}</b>
              </span>
              <div>
                <strong>{title}</strong>
                <small>{subtitle}</small>
              </div>
            </li>
          ))}
        </ol>
        <form onSubmit={validate}>
          <div className="operator-create__columns">
            <div>
              <section className="operator-create__panel operator-create__route">
                <h2>Tuyến &amp; thời gian</h2>
                <p>Chọn hành trình và thời điểm xuất bến.</p>
                <div className="operator-create__route-fields">
                  <Field
                    label="ĐIỂM ĐI"
                    value={draft.origin}
                    onChange={(v) => change("origin", v)}
                    options={["TP.HCM", "Đà Lạt", "Nha Trang", "Phan Thiết"]}
                  />
                  <button
                    type="button"
                    aria-label="Đổi chiều"
                    className="operator-schedule__swap"
                    onClick={() => {
                      setDraft((old) => ({
                        ...old,
                        origin: old.destination,
                        destination: old.origin,
                        pickup: old.dropoff,
                        dropoff: old.pickup,
                      }));
                      setReview(false);
                      if (mode === "edit") setRequiresRecheck(true);
                      setMessage("Có thay đổi chưa lưu");
                    }}
                  >
                    <img src={swap} alt="" width={16} height={16} />
                  </button>
                  <Field
                    label="ĐIỂM ĐẾN"
                    value={draft.destination}
                    onChange={(v) => change("destination", v)}
                    options={["Đà Lạt", "TP.HCM", "Nha Trang", "Phan Thiết"]}
                  />
                </div>
                <div className="operator-create__three">
                  <Field
                    label="NGÀY CHẠY"
                    type="date"
                    value={draft.date}
                    onChange={(v) => change("date", v)}
                  />
                  <Field
                    label="GIỜ KHỞI HÀNH"
                    type="time"
                    value={draft.time}
                    onChange={(v) => change("time", v)}
                  />
                  <Field
                    label="THỜI GIAN DỰ KIẾN (giờ)"
                    type="number"
                    value={draft.duration}
                    onChange={(v) => change("duration", v)}
                  />
                </div>
                <div className="operator-create__two">
                  {(["pickup", "dropoff"] as const).map((key) => (
                    <div className="operator-create__stops" key={key}>
                      <label htmlFor={key}>
                        {key === "pickup" ? "Điểm đón" : "Điểm trả"}
                      </label>
                      <button
                        type="button"
                        aria-label={`Thêm ${key === "pickup" ? "điểm đón" : "điểm trả"}`}
                        onClick={() => {
                          if (mode === "edit") {
                            change(key, `${draft[key]}\n`);
                          } else document.getElementById(key)?.focus();
                          setMessage("Nhập mỗi điểm dừng trên một dòng.");
                        }}
                      >
                        <img src={plus} alt="" width={14} height={14} />
                      </button>
                      {mode === "edit" ? (
                        <div className="operator-edit__stop-list">
                          {draft[key].split("\n").map((stop, index) => (
                            <div className="operator-edit__stop" key={index}>
                              <img src={pin} alt="" width={17} height={17} />
                              <input
                                aria-label={`${key === "pickup" ? "Điểm đón" : "Điểm trả"} ${index + 1}`}
                                value={stop}
                                required
                                onChange={(event) => {
                                  const stops = draft[key].split("\n");
                                  stops[index] = event.target.value;
                                  change(key, stops.join("\n"));
                                }}
                              />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div>
                          <img src={pin} alt="" width={17} height={17} />
                          <textarea
                            id={key}
                            value={draft[key]}
                            onChange={(e) => change(key, e.target.value)}
                            aria-label={
                              key === "pickup" ? "Điểm đón" : "Điểm trả"
                            }
                            required
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
              <section className="operator-create__panel operator-create__crew">
                <h2>Xe &amp; nhân sự</h2>
                <p>Phân công nguồn lực phù hợp cho lịch chạy.</p>
                <div className="operator-create__two">
                  <Field
                    label="PHƯƠNG TIỆN"
                    value={draft.vehicle}
                    onChange={(v) => change("vehicle", v)}
                    options={[
                      "45B-204.12",
                      "51B-208.36",
                      "51B-219.34",
                      "Chưa phân công",
                    ]}
                  />
                  <Field
                    label="TÀI XẾ"
                    value={draft.driver}
                    onChange={(v) => change("driver", v)}
                    options={[
                      "Hoàng Nam — GPLX hạng D",
                      "Minh Khang — GPLX hạng D",
                      "Quang Huy — GPLX hạng D",
                      "Chưa phân công",
                    ]}
                  />
                </div>
                <div className="operator-create__three">
                  <Field
                    label="LOẠI XE"
                    value={
                      draft.vehicle === "51B-208.36"
                        ? "Limousine"
                        : "Giường nằm"
                    }
                    onChange={() => {}}
                    options={[
                      draft.vehicle === "51B-208.36"
                        ? "Limousine"
                        : "Giường nằm",
                    ]}
                  />
                  <Field
                    label="SỨC CHỨA"
                    value={draft.vehicle === "51B-208.36" ? "22 ghế" : "34 ghế"}
                    onChange={() => {}}
                    options={[
                      draft.vehicle === "51B-208.36" ? "22 ghế" : "34 ghế",
                    ]}
                  />
                  <Field
                    label="PHỤ XE"
                    value={draft.assistant}
                    onChange={(v) => change("assistant", v)}
                    options={["Chưa phân công", "Thuận Phát"]}
                  />
                </div>
                <div className="operator-create__note">
                  {mode === "edit" && requiresRecheck && (
                    <img src={reassignedCheck} alt="" width={20} height={20} />
                  )}
                  {mode !== "edit" && (
                    <img src={check} alt="" width={20} height={20} />
                  )}
                  <div>
                    <strong>
                      {mode === "edit"
                        ? requiresRecheck
                          ? "Đã đổi xe và tài xế"
                          : resourceCheck.data?.eligible
                            ? "Bản nháp đã đổi phân công"
                            : "Bản nháp đang có xung đột"
                        : message.startsWith("Đã lưu")
                          ? "Bản nháp đã lưu"
                          : "Thông tin bản nháp"}
                    </strong>
                    <small>
                      {mode === "edit"
                        ? requiresRecheck
                          ? "Chạy kiểm tra lại để xác nhận phân công mới."
                          : "Đổi xe và tài xế, sau đó kiểm tra lại."
                        : "Chọn Kiểm tra chuyến để kiểm tra xe, tài xế và GPLX."}
                    </small>
                  </div>
                </div>
              </section>
            </div>
            <aside>
              <section className="operator-create__panel operator-create__fare">
                <h2>Giá vé &amp; chính sách hủy</h2>
                <p>
                  Áp dụng cho chuyến {draft.origin} → {draft.destination}.
                </p>
                <Field
                  label="GIÁ VÉ MỖI GHẾ (đ) *"
                  type="number"
                  value={draft.fare}
                  onChange={(v) => change("fare", v)}
                />
                <Field
                  label="CHÍNH SÁCH HỦY *"
                  value="Tiêu chuẩn 24h / 6h / 2h"
                  onChange={() => {}}
                  options={["Tiêu chuẩn 24h / 6h / 2h"]}
                />
                {[
                  "Từ 24 giờ trở lên",
                  "Từ 6 đến dưới 24 giờ",
                  "Từ 2 đến dưới 6 giờ",
                ].map((text, i) => (
                  <div className="operator-create__policy" key={text}>
                    <span>{text}</span>
                    <strong>Phí hủy {(i + 1) * 10}%</strong>
                  </div>
                ))}
                <p>Dưới 2 giờ: không hỗ trợ khách tự hủy vé.</p>
              </section>
              <section className="operator-create__panel operator-create__validation">
                <h2>Kiểm tra nguồn lực</h2>
                {mode === "edit" ? (
                  requiresRecheck ? (
                    <div className="operator-edit__pending" role="status">
                      <strong>Xe mới: {draft.vehicle}</strong>
                      <strong>
                        Tài xế mới: {draft.driver.split(" — ")[0]}
                      </strong>
                      <strong>GPLX cần được kiểm tra lại</strong>
                      <strong>Chưa kiểm tra phân công mới</strong>
                    </div>
                  ) : resourceCheck.isFetching ? (
                    <p role="status">Đang kiểm tra phân công…</p>
                  ) : resourceCheck.isError ? (
                    <>
                      <p role="alert">Chưa kiểm tra được nguồn lực.</p>
                      <Button
                        type="button"
                        onClick={() => void resourceCheck.refetch()}
                      >
                        Thử lại
                      </Button>
                    </>
                  ) : resourceCheck.data?.eligible ? (
                    <strong>
                      Phân công mới không còn xung đột trong dữ liệu mô phỏng.
                      Chọn Kiểm tra lại để tiếp tục.
                    </strong>
                  ) : (
                    <>
                      <ul role="alert">
                        {resourceCheck.data?.issues.map((issue) => (
                          <li key={issue}>{issue}</li>
                        ))}
                      </ul>
                      <strong>Cần cập nhật phân công</strong>
                    </>
                  )
                ) : (
                  [
                    "Kiểm tra trạng thái hoạt động của xe",
                    "Kiểm tra tài xế được phân công",
                    "Kiểm tra hạn và hạng GPLX",
                    "Kiểm tra trùng lịch xe và tài xế",
                  ].map((text) => <strong key={text}>{text}</strong>)
                )}
                <p>Đã tính khoảng đệm theo cấu hình nhà xe.</p>
                {errors.length > 0 && (
                  <ul role="alert">
                    {errors.map((error, i) => (
                      <li key={i}>{error}</li>
                    ))}
                  </ul>
                )}
                {review && (
                  <p role="status">
                    Đã kiểm tra thông tin form. Kiểm tra xung đột lịch và phát
                    hành sẽ được nối ở bước Review riêng.
                  </p>
                )}
              </section>
            </aside>
          </div>
          <footer className="operator-create__actions">
            <button
              className={mode === "edit" ? "operator-edit__restore" : undefined}
              type="button"
              onClick={restore}
            >
              Khôi phục bản nháp
            </button>
            <Link to="/operator/trips">Hủy</Link>
            <Button variant="secondary" type="button" onClick={save}>
              Lưu bản nháp
            </Button>
            <Button type="submit">
              <img
                src={mode === "edit" ? editReviewIcon : reviewIcon}
                alt=""
                width={17}
                height={17}
              />
              {mode === "edit" ? "Kiểm tra lại" : "Kiểm tra chuyến"}
            </Button>
          </footer>
        </form>
      </main>
    </div>
  );
}
