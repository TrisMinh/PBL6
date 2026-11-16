/** Authenticated ticket lookup in live mode. Search is limited to the signed-in customer's own tickets and bookings. */
import { useMutation } from "@tanstack/react-query";
import { useState, type FormEvent, type ReactElement } from "react";
import { Link, useLocation } from "react-router";
import { apiJson } from "@/shared/api/client";
import {
  backendTicketSchema,
  bookingSchema,
  pageOf,
} from "@/shared/api/contracts";
import { useAccountSession } from "@/features/auth/hooks/useAccountSession";
import { Button } from "@/shared/ui/Button/Button";
import { Input } from "@/shared/ui/Input/Input";
import { Toast } from "@/shared/ui/Toast/Toast";
import { TicketLookupLayout } from "./TicketLookupPage";
import { ArrowRight } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { stateLabel } from "@/shared/api/livePresentation";

type Match = {
  id: string;
  publicCode: string;
  passengerName: string;
  status: string;
};

export function BackendTicketLookupPage(): ReactElement {
  const { session, isHydrated } = useAccountSession();
  const location = useLocation();
  const [code, setCode] = useState("");
  const mutation = useMutation({
    mutationFn: async (lookupCode: string): Promise<Match[]> => {
      const key = lookupCode.trim().toUpperCase();
      if (!key || key.length > 80)
        throw new Error("Vui lòng nhập mã vé hoặc mã đặt chỗ hợp lệ.");
      // The backend intentionally does not expose a public lookup by phone/email.
      // Fetch only resources authorized for the current user; do not leak other customers' data.
      const matches: Match[] = [];
      for (let page = 0; page < 100; page++) {
        const result = await apiJson(
          `/api/v1/tickets?page=${page}&size=100`,
          pageOf(backendTicketSchema),
        );
        matches.push(
          ...result.items
            .filter((t) => t.publicCode.toUpperCase() === key)
            .map((t) => ({
              id: t.id,
              publicCode: t.publicCode,
              passengerName: t.passengerName,
              status: t.status,
            })),
        );
        if (page + 1 >= result.totalPages || matches.length) break;
      }
      if (matches.length) return matches;
      // A booking code can also be entered; lookup returns its tickets owned by this account.
      let bookingId = "";
      for (let page = 0; page < 100; page++) {
        const result = await apiJson(
          `/api/v1/bookings?page=${page}&size=100`,
          pageOf(bookingSchema),
        );
        const booking = result.items.find(
          (item) => item.code.toUpperCase() === key,
        );
        if (booking) {
          bookingId = booking.id;
          break;
        }
        if (page + 1 >= result.totalPages) break;
      }
      if (!bookingId) return [];
      for (let page = 0; page < 100; page++) {
        const result = await apiJson(
          `/api/v1/tickets?page=${page}&size=100`,
          pageOf(backendTicketSchema),
        );
        matches.push(
          ...result.items
            .filter((t) => t.bookingId === bookingId)
            .map((t) => ({
              id: t.id,
              publicCode: t.publicCode,
              passengerName: t.passengerName,
              status: t.status,
            })),
        );
        if (page + 1 >= result.totalPages) break;
      }
      return matches;
    },
    retry: false,
  });
  return (
    <TicketLookupLayout>
      {!isHydrated ? (
        <p role="status">Đang kiểm tra phiên đăng nhập…</p>
      ) : !session ? (
        <>
          <p className="ticket-lookup__live-note">
            Để bảo vệ thông tin hành khách, vui lòng đăng nhập tài khoản đã đặt
            vé trước khi tra cứu.
          </p>
          <Link
            className="button button--primary ticket-lookup__login"
            to="/login"
            state={{ from: location.pathname }}
          >
            Đăng nhập để tra cứu <ArrowRight size={18} aria-hidden />
          </Link>
        </>
      ) : (
        <>
          <p className="ticket-lookup__live-note">
            Nhập mã vé hoặc mã đặt chỗ thuộc tài khoản của bạn.
          </p>
          <form
            className="ticket-lookup__live-form"
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              mutation.mutate(code);
            }}
          >
            <Input
              label="Mã vé hoặc mã đặt vé"
              placeholder="Ví dụ: TK… hoặc BK…"
              required
              maxLength={80}
              value={code}
              onChange={(event) => setCode(event.target.value)}
              autoComplete="off"
            />
            <Button type="submit" isLoading={mutation.isPending}>
              Tra cứu vé <ArrowRight size={18} aria-hidden />
            </Button>
          </form>
          {mutation.isError && (
            <Toast tone="error" message={mutation.error.message} />
          )}
          {mutation.isSuccess &&
            (mutation.data.length ? (
              <ul className="ticket-lookup__matches">
                {mutation.data.map((ticket) => (
                  <li key={ticket.id}>
                    <div>
                      <strong>{ticket.passengerName}</strong>
                      <span>
                        {ticket.publicCode} · {stateLabel(ticket.status)}
                      </span>
                    </div>
                    <Link
                      className="button button--primary"
                      to={`/tickets/${encodeURIComponent(ticket.id)}`}
                    >
                      Xem vé <ArrowRight size={16} aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <Toast
                tone="error"
                message="Không tìm thấy vé hoặc đơn phù hợp trong tài khoản. Kiểm tra mã và thử lại."
              />
            ))}
        </>
      )}
    </TicketLookupLayout>
  );
}
