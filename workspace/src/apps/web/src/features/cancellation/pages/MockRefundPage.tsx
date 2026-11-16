import { BrandLoading } from "@/shared/ui/BrandLogo/BrandLoading";
import { useState, type ReactElement } from "react";
import { Link, useParams } from "react-router";
import { useMockSession } from "@/features/auth/hooks/useMockSession";
import { useCancellationOptions } from "@/features/cancellation/hooks/useCancellation";
import { mockDb } from "@/mocks/state/mockDb";
import type { Refund } from "@/features/cancellation/types/cancellation";
import { RefundProcessing } from "./CancellationPage";
import { PageState } from "@/shared/ui/PageState/PageState";
import { Button } from "@/shared/ui/Button/Button";

function RefundDetail({
  refund,
  token,
}: {
  refund: Refund;
  token: string;
}): ReactElement {
  const query = useCancellationOptions(refund.bookingCode, {
    kind: "account",
    token,
  });
  if (query.isPending)
    return <BrandLoading compact title="Đang tải yêu cầu hoàn tiền…" />;
  if (query.isError)
    return (
      <PageState
        title="Không thể tải yêu cầu hoàn tiền"
        description="Yêu cầu không thuộc tài khoản này hoặc phiên đã hết hạn."
        action={<Button onClick={() => void query.refetch()}>Thử lại</Button>}
      />
    );
  return (
    <>
      <RefundProcessing refund={refund} journey={query.data.journey} />
      <p className="guard-state">
        <Link to="/account/tickets">Về vé của tôi</Link>
      </p>
    </>
  );
}
export function MockRefundPage(): ReactElement {
  const { refundId } = useParams();
  const { session, isHydrated } = useMockSession();
  const [refund] = useState(() => {
    mockDb.hydrate(Date.now());
    return mockDb.refunds.get(refundId ?? "");
  });
  if (!isHydrated)
    return <BrandLoading compact title="Đang kiểm tra phiên đăng nhập…" />;
  if (!session?.token)
    return (
      <PageState
        title="Đăng nhập để theo dõi hoàn tiền"
        description="Yêu cầu hoàn tiền được bảo vệ trong tài khoản của bạn."
        action={
          <Link to="/login" state={{ from: `/refunds/${refundId}` }}>
            Đăng nhập
          </Link>
        }
      />
    );
  if (!refund)
    return (
      <PageState
        title="Không tìm thấy yêu cầu hoàn tiền"
        description="Kiểm tra mã yêu cầu hoặc mở yêu cầu từ vé đã hủy."
        action={<Link to="/account/tickets">Vé của tôi</Link>}
      />
    );
  return <RefundDetail refund={refund} token={session.token} />;
}
