import type { ReactElement } from "react";
import { Toast } from "@/shared/ui/Toast/Toast";
import { Link, useSearchParams } from "react-router";

import type { BookingRepositoryError } from "@/features/booking/repositories/bookingRepositoryError";
import {
  PaymentResultCard,
  type PaymentResultView,
} from "@/features/payment/components/PaymentResultCard";
import { usePaymentReturn } from "@/features/payment/hooks/usePaymentReturn";
import { paymentReturnQuerySchema } from "@/features/payment/schemas/payment.schema";
import type { PaymentStatus } from "@/features/payment/types/payment";
import { ROUTES } from "@/shared/config/routes";
import { Button } from "@/shared/ui/Button/Button";
import { PageState } from "@/shared/ui/PageState/PageState";

import "./PaymentPage.css";

const EXPIRED_RESULTS_PATH =
  ROUTES.trips + "?" + new URLSearchParams({ reason: "expired" }).toString();
const HEADINGS: Record<PaymentStatus, string> = {
  success: "Thanh toán thành công",
  failed: "Thanh toán chưa thành công",
  cancelled: "Đã hủy thanh toán",
  pending: "Thanh toán đang chờ xác nhận",
};
interface ErrorProps {
  error: BookingRepositoryError;
  isFetching: boolean;
  onRecheck: () => void;
}
function ReturnError(props: ErrorProps): ReactElement {
  const missing = props.error.code === "NOT_FOUND",
    expired = props.error.code === "HOLD_EXPIRED";
  const title = missing
    ? "Không tìm thấy giao dịch"
    : expired
      ? "Phiên thanh toán đã hết hạn"
      : "Chưa thể kiểm tra giao dịch";
  const description = expired
    ? "Vui lòng tìm lại chuyến để bắt đầu."
    : "Kiểm tra kết nối và thử lại. Thông tin đặt vé được giữ nguyên.";
  return (
    <PageState
      title={title}
      description={description}
      action={
        missing ? (
          <Link to={ROUTES.home}>Về trang chủ</Link>
        ) : expired ? (
          <Link to={EXPIRED_RESULTS_PATH}>Tìm lại chuyến</Link>
        ) : (
          <Button
            type="button"
            isLoading={props.isFetching}
            onClick={props.onRecheck}
          >
            Kiểm tra lại
          </Button>
        )
      }
    />
  );
}
function ResolvedReturn({
  transactionId,
  resultId,
}: {
  transactionId: string;
  resultId: string;
}): ReactElement {
  const query = usePaymentReturn(transactionId, resultId);
  if (query.isPending)
    return (
      <section>
        <h1>Xác nhận thanh toán</h1>
        <p role="status">Đang kiểm tra giao dịch và vé…</p>
      </section>
    );
  if (query.isError)
    return (
      <ReturnError
        error={query.error}
        isFetching={query.isFetching}
        onRecheck={() => void query.refetch()}
      />
    );
  return (
    <PaymentResultContent
      result={query.data}
      isFetching={query.isFetching}
      onRecheck={() => void query.refetch()}
    />
  );
}

export function PaymentResultContent({
  result,
  isFetching,
  onRecheck,
}: {
  result: PaymentResultView;
  isFetching: boolean;
  onRecheck: () => void;
}): ReactElement {
  return (
    <>
      <header className="payment-page__heading">
        <nav className="payment-page__breadcrumb" aria-label="Đường dẫn">
          <Link to={ROUTES.home}>Trang chủ</Link>
          <span aria-hidden="true">/</span>
          <span>Thanh toán</span>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Xác nhận</span>
        </nav>
        <h1>{HEADINGS[result.status]}</h1>
        <p role="status">
          {result.status === "success"
            ? "Vé điện tử đã sẵn sàng cho hành trình của bạn."
            : "Theo dõi kết quả giao dịch và lựa chọn bước tiếp theo."}
        </p>
      </header>
      {result.status === "success" && (
        <Toast
          tone="success"
          message="Thanh toán thành công. Vé của bạn đã được phát hành."
        />
      )}
      <PaymentResultCard
        result={result}
        isFetching={isFetching}
        onRecheck={onRecheck}
      />
    </>
  );
}

export function VnPayReturnPage(): ReactElement {
  const [params] = useSearchParams(),
    entries = [...params.entries()];
  const parsed = paymentReturnQuerySchema.safeParse(
    Object.fromEntries(entries),
  );
  const isValid = parsed.success && entries.length === 2;
  return (
    <div className="payment-page payment-page--return">
      {isValid ? (
        <ResolvedReturn
          transactionId={parsed.data.transactionId}
          resultId={parsed.data.resultId}
        />
      ) : (
        <PageState
          title="Không thể xác nhận giao dịch"
          description="Thông tin quay lại chưa hợp lệ. Vui lòng về trang chủ để kiểm tra."
          action={<Link to={ROUTES.home}>Về trang chủ</Link>}
        />
      )}
    </div>
  );
}
