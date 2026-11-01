import type { ReactElement } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { OperatorSidebar } from "../components/OperatorSidebar";
import { Button } from "@/shared/ui/Button/Button";
import { PageState } from "@/shared/ui/PageState/PageState";
import {
  REFUND_LEVELS,
  cancellationMinutes,
  refundLeadLabel,
  refundLevel,
} from "./refunds.schema";
import {
  REFUND_FEES,
  estimateRefund,
  type RefundTracking,
} from "./refundTracking.schema";
import { getRefundTracking } from "./refundTrackingRepository";
import trips from "@/assets/operator/refunds/detail/imgFrame.svg";
import bookings from "@/assets/operator/refunds/detail/imgFrame1.svg";
import routes from "@/assets/operator/refunds/detail/imgFrame2.svg";
import vehicles from "@/assets/operator/refunds/detail/imgFrame3.svg";
import drivers from "@/assets/operator/refunds/detail/imgFrame4.svg";
import reports from "@/assets/operator/refunds/detail/imgFrame5.svg";
import members from "@/assets/operator/refunds/detail/imgFrame6.svg";
import cancel from "@/assets/operator/refunds/detail/imgFrame7.svg";
import customerIcon from "@/assets/operator/refunds/detail/imgIconCustomer.svg";
import tripIcon from "@/assets/operator/refunds/detail/imgIconTrip.svg";
import cancelIcon from "@/assets/operator/refunds/detail/imgIconCancel.svg";
import refundIcon from "@/assets/operator/refunds/detail/imgIconRefund.svg";
import backIcon from "@/assets/operator/refunds/detail/imgIconArrowLeft.svg";
import caseRefundIcon from "@/assets/operator/refunds/detail/imgIconRefund1.svg";
import caseIcon from "@/assets/operator/refunds/detail/imgSectionIconCaseFile.svg";
import policyIcon from "@/assets/operator/refunds/detail/imgSectionIconPolicy.svg";
import amountIcon from "@/assets/operator/refunds/detail/imgSectionIconRefund.svg";
import transactionIcon from "@/assets/operator/refunds/detail/imgSectionIconTransaction.svg";
import "../schedule/SchedulePage.css";
import "./RefundRequestsPage.css";
import "./RefundTrackingPage.css";
const NAV_ICONS = {
  "Chuyến đi": trips,
  "Đặt chỗ & giao dịch": bookings,
  "Tuyến & điểm dừng": routes,
  "Xe & sơ đồ ghế": vehicles,
  "Tài xế": drivers,
  "Báo cáo": reports,
  "Tổ chức & thành viên": members,
  "Hủy vé & hoàn tiền": cancel,
};
const time = (iso: string): string =>
  `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)} lúc ${iso.slice(11, 16)}`;
const money = (value: number): string => `${value.toLocaleString("vi-VN")}đ`;
const progress = (status: RefundTracking["status"]): string =>
  status === "processing"
    ? "Đang xử lý"
    : status === "completed"
      ? "Đã hoàn tiền"
      : status === "exception"
        ? "Chờ xem xét ngoại lệ"
        : "Chờ xử lý";
function Fact({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string;
  className?: string;
}): ReactElement {
  return (
    <div className={`refund-tracking__fact ${className}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
function SectionTitle({
  icon,
  children,
}: {
  icon: string;
  children: string;
}): ReactElement {
  return (
    <h2 className="refund-tracking__section-title">
      <img src={icon} width={20} height={20} alt="" />
      {children}
    </h2>
  );
}
function TrackingContent({
  item,
  back,
}: {
  item: RefundTracking;
  back: () => void;
}): ReactElement {
  const minutes = cancellationMinutes(item.requestedAt, item.departureAt),
    levelKey = refundLevel(minutes),
    level = REFUND_LEVELS[levelKey],
    amounts = estimateRefund(item.cancellationValue, minutes);
  return (
    <div className="refund-tracking__layout">
      <article
        className="refund-tracking__details"
        aria-label="Thông tin yêu cầu hủy vé"
      >
        <Button
          variant="ghost"
          className="refund-tracking__back"
          onClick={back}
        >
          <img src={backIcon} width={18} height={18} alt="" />
          Quay lại danh sách
        </Button>
        <section className="refund-tracking__customer">
          <SectionTitle icon={customerIcon}>Khách hàng</SectionTitle>
          <dl className="refund-tracking__two">
            <Fact label="Khách hàng" value={item.customer} />
            <Fact label="Số điện thoại" value={item.phone} />
          </dl>
        </section>
        <section className="refund-tracking__trip">
          <SectionTitle icon={tripIcon}>Chuyến xe</SectionTitle>
          <dl className="refund-tracking__two">
            <Fact label="Chuyến" value={item.tripCode} />
            <Fact label="Tuyến" value={item.route} />
            <Fact label="Biển số xe" value={item.plate} />
            <Fact label="Loại xe" value={item.vehicleType} />
          </dl>
        </section>
        <section className="refund-tracking__cancel">
          <SectionTitle icon={cancelIcon}>Yêu cầu hủy vé</SectionTitle>
          <dl className="refund-tracking__three">
            <Fact label="Số vé đã đặt" value={`${item.bookedTickets} vé`} />
            <Fact label="Số vé muốn hủy" value={`${item.seats.length} vé`} />
            <Fact label="Vị trí muốn hủy" value={item.seats.join(", ")} />
            <Fact
              className="refund-tracking__time"
              label="Khách yêu cầu hủy lúc"
              value={time(item.requestedAt)}
            />
            <Fact
              className="refund-tracking__time"
              label="Xe khởi hành lúc"
              value={time(item.departureAt)}
            />
            <div className="refund-tracking__lead">
              <dt>Hủy trước</dt>
              <dd>{refundLeadLabel(minutes)}</dd>
              <p>
                {item.progressLayout === "timeline"
                  ? item.requestedAt.slice(0, 10) ===
                    item.departureAt.slice(0, 10)
                    ? "Cùng ngày"
                    : "Qua ngày hôm sau"
                  : `Tương đương ${Math.round((minutes / 60) * 100) / 100} giờ`}
              </p>
            </div>
          </dl>
        </section>
        <section className="refund-tracking__progress">
          <SectionTitle icon={refundIcon}>Hoàn tiền</SectionTitle>
          <dl className="refund-tracking__three">
            {item.progressLayout === "timeline" ? (
              <>
                <Fact
                  label="Yêu cầu hủy"
                  value={`Đã ghi nhận lúc ${item.requestedAt.slice(11, 16)}`}
                />
                <Fact
                  label="Vé"
                  value={
                    item.cancelledTickets
                      ? `Đã hủy ${item.cancelledTickets} vé`
                      : "Chưa hủy vé"
                  }
                />
                <Fact
                  label="Hoàn tiền"
                  value={
                    item.refundReference
                      ? `${item.status === "completed" ? "Đã hoàn" : progress(item.status)}${item.paymentMethod ? ` qua ${item.paymentMethod}` : ""}`
                      : "Chưa tạo Refund"
                  }
                />
              </>
            ) : (
              <>
                <Fact
                  label="Trạng thái vé"
                  value={
                    item.cancelledTickets
                      ? `Đã hủy ${item.cancelledTickets} vé`
                      : `Chờ xử lý ${item.seats.length} vé`
                  }
                />
                <Fact
                  label="Trạng thái hoàn tiền"
                  value={progress(item.status)}
                />
                <Fact
                  label="Phương thức"
                  value={item.paymentMethod ?? "Chưa có dữ liệu"}
                />
              </>
            )}
          </dl>
        </section>
      </article>
      <aside
        className={
          levelKey === "exception"
            ? "refund-tracking__decision refund-tracking__decision--exception"
            : "refund-tracking__decision"
        }
        aria-label="Hồ sơ hoàn tiền"
      >
        <header className="refund-tracking__case">
          <img
            className="refund-tracking__case-icon"
            src={caseIcon}
            width={18}
            height={18}
            alt=""
          />
          <span className="refund-tracking__case-badge">
            <img src={caseRefundIcon} width={18} height={18} alt="" />
          </span>
          <div>
            <p>Hồ sơ hoàn tiền</p>
            <h2>{item.bookingCode}</h2>
            <strong>
              <span>{levelKey === "exception" ? "Ngoại lệ" : level.label}</span>
              <span>
                {levelKey === "exception"
                  ? "Hủy dưới 2 giờ"
                  : level.description}
              </span>
            </strong>
          </div>
        </header>
        <section className="refund-tracking__policy">
          <h3>
            <img src={policyIcon} width={18} height={18} alt="" />
            {levelKey === "exception"
              ? "Đối chiếu quy định hoàn tiền"
              : "Quy định hoàn tiền"}
          </h3>
          <ol>
            {(["level1", "level2", "level3"] as const).map((key, index) => (
              <li key={key} data-active={key === levelKey || undefined}>
                <div>
                  <strong>MỨC {index + 1}</strong>
                  <p>{REFUND_LEVELS[key].description}</p>
                </div>
                <div>
                  <p>Phí hủy {REFUND_FEES[key]}%</p>
                  <p>Hoàn dự kiến {100 - REFUND_FEES[key]}%</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
        <section className="refund-tracking__amount">
          <img src={amountIcon} width={18} height={18} alt="" />
          <div>
            <p>
              {levelKey === "exception"
                ? "Kết quả đối chiếu"
                : "Số tiền hoàn dự kiến"}
            </p>
            <strong>
              {levelKey === "exception"
                ? "Không đủ điều kiện hoàn tiền"
                : amounts
                  ? money(amounts.refund)
                  : "Chưa xác định"}
            </strong>
            <small>
              {amounts && item.cancellationValue !== null ? (
                <>
                  <span>Giá trị {money(item.cancellationValue)}</span>
                  <span>Phí hủy {money(amounts.fee)}</span>
                </>
              ) : levelKey === "exception" ? (
                "Yêu cầu hủy dưới 2 giờ trước khởi hành"
              ) : (
                "Chưa có giá trị vé hủy trong dữ liệu mock."
              )}
            </small>
          </div>
        </section>
        <section className="refund-tracking__transaction">
          <img src={transactionIcon} width={18} height={18} alt="" />
          <div>
            <h3>
              {levelKey === "exception"
                ? "Trạng thái yêu cầu"
                : item.paymentMethod
                  ? `Hoàn tiền qua ${item.paymentMethod}`
                  : "Tiến độ hoàn tiền"}
            </h3>
            <p>
              {levelKey === "exception" ? (
                <span>Chuyển xử lý ngoại lệ</span>
              ) : (
                <>
                  <span>{item.refundReference ?? "Chưa có mã hoàn tiền"}</span>
                  <span>{progress(item.status)}</span>
                </>
              )}
            </p>
          </div>
        </section>
      </aside>
    </div>
  );
}
export function RefundTrackingPage(): ReactElement {
  const { bookingCode = "" } = useParams(),
    [params] = useSearchParams(),
    navigate = useNavigate();
  const returnPath = params.get("returnTo"),
    back = (): void => {
      navigate(
        returnPath &&
          (returnPath === "/operator/refund-requests" ||
            returnPath.startsWith("/operator/refund-requests?"))
          ? returnPath
          : "/operator/refund-requests",
      );
    };
  const query = useQuery({
    queryKey: ["operator-refund-tracking", bookingCode],
    queryFn: ({ signal }) => getRefundTracking(bookingCode, signal),
  });
  return (
    <div className="operator-schedule operator-refunds refund-tracking">
      <a className="operator-schedule__skip" href="#refund-tracking-main">
        Đến nội dung chính
      </a>
      <OperatorSidebar iconsOverride={NAV_ICONS} />
      <main className="operator-schedule__main" id="refund-tracking-main">
        <header className="operator-schedule__header">
          <h1>Chi tiết hủy vé và hoàn tiền</h1>
        </header>
        {query.isPending ? (
          <PageState
            title="Đang tải hồ sơ"
            description="Vui lòng chờ trong giây lát."
          />
        ) : query.isError ? (
          <PageState
            title="Không tải được hồ sơ"
            description={query.error.message}
            action={
              <Button onClick={() => void query.refetch()}>Thử lại</Button>
            }
          />
        ) : query.data ? (
          <TrackingContent item={query.data} back={back} />
        ) : (
          <PageState
            title="Không tìm thấy yêu cầu"
            description="Mã yêu cầu không tồn tại trong dữ liệu mock."
            action={
              <Button variant="secondary" onClick={back}>
                Quay lại danh sách
              </Button>
            }
          />
        )}
      </main>
    </div>
  );
}
