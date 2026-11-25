import { BrandLoading } from "@/shared/ui/BrandLogo/BrandLoading";
import { useQuery } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { Link, useParams } from "react-router";
import { z } from "zod";
import { apiJson } from "@/shared/api/client";
import { readApiSession } from "@/shared/api/session";
import { ApiFailure } from "@/shared/api/ResourcePage";
import {
  isRefundPending,
  REFUND_REFRESH_INTERVAL_MS,
  refundSchema,
} from "../schemas/liveRefund";
import { RefundStatusCard } from "../components/RefundStatusCard";
import "./CancellationPage.css";
import "./LiveRefundPage.css";

export function LiveRefundPage(): ReactElement {
  const { refundId = "" } = useParams();
  const session = readApiSession();
  const valid = z.guid().safeParse(refundId).success;
  const query = useQuery({
    queryKey: ["live-api", session?.user.id, "customer-refund", refundId],
    enabled: !!session && valid,
    queryFn: ({ signal }) =>
      apiJson(`/api/v1/refunds/${encodeURIComponent(refundId)}`, refundSchema, {
        signal,
      }),
    refetchInterval: (q) =>
      isRefundPending(q.state.data?.status)
        ? REFUND_REFRESH_INTERVAL_MS
        : false,
    refetchIntervalInBackground: true,
    staleTime: 0,
    retry: false,
  });
  if (!valid)
    return (
      <section className="cancellation-page">
        <h1>Theo dõi hoàn tiền</h1>
        <p role="alert">Mã hoàn tiền không hợp lệ.</p>
      </section>
    );
  if (!session)
    return (
      <section className="cancellation-page">
        <h1>Theo dõi hoàn tiền</h1>
        <p>Đăng nhập tài khoản sở hữu đơn để xem thông tin hoàn tiền.</p>
        <Link to="/login" state={{ from: `/refunds/${refundId}` }}>
          Đăng nhập
        </Link>
      </section>
    );
  if (query.isPending)
    return (
      <section className="cancellation-page">
        <BrandLoading compact title="Đang tải thông tin hoàn tiền…" />
      </section>
    );
  if (!query.data)
    return (
      <section className="cancellation-page">
        <h1>Theo dõi hoàn tiền</h1>
        <ApiFailure error={query.error} retry={() => void query.refetch()} />
      </section>
    );
  return (
    <div className="cancellation-page cancellation-page--processing live-refund-page">
      <header className="cancellation-page__processing-heading">
        <p>
          <Link to="/account/tickets">Hành trình của tôi</Link> → Hủy vé → Hoàn
          tiền
        </p>
        <h1>Theo dõi hoàn tiền</h1>
      </header>
      <RefundStatusCard refund={query.data} />
    </div>
  );
}
