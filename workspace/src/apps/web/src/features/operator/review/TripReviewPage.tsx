import { TripConflictDialog } from "./TripConflictDialog";
import { useRef, useState, type ReactElement } from "react";
import { Link, useNavigate } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { OperatorSidebar } from "../components/OperatorSidebar";
import { Button } from "@/shared/ui/Button/Button";
import { PageState } from "@/shared/ui/PageState/PageState";
import {
  loadReviewDraft,
  saveReviewDraft,
  checkReview,
  publishReview,
} from "./reviewRepository";
import { REVIEW_SAMPLE, type ReviewDraft } from "./review.schema";
import back from "@/assets/operator/review/imgIconArrowLeft.svg";
import step from "@/assets/operator/review/imgStep1.svg";
import active from "@/assets/operator/review/imgStep3.svg";
import pin from "@/assets/operator/review/imgIconPin.svg";
import calendar from "@/assets/operator/review/imgIconCalendar.svg";
import clock from "@/assets/operator/review/imgIconClock.svg";
import swap from "@/assets/operator/review/imgIconSwap.svg";
import readyIcon from "@/assets/operator/review/imgFrame8.svg";
import publishIcon from "@/assets/operator/review/imgFrame9.svg";
import "../schedule/SchedulePage.css";
import "../create/CreateTripPage.css";
import "./TripReviewPage.css";

function Fact({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: string;
}): ReactElement {
  return (
    <div className="operator-review__fact">
      <span>{label}</span>
      <strong>{value}</strong>
      {icon && <img src={icon} alt="" width={17} height={17} />}
    </div>
  );
}
function ReviewContent({ draft }: { draft: ReviewDraft }): ReactElement {
  const navigate = useNavigate(),
    client = useQueryClient();
  const [message, setMessage] = useState("");
  const [published, setPublished] = useState<string | null>(null);
  const lock = useRef(false);
  const attempt = useRef<string | null>(null);
  const check = useQuery({
    queryKey: ["operator", "review-check", draft],
    queryFn: ({ signal }) => checkReview(draft, signal),
    refetchOnWindowFocus: false,
  });
  const publish = useMutation({
    mutationFn: () => publishReview(draft, attempt.current ?? ""),
    onSuccess: (id) => {
      setPublished(id);
      setMessage(`Đã phát hành chuyến ${id} trong môi trường mô phỏng.`);
      void client.invalidateQueries({
        queryKey: ["operator", "schedule-preview"],
      });
    },
    onError: (error) => {
      setMessage(error.message);
      lock.current = false;
      void check.refetch();
    },
  });
  const save = (): void =>
    setMessage(
      saveReviewDraft(draft)
        ? "Đã lưu bản nháp trong tab này."
        : "Trình duyệt không cho lưu bản nháp. Hãy kiểm tra quyền lưu trữ.",
    );
  const confirm = (): void => {
    if (lock.current || !check.data?.eligible || check.isFetching || published)
      return;
    lock.current = true;
    const fingerprint = JSON.stringify(draft);
    try {
      const raw = sessionStorage.getItem("blue-operator-publish-attempt");
      const stored = raw ? JSON.parse(raw) : null;
      attempt.current =
        stored?.fingerprint === fingerprint && typeof stored?.key === "string"
          ? stored.key
          : crypto.randomUUID();
      sessionStorage.setItem(
        "blue-operator-publish-attempt",
        JSON.stringify({ fingerprint, key: attempt.current }),
      );
    } catch {
      attempt.current ??= crypto.randomUUID();
    }
    publish.mutate();
  };
  const issueLabels =
    check.data?.conflicts.length === check.data?.issues.length
      ? (check.data?.conflicts.map((conflict) => {
          if (conflict.title === "Xe bị trùng lịch")
            return "Xe " + draft.vehicle + " bị trùng lịch";
          if (conflict.title === "Tài xế bị trùng lịch")
            return draft.driver.split(" — ")[0] + " bị trùng lịch";
          if (conflict.title === "Giấy phép lái xe hết hạn")
            return (
              check.data.issues.find((issue) => issue.startsWith("GPLX")) ??
              conflict.description
            );
          return conflict.description;
        }) ?? [])
      : (check.data?.issues ?? []);
  const capacity =
    check.data?.capacity ?? (draft.vehicle === "51B-208.36" ? 22 : 34);
  return (
    <>
      <header className="operator-schedule__header">
        <h1>Kiểm tra &amp; phát hành chuyến</h1>
        <span className="operator-create__save-status" role="status">
          {message || "Đã lưu bản nháp"}
        </span>
        <Link className="operator-create__back" to="/operator/trips">
          <img src={back} alt="" width={16} height={16} />
          Lịch chuyến
        </Link>
      </header>
      <ol className="operator-create__steps operator-review__steps">
        {[
          ["Thông tin chuyến", "Tuyến và thời gian"],
          ["Phân công", "Xe và nhân sự"],
          ["Xác nhận", "Xác nhận mở bán"],
        ].map(([title, subtitle], i) => (
          <li key={title}>
            <span className="operator-create__step-number">
              <img
                src={i === 2 ? active : step}
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
      <div className="operator-create__columns">
        <div>
          <section className="operator-create__panel operator-review__route">
            <h2>Tuyến &amp; thời gian</h2>
            <p>Kiểm tra tuyến, điểm dừng và giờ chạy trước khi phát hành.</p>
            <div className="operator-create__route-fields">
              <Fact label="ĐIỂM ĐI" value={draft.origin} />
              <img
                className="operator-review__swap"
                src={swap}
                alt=""
                width={16}
                height={16}
              />
              <Fact label="ĐIỂM ĐẾN" value={draft.destination} />
            </div>
            <div className="operator-create__three">
              <Fact
                label="NGÀY CHẠY"
                value={draft.date.split("-").reverse().join("/")}
                icon={calendar}
              />
              <Fact label="GIỜ KHỞI HÀNH" value={draft.time} icon={clock} />
              <Fact
                label="THỜI GIAN DỰ KIẾN"
                value={`${String(Math.floor(draft.duration)).padStart(2, "0")} giờ${draft.duration % 1 ? ` ${Math.round((draft.duration % 1) * 60)} phút` : ""}`}
                icon={clock}
              />
            </div>
            <div className="operator-create__two">
              {[
                ["Điểm đón", draft.pickup],
                ["Điểm trả", draft.dropoff],
              ].map(([label, value]) => (
                <div className="operator-review__stops" key={label}>
                  <span>{label}</span>
                  <div>
                    {value
                      .split("\n")
                      .filter(Boolean)
                      .map((stop, i) => (
                        <p key={i}>
                          <img src={pin} alt="" width={17} height={17} />
                          {stop}
                        </p>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section className="operator-create__panel operator-review__crew">
            <h2>Xe &amp; nhân sự</h2>
            <p>Xe và nhân sự được phân công cho chuyến này.</p>
            <div className="operator-create__two">
              <Fact label="PHƯƠNG TIỆN" value={draft.vehicle} />
              <Fact label="TÀI XẾ" value={draft.driver} />
            </div>
            <div className="operator-create__three">
              <Fact
                label="LOẠI XE"
                value={check.data?.vehicleType ?? "Đang kiểm tra"}
              />
              <Fact label="SỨC CHỨA" value={`${capacity} ghế`} />
              <Fact label="PHỤ XE" value={draft.assistant} />
            </div>
            <div
              className={[
                "operator-create__note",
                check.data &&
                  !check.data.eligible &&
                  "operator-review__blocked-note",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {check.data?.eligible && (
                <img src={readyIcon} alt="" width={20} height={20} />
              )}
              <div>
                <strong>
                  {published
                    ? "Chuyến đã được phát hành"
                    : check.data?.eligible
                      ? "Chuyến đã đủ điều kiện phát hành"
                      : `Bản nháp — Còn ${check.data?.issues.length ?? 0} lỗi cần sửa`}
                </strong>
                <small>
                  {check.data && !check.data.eligible
                    ? "Đã lưu bản nháp. Sửa lỗi và kiểm tra lại trước khi phát hành."
                    : `Chuyến chỉ mở bán khi đủ ${capacity} ghế đã sẵn sàng.`}
                </small>
              </div>
            </div>
          </section>
        </div>
        <aside>
          <section className="operator-create__panel operator-review__fare">
            <h2>Giá vé &amp; chính sách hủy</h2>
            <p>
              Áp dụng cho chuyến {draft.origin} → {draft.destination}.
            </p>
            <Fact
              label="GIÁ VÉ MỖI GHẾ *"
              value={`${new Intl.NumberFormat("vi-VN").format(draft.fare)}đ`}
            />
            <Fact label="CHÍNH SÁCH HỦY *" value="Tiêu chuẩn 24h / 6h / 2h" />
            {[
              "Từ 24 giờ trở lên",
              "Từ 6 đến dưới 24 giờ",
              "Từ 2 đến dưới 6 giờ",
            ].map((label, i) => (
              <div className="operator-create__policy" key={label}>
                <span>{label}</span>
                <strong>Phí hủy {(i + 1) * 10}%</strong>
              </div>
            ))}
            <p>Dưới 2 giờ: không hỗ trợ khách tự hủy vé.</p>
          </section>
          <section
            className={[
              "operator-create__panel",
              "operator-review__validation",
              check.data && !check.data.eligible && "operator-review__blocked",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <h2>
              {check.data && !check.data.eligible
                ? "Chưa đạt kiểm tra"
                : "Kết quả kiểm tra"}
            </h2>
            {check.isPending ? (
              <p role="status">Đang kiểm tra nguồn lực…</p>
            ) : check.isError ? (
              <>
                <p role="alert">{check.error.message}</p>
                <Button onClick={() => void check.refetch()}>Thử lại</Button>
              </>
            ) : check.data.eligible ? (
              <>
                {[
                  "Xe đang hoạt động và đủ điều kiện khai thác",
                  "Tài xế đang hoạt động, đã được phân công",
                  "GPLX còn hạn và phù hợp loại xe",
                  "Xe và tài xế không trùng lịch",
                ].map((label) => (
                  <strong key={label}>{label}</strong>
                ))}
                <p>Đã tính khoảng đệm theo cấu hình nhà xe.</p>
              </>
            ) : (
              <>
                <ul role="alert">
                  {issueLabels.map((issue, index) => (
                    <li key={index}>{issue}</li>
                  ))}
                </ul>
                <strong>
                  {check.data.issues.length} lỗi đang chặn phát hành
                </strong>
                <TripConflictDialog
                  key={JSON.stringify(check.data.issues)}
                  draft={draft}
                  result={check.data}
                />
              </>
            )}
          </section>
        </aside>
      </div>
      <footer className="operator-create__actions operator-review__actions">
        <Button
          variant="ghost"
          onClick={() => {
            saveReviewDraft(draft);
            void navigate("/operator/trips/draft/edit", {
              state: { operatorDraft: draft },
            });
          }}
        >
          Chỉnh sửa
        </Button>
        <Button variant="secondary" onClick={save}>
          Lưu bản nháp
        </Button>
        {published ? (
          <Link
            className="operator-create__back"
            to={`/operator/trips/${published}`}
          >
            Xem chuyến {published}
          </Link>
        ) : (
          <Button
            disabled={!check.data?.eligible || check.isFetching}
            isLoading={publish.isPending}
            onClick={confirm}
          >
            <img src={publishIcon} alt="" width={17} height={17} />
            Xác nhận phát hành
          </Button>
        )}
      </footer>
      <p className="operator-review__feedback" role="status">
        {message}
      </p>
    </>
  );
}
export function TripReviewPage(): ReactElement {
  const client = useQueryClient();
  const draft = useQuery({
    queryKey: ["operator", "review-draft"],
    queryFn: loadReviewDraft,
    staleTime: 0,
    refetchOnMount: "always",
  });
  return (
    <div className="operator-schedule operator-review">
      <OperatorSidebar />
      <main className="operator-schedule__main">
        {draft.isPending ? (
          <p role="status">Đang đọc bản nháp…</p>
        ) : !draft.data ? (
          <PageState
            title="Chưa có bản nháp để kiểm tra"
            description="Tạo chuyến trước, hoặc mở dữ liệu mẫu để xem thiết kế."
            action={
              <>
                <Link to="/operator/trips/new">Tạo chuyến mới</Link>
                <Button
                  onClick={() => {
                    const sample = {
                      ...REVIEW_SAMPLE,
                      vehicle: "45B-204.12",
                      driver: "Hoàng Nam — GPLX hạng D",
                    };
                    if (saveReviewDraft(sample))
                      client.setQueryData(["operator", "review-draft"], sample);
                  }}
                >
                  Xem mẫu xung đột
                </Button>
                <Button
                  onClick={() => {
                    saveReviewDraft(REVIEW_SAMPLE);
                    client.setQueryData(
                      ["operator", "review-draft"],
                      REVIEW_SAMPLE,
                    );
                  }}
                >
                  Dùng bản mẫu Figma
                </Button>
              </>
            }
          />
        ) : (
          <ReviewContent key={JSON.stringify(draft.data)} draft={draft.data} />
        )}
      </main>
    </div>
  );
}
