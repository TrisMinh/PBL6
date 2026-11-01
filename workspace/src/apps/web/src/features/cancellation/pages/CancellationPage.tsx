import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { Link, useParams } from "react-router";

import busIcon from "@/assets/cancellation/bus.svg";
import passengerIcon from "@/assets/cancellation/passenger.svg";
import phoneIcon from "@/assets/cancellation/phone.svg";
import pickupIcon from "@/assets/cancellation/pickup.svg";
import policyIcon from "@/assets/cancellation/policy.svg";
import quoteIcon from "@/assets/cancellation/quote.svg";
import timelineBusIcon from "@/assets/cancellation/timeline-bus.svg";
import verifiedIcon from "@/assets/cancellation/verified.svg";
import processingSafetyIcon from "@/assets/payment/processing-safety.svg";
import progressRail from "@/assets/payment/progress-rail.svg";
import statusDot from "@/assets/payment/status-dot.svg";
import { useAccountSession } from "@/features/auth/hooks/useAccountSession";
import type { MockSession } from "@/features/auth/types/auth";
import type { BookingRepositoryError } from "@/features/booking/repositories/bookingRepositoryError";
import { CancellationConfirmDialog } from "@/features/cancellation/components/CancellationConfirmDialog/CancellationConfirmDialog";
import { CancellationSelector } from "@/features/cancellation/components/CancellationSelector/CancellationSelector";
import {
  useCancellationOptions,
  useCreateCancellation,
} from "@/features/cancellation/hooks/useCancellation";
import type { CancellationAccess } from "@/features/cancellation/repositories/cancellationRepository";
import type {
  CancellationOptions,
  Refund,
} from "@/features/cancellation/types/cancellation";
import { useTicketAccess } from "@/features/tickets/hooks/useTicketAccess";
import { ticketCodeSchema } from "@/features/tickets/schemas/ticket.schema";
import type {
  TicketAccess,
  TicketDetail,
} from "@/features/tickets/types/ticketAccess";
import { ROUTES } from "@/shared/config/routes";
import { Button } from "@/shared/ui/Button/Button";
import { PageState } from "@/shared/ui/PageState/PageState";

import "./CancellationPage.css";

type Journey = CancellationOptions["journey"];
type CancellationMutation = ReturnType<typeof useCreateCancellation>;

interface SelectionProps {
  bookingCode: string;
  access: CancellationAccess;
  revoke: () => void;
}

interface FormProps {
  bookingCode: string;
  access: CancellationAccess;
  options: CancellationOptions;
}

interface RefundAmounts {
  fare: number;
  fee: number;
  refund: number;
}

function money(value: number): string {
  return `${new Intl.NumberFormat("vi-VN").format(value)}đ`;
}

function refundMoney(value: number): string {
  return `₫${new Intl.NumberFormat("vi-VN").format(value)}`;
}

function accessError(error: BookingRepositoryError | null): boolean {
  return Boolean(error && [401, 410].includes(error.status));
}

function JourneyCard({ journey }: { journey: Journey }): ReactElement {
  return (
    <section
      className="cancellation-page__journey"
      aria-label="Hành trình và nhà xe"
    >
      <div className="cancellation-page__section-heading">
        <h2>Hành trình &amp; nhà xe</h2>
        <button type="button">Xem chi tiết</button>
      </div>
      <div className="cancellation-page__operator">
        <span className="cancellation-page__icon-well">
          <img alt="" aria-hidden="true" src={busIcon} />
        </span>
        <div>
          <span>ĐƠN VỊ VẬN HÀNH</span>
          <strong>{journey.operatorName}</strong>
          <small>Mã chuyến {journey.tripCode}</small>
        </div>
      </div>
      <div className="cancellation-page__route">
        <div>
          <strong>{journey.departureTime}</strong>
          <span>{journey.originCity}</span>
          <small>{journey.originStop}</small>
        </div>
        <div className="cancellation-page__timeline" aria-hidden="true">
          <span />
          <span className="cancellation-page__timeline-bus">
            <img alt="" src={timelineBusIcon} />
          </span>
          <span />
          <small>{journey.durationLabel}</small>
        </div>
        <div className="cancellation-page__route-end">
          <strong>{journey.arrivalTime}</strong>
          <span>{journey.destinationCity}</span>
          <small>{journey.destinationStop}</small>
        </div>
      </div>
    </section>
  );
}

function PolicyCard({ policyLabel }: { policyLabel: string }): ReactElement {
  return (
    <section className="cancellation-page__policy">
      <h2>Chính sách hủy vé</h2>
      <div className="cancellation-page__policy-row">
        <img alt="" aria-hidden="true" src={policyIcon} />
        <div>
          <strong>{policyLabel}</strong>
          <small>Từ 24 giờ trở lên &nbsp; | &nbsp; Phí hủy 10%</small>
        </div>
        <button type="button">Xem policy</button>
      </div>
      <div className="cancellation-page__policy-row">
        <img alt="" aria-hidden="true" src={quoteIcon} />
        <div>
          <strong>Kiểm tra số vé và số tiền hoàn trước khi xác nhận</strong>
          <small>
            Chỉ các vé được chọn sẽ bị hủy. Các vé còn lại được giữ nguyên.
          </small>
        </div>
      </div>
    </section>
  );
}

function ConsentNote({
  reviewing,
  seats,
}: {
  reviewing: boolean;
  seats: readonly string[];
}): ReactElement {
  const seatCopy = seats.join(", ");
  return (
    <section className="cancellation-page__consent">
      <img alt="" aria-hidden="true" src={verifiedIcon} />
      <div>
        <strong>
          {reviewing
            ? `Vé ${seatCopy} và mã QR tương ứng sẽ mất hiệu lực khi xác nhận.`
            : "Bạn có thể hủy một vé hoặc chọn cả hai vé trong đặt chỗ."}
        </strong>
        <small>
          {reviewing
            ? `Vé còn lại được giữ nguyên. Số tiền hoàn cho vé đã chọn là ${money(seats.length * 288_000)}.`
            : "Chưa có vé nào bị hủy ở bước này. Bạn sẽ xác nhận ở bước tiếp theo."}
        </small>
      </div>
    </section>
  );
}

function Heading({ confirm = false }: { confirm?: boolean }): ReactElement {
  return (
    <header className="cancellation-page__heading">
      <p>
        Chọn vé cần hủy &nbsp;→&nbsp; Kiểm tra và xác nhận &nbsp;→&nbsp; Kết quả
        hủy
      </p>
      <h1>{confirm ? "Xác nhận hủy vé" : "Chọn vé cần hủy"}</h1>
      <p>
        {confirm
          ? "Kiểm tra vé, chính sách và số tiền hoàn trước khi xác nhận."
          : "Chọn một hoặc nhiều vé trong đặt chỗ này để xem phí hủy và số tiền hoàn."}
      </p>
    </header>
  );
}

function SummaryRoute({
  seats,
  journey,
}: {
  seats: readonly string[];
  journey: Journey;
}): ReactElement {
  return (
    <>
      <section className="cancellation-page__summary-operator">
        <span className="cancellation-page__icon-well">
          <img alt="" aria-hidden="true" src={busIcon} />
        </span>
        <div>
          <span>NHÀ XE VẬN HÀNH</span>
          <strong>{journey.operatorName}</strong>
          <small>Đối tác vận hành · {journey.tripCode}</small>
        </div>
      </section>
      <section className="cancellation-page__summary-route">
        <strong>
          {journey.originCity} → {journey.destinationCity}
        </strong>
        <small>{journey.serviceDateLabel}</small>
        <span>
          {seats.length
            ? `${seats.join(", ")} — ${seats.length === 2 ? "2 hành khách" : seats[0] === "A01" ? "Nguyễn Minh Anh" : "Trần Gia Huy"}`
            : "Chưa chọn vé"}
        </span>
      </section>
    </>
  );
}

function RefundSummary({
  seats,
  amounts,
  journey,
  reviewing,
  isPending,
  onReview,
  onConfirm,
  onKeep,
  reviewTriggerId,
}: {
  seats: readonly string[];
  amounts: RefundAmounts;
  journey: Journey;
  reviewing: boolean;
  isPending?: boolean;
  onReview?: () => void;
  onConfirm?: () => void;
  onKeep: () => void;
  reviewTriggerId?: string;
}): ReactElement {
  return (
    <aside
      className="cancellation-page__summary"
      aria-label="Tóm tắt hoàn tiền"
    >
      <div className="cancellation-page__summary-title">
        <h2>Tóm tắt hoàn tiền</h2>
        <span>09:42</span>
      </div>
      <SummaryRoute seats={seats} journey={journey} />
      <dl className="cancellation-page__amounts">
        <div>
          <dt>Giá trị {seats.length || 0} vé</dt>
          <dd>{money(amounts.fare)}</dd>
        </div>
        <div>
          <dt>Phí hủy 10%</dt>
          <dd>{money(amounts.fee)}</dd>
        </div>
        <div>
          <dt>Bạn sẽ được hoàn</dt>
          <dd>{money(amounts.refund)}</dd>
        </div>
        <div>
          <dt>Hoàn về VNPay</dt>
          <dd>{money(amounts.refund)}</dd>
        </div>
      </dl>
      <section className="cancellation-page__payment-method">
        <span>PHƯƠNG THỨC HOÀN TIỀN</span>
        <strong>Giao dịch VNPay ban đầu</strong>
        <small>Dự kiến 3–7 ngày làm việc</small>
      </section>
      {reviewing ? (
        <div className="cancellation-dialog__actions">
          <Button isLoading={isPending} onClick={onConfirm}>
            Xác nhận hủy {seats.length} vé
          </Button>
          <Dialog.Close asChild>
            <Button variant="secondary" onClick={onKeep}>
              Giữ lại vé
            </Button>
          </Dialog.Close>
        </div>
      ) : (
        <>
          <Button
            disabled={!seats.length}
            id={reviewTriggerId}
            onClick={onReview}
          >
            Xem phí và tiền hoàn
          </Button>
          <Button variant="secondary" onClick={onKeep}>
            Giữ lại vé
          </Button>
        </>
      )}
      <small className="cancellation-page__summary-footnote">
        Không cần Operator phê duyệt khi yêu cầu đủ điều kiện.
      </small>
    </aside>
  );
}

function SelectedTicketsReview({
  tickets,
  phones,
  journey,
}: {
  tickets: readonly TicketDetail[];
  phones: Readonly<Record<string, string>>;
  journey: Journey;
}): ReactElement {
  return (
    <section className="cancellation-page__selected-review">
      <div className="cancellation-page__section-heading">
        <h2>Vé được chọn để hủy</h2>
        <button type="button">Xem chi tiết</button>
      </div>
      <div className="cancellation-page__selected-list">
        {tickets.map((ticket) => (
          <div
            className="cancellation-page__selected-ticket"
            key={ticket.ticketId}
          >
            <span>{ticket.seatCode}</span>
            <img alt="" aria-hidden="true" src={passengerIcon} />
            <strong>{ticket.passenger.fullName}</strong>
            <i />
            <img alt="" aria-hidden="true" src={phoneIcon} />
            <small>{phones[ticket.ticketId]}</small>
          </div>
        ))}
      </div>
      <div className="cancellation-page__pickup">
        <img alt="" aria-hidden="true" src={pickupIcon} />
        <div>
          <strong>{journey.pickupTitle}</strong>
          <small>{journey.pickupAddress}</small>
        </div>
        <span>{journey.checkInLabel}</span>
      </div>
    </section>
  );
}

function SelectionLeft({
  options,
  selected,
  toggle,
}: {
  options: CancellationOptions;
  selected: readonly string[];
  toggle: (id: string) => void;
}): ReactElement {
  const phones = Object.fromEntries(
    options.ticketPresentations.map((item) => [
      item.ticketId,
      item.maskedPhone,
    ]),
  );
  return (
    <main className="cancellation-page__review-panel">
      <JourneyCard journey={options.journey} />
      <CancellationSelector
        tickets={options.tickets}
        selectedIds={selected}
        maskedPhones={phones}
        onToggle={toggle}
      />
      <PolicyCard policyLabel={options.policyLabel} />
      <ConsentNote reviewing={false} seats={[]} />
    </main>
  );
}

function ConfirmationView({
  options,
  chosen,
  amounts,
  mutation,
  close,
  confirm,
}: {
  options: CancellationOptions;
  chosen: readonly TicketDetail[];
  amounts: RefundAmounts;
  mutation: CancellationMutation;
  close: () => void;
  confirm: () => void;
}): ReactElement {
  const phones = Object.fromEntries(
    options.ticketPresentations.map((item) => [
      item.ticketId,
      item.maskedPhone,
    ]),
  );
  const seats = chosen.map((ticket) => ticket.seatCode);
  return (
    <div className="cancellation-page cancellation-page--confirmation">
      <p className="cancellation-dialog__sr-only">
        Mã vé được xác nhận:{" "}
        {chosen.map((ticket) => ticket.ticketCode).join(", ")}
      </p>
      <Heading confirm />
      <div className="cancellation-page__grid">
        <main className="cancellation-page__review-panel">
          <JourneyCard journey={options.journey} />
          <SelectedTicketsReview
            tickets={chosen}
            phones={phones}
            journey={options.journey}
          />
          <PolicyCard policyLabel={options.policyLabel} />
          <ConsentNote reviewing seats={seats} />
        </main>
        <RefundSummary
          seats={seats}
          amounts={amounts}
          journey={options.journey}
          reviewing
          isPending={mutation.isPending}
          onConfirm={confirm}
          onKeep={close}
        />
      </div>
    </div>
  );
}

function RefundProcessing({
  refund,
  journey,
}: {
  refund: Refund;
  journey: Journey;
}): ReactElement {
  const seatCopy = refund.seatCodes.join(", ");
  return (
    <div
      className="cancellation-page cancellation-page--processing"
      aria-live="polite"
    >
      <header className="cancellation-page__processing-heading">
        <p>Hành trình của tôi &nbsp;→&nbsp; Hủy vé &nbsp;→&nbsp; Hoàn tiền</p>
        <h1>Theo dõi hoàn tiền</h1>
      </header>
      <section className="cancellation-page__refund">
        <div className="cancellation-page__refund-brand">
          <strong>BLUE</strong>
          <i />
          <img alt="" aria-hidden="true" src={statusDot} />
          <span>REFUND · TỰ ĐỘNG CẬP NHẬT</span>
          <small>MÃ {refund.referenceCode}</small>
        </div>
        <h2>
          {journey.originCity} → {journey.destinationCity}
        </h2>
        <p>
          {journey.serviceDateLabel.replace("07:30 ngày ", "Thứ Sáu, ")} · Khởi
          hành {journey.departureTime}
        </p>
        <div className="cancellation-page__refund-divider" />
        <div className="cancellation-page__refund-body">
          <div className="cancellation-page__refund-facts">
            <span>CHI TIẾT HOÀN TIỀN</span>
            <dl>
              <div>
                <dt>TRẠNG THÁI</dt>
                <dd>VNPay đang xử lý hoàn tiền</dd>
              </div>
              <div>
                <dt>SỐ TIỀN</dt>
                <dd>{refundMoney(refund.amountVnd)}</dd>
              </div>
              <div>
                <dt>ĐƠN VỊ VẬN HÀNH</dt>
                <dd>{journey.operatorName}</dd>
              </div>
              <div>
                <dt>YÊU CẦU LÚC</dt>
                <dd>{journey.requestedAtLabel}</dd>
              </div>
            </dl>
            <div className="cancellation-page__notice">
              <img alt="" aria-hidden="true" src={processingSafetyIcon} />
              <div>
                <strong>Không gửi lại yêu cầu hủy</strong>
                <small>
                  Vé {seatCopy} đã hủy; hoàn tiền được theo dõi độc lập.
                </small>
              </div>
            </div>
            <p>Bạn có thể rời trang; BLUE sẽ thông báo khi VNPay hoàn tất.</p>
          </div>
          <div className="cancellation-page__progress">
            <span>TIẾN TRÌNH</span>
            <img alt="" aria-hidden="true" src={progressRail} />
            <ol>
              <li>
                <strong>Vé đã hủy</strong>
                <small>Đã ghi nhận lúc {journey.recordedAtLabel}</small>
              </li>
              <li>
                <strong>Đang hoàn tiền</strong>
                <small>VNPay đang xử lý</small>
              </li>
              <li>
                <strong>Thông báo kết quả</strong>
                <small>Tự động khi Refund hoàn tất</small>
              </li>
            </ol>
            <p>Ticket vẫn CANCELLED trong khi Refund đang xử lý.</p>
          </div>
        </div>
      </section>
    </div>
  );
}

function SelectionError({ denied }: { denied: boolean }): ReactElement {
  return (
    <PageState
      title={denied ? "Cần xác thực để hủy vé" : "Chưa thể tải yêu cầu hủy"}
      description="Tra cứu lại vé hoặc thử lại sau."
      action={<Link to={ROUTES.ticketLookup}>Tra cứu vé</Link>}
    />
  );
}

function Selection({
  bookingCode,
  access,
  revoke,
}: SelectionProps): ReactElement {
  const query = useCancellationOptions(bookingCode, access);
  useEffect(() => {
    if (accessError(query.error)) revoke();
  }, [query.error, revoke]);
  if (query.isPending) return <p role="status">Đang tải vé có thể hủy…</p>;
  if (query.isError)
    return <SelectionError denied={accessError(query.error)} />;
  if (query.data.latestRefund)
    return (
      <RefundProcessing
        refund={query.data.latestRefund}
        journey={query.data.journey}
      />
    );
  if (!query.data.tickets.length)
    return (
      <PageState
        title="Không còn vé có thể hủy"
        description="Các vé trong đặt chỗ này đã được hủy hoặc không còn đủ điều kiện."
        action={<Link to={ROUTES.accountTickets}>Xem lịch sử vé</Link>}
      />
    );
  return (
    <CancellationForm
      bookingCode={bookingCode}
      access={access}
      options={query.data}
    />
  );
}

function CancellationForm({
  bookingCode,
  access,
  options,
}: FormProps): ReactElement {
  const reviewTriggerId = "cancellation-review-trigger";
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const submittedRef = useRef(false);
  const keyRef = useRef<string | null>(null);
  const mutation = useCreateCancellation(bookingCode, access);
  const chosen = options.tickets.filter((ticket) =>
    selected.includes(ticket.ticketId),
  );
  const amounts = useMemo<RefundAmounts>(() => {
    const fare = chosen.reduce((total, ticket) => total + ticket.fareVnd, 0);
    const fee = Math.round(fare * (options.feeRatePercent / 100));
    return { fare, fee, refund: fare - fee };
  }, [chosen, options.feeRatePercent]);
  useEffect(() => {
    if (mutation.isError) submittedRef.current = false;
  }, [mutation.isError]);
  const toggle = (id: string): void =>
    setSelected((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  const confirm = (): void => {
    if (submittedRef.current || mutation.isPending || selected.length === 0)
      return;
    submittedRef.current = true;
    keyRef.current ??= crypto.randomUUID();
    mutation.mutate({ ticketIds: selected, key: keyRef.current });
  };
  if (mutation.data)
    return (
      <RefundProcessing refund={mutation.data} journey={options.journey} />
    );
  const seats = chosen.map((ticket) => ticket.seatCode);
  return (
    <>
      <Heading />
      <div className="cancellation-page__grid">
        <SelectionLeft options={options} selected={selected} toggle={toggle} />
        <RefundSummary
          seats={seats}
          amounts={amounts}
          journey={options.journey}
          reviewing={false}
          onReview={() => setDialogOpen(true)}
          onKeep={() => setSelected([])}
          reviewTriggerId={reviewTriggerId}
        />
      </div>
      {mutation.isError ? (
        <p role="alert">
          Không thể hủy các vé đã chọn. Kiểm tra trạng thái vé rồi thử lại.
        </p>
      ) : null}
      <CancellationConfirmDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        returnFocusId={reviewTriggerId}
      >
        <ConfirmationView
          options={options}
          chosen={chosen}
          amounts={amounts}
          mutation={mutation}
          close={() => setDialogOpen(false)}
          confirm={confirm}
        />
      </CancellationConfirmDialog>
    </>
  );
}

function resolveAccess(
  account: MockSession | null,
  guest: TicketAccess | null,
): CancellationAccess | null {
  if (account?.role === "customer" && account.token)
    return { kind: "account", token: account.token };
  return guest ? { kind: "guest", token: guest.token } : null;
}

function InvalidBooking(): ReactElement {
  return (
    <PageState
      title="Hủy vé"
      description="Kiểm tra đường dẫn và tra cứu vé lại."
      action={<Link to={ROUTES.ticketLookup}>Tra cứu vé</Link>}
    />
  );
}

export function CancellationPage(): ReactElement {
  const { bookingCode } = useParams();
  const guest = useTicketAccess();
  const account = useAccountSession();
  if (!guest.isHydrated || !account.isHydrated)
    return <p role="status">Đang kiểm tra quyền hủy vé…</p>;
  const parsed = ticketCodeSchema.safeParse(bookingCode?.toUpperCase());
  if (!parsed.success) return <InvalidBooking />;
  const access = resolveAccess(account.session, guest.access);
  if (!access)
    return (
      <PageState
        title="Cần xác thực để hủy vé"
        description="Tra cứu vé hoặc đăng nhập tài khoản sở hữu vé để tiếp tục."
        action={<Link to={ROUTES.ticketLookup}>Tra cứu vé</Link>}
      />
    );
  return (
    <section className="cancellation-page">
      <Selection
        bookingCode={parsed.data}
        access={access}
        revoke={access.kind === "account" ? account.revoke : guest.revoke}
      />
    </section>
  );
}
