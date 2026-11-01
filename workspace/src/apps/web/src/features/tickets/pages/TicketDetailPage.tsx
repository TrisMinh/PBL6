import { useEffect, type ReactElement } from "react";
import { Link, useParams } from "react-router";

import { TicketCard } from "@/features/tickets/components/TicketCard/TicketCard";
import type { BookingRepositoryError } from "@/features/booking/repositories/bookingRepositoryError";
import { useTicketAccess } from "@/features/tickets/hooks/useTicketAccess";
import { useTicketDetail } from "@/features/tickets/hooks/useTicketDetail";
import { useAccountSession } from "@/features/auth/hooks/useAccountSession";
import type { MockSession } from "@/features/auth/types/auth";
import { useAccountTicketDetail } from "@/features/tickets/hooks/useAccountTickets";
import { ticketCodeSchema } from "@/features/tickets/schemas/ticket.schema";
import type { TicketAccess } from "@/features/tickets/types/ticketAccess";
import { ROUTES } from "@/shared/config/routes";
import { Button } from "@/shared/ui/Button/Button";
import { PageState } from "@/shared/ui/PageState/PageState";

import "./TicketPage.css";

function AccessRequired(): ReactElement {
  return (
    <PageState
      title="Cần xác thực để xem vé"
      description="Phiên tra cứu chưa có hoặc đã hết hạn. Tra cứu lại bằng thông tin đã đặt vé."
      action={<Link to={ROUTES.ticketLookup}>Tra cứu vé</Link>}
    />
  );
}
function isAccessDenied(error: BookingRepositoryError | null): boolean {
  return error !== null && [401, 410].includes(error.status);
}
function DetailError({
  error,
  onRetry,
}: {
  error: BookingRepositoryError;
  onRetry: () => void;
}): ReactElement {
  if (isAccessDenied(error)) return <AccessRequired />;
  const missing = error.code === "NOT_FOUND";
  return (
    <PageState
      title={missing ? "Không tìm thấy vé" : "Chưa thể tải vé"}
      description="Tra cứu lại hoặc kiểm tra kết nối và thử lại."
      action={
        missing ? (
          <Link to={ROUTES.ticketLookup}>Tra cứu vé</Link>
        ) : (
          <Button type="button" onClick={onRetry}>
            Thử lại
          </Button>
        )
      }
    />
  );
}
function TicketContent({
  code,
  access,
  revoke,
}: {
  code: string;
  access: TicketAccess;
  revoke: () => void;
}): ReactElement {
  const query = useTicketDetail(code, access);
  useEffect(() => {
    if (isAccessDenied(query.error)) revoke();
  }, [query.error, revoke]);
  if (query.isPending)
    return (
      <section>
        <h1>Vé điện tử</h1>
        <p role="status">Đang tải vé…</p>
      </section>
    );
  if (query.isError)
    return (
      <DetailError error={query.error} onRetry={() => void query.refetch()} />
    );
  return (
    <>
      <header className="ticket-page__heading">
        <nav className="ticket-page__breadcrumb" aria-label="Đường dẫn">
          <Link to={ROUTES.home}>Trang chủ</Link>
          <span aria-hidden="true">/</span>
          <Link to={ROUTES.ticketLookup}>Vé của tôi</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Chi tiết vé</span>
        </nav>
        <h1>Vé điện tử</h1>
        <p>Thông tin vé đã xác thực trong phiên tra cứu hiện tại.</p>
      </header>
      <TicketCard ticket={query.data} ticketCodes={access.ticketCodes} />
    </>
  );
}
export function TicketDetailPage(): ReactElement {
  const { ticketCode } = useParams(),
    access = useTicketAccess(),
    account = useAccountSession();
  if (!access.isHydrated || !account.isHydrated)
    return (
      <div className="ticket-page">
        <h1>Chi tiết vé</h1>
        <p role="status">Đang kiểm tra quyền xem vé…</p>
      </div>
    );
  return (
    <TicketDetailBody
      ticketCode={ticketCode}
      access={access.access}
      account={account.session}
      revokeAccess={access.revoke}
      revokeAccount={account.revoke}
    />
  );
}
function TicketDetailBody({
  ticketCode,
  access,
  account,
  revokeAccess,
  revokeAccount,
}: {
  ticketCode: string | undefined;
  access: TicketAccess | null;
  account: MockSession | null;
  revokeAccess: () => void;
  revokeAccount: () => void;
}): ReactElement {
  if (
    account?.token &&
    account.role === "customer" &&
    ticketCodeSchema.safeParse(ticketCode).success
  )
    return (
      <div className="ticket-page">
        <AccountContent
          code={ticketCode ?? ""}
          session={account}
          revoke={revokeAccount}
        />
      </div>
    );
  return (
    <GuestTicketDetail
      ticketCode={ticketCode}
      access={access}
      revoke={revokeAccess}
    />
  );
}
function GuestTicketDetail({
  ticketCode,
  access,
  revoke,
}: {
  ticketCode: string | undefined;
  access: TicketAccess | null;
  revoke: () => void;
}): ReactElement {
  if (!access)
    return (
      <div className="ticket-page">
        <AccessRequired />
      </div>
    );
  const parsed = ticketCodeSchema.safeParse(ticketCode);
  if (!parsed.success || !access.ticketCodes.includes(parsed.data))
    return (
      <div className="ticket-page">
        <PageState
          title="Không tìm thấy vé"
          description="Vé chưa có trong phiên tra cứu này. Hãy tra cứu lại."
          action={<Link to={ROUTES.ticketLookup}>Tra cứu vé</Link>}
        />
      </div>
    );
  return (
    <div className="ticket-page">
      <TicketContent code={parsed.data} access={access} revoke={revoke} />
    </div>
  );
}
function AccountContent({
  code,
  session,
  revoke,
}: {
  code: string;
  session: MockSession;
  revoke: () => void;
}): ReactElement {
  const query = useAccountTicketDetail(code, session);
  useEffect(() => {
    if (isAccessDenied(query.error)) revoke();
  }, [query.error, revoke]);
  if (query.isPending)
    return (
      <section>
        <h1>Vé điện tử</h1>
        <p role="status">Đang tải vé…</p>
      </section>
    );
  if (query.isError)
    return (
      <DetailError error={query.error} onRetry={() => void query.refetch()} />
    );
  return (
    <>
      <h1>Vé điện tử</h1>
      <TicketCard ticket={query.data} ticketCodes={[query.data.ticketCode]} />
      <Link to={ROUTES.accountTickets}>Về vé của tôi</Link>
    </>
  );
}
