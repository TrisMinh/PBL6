import { TicketLookupForm } from "../components/TicketLookupForm";
import type { LookupInput } from "../types/ticketAccess";
import { normalizeVerification } from "../schemas/ticket.schema";
/** Authenticated ticket lookup in live mode. Search is limited to the signed-in customer's own tickets and bookings. */
import { useMutation } from "@tanstack/react-query";
import { useState, type ReactElement } from "react";
import { Link, useLocation } from "react-router";
import { apiJson } from "@/shared/api/client";
import {
  backendTicketSchema,
  bookingSchema,
  pageOf,
} from "@/shared/api/contracts";
import { useAccountSession } from "@/features/auth/hooks/useAccountSession";
import { Toast } from "@/shared/ui/Toast/Toast";
import { TicketLookupLayout } from "./TicketLookupPage";
import { ArrowRight } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { stateLabel } from "@/shared/api/livePresentation";

type Match = {
  id: string;
  publicCode: string;
  passengerName: string;
  status: string;
  bookingId: string;
};

export function BackendTicketLookupPage(): ReactElement {
  const { session, isHydrated } = useAccountSession();
  const location = useLocation();
  const [needsLogin, setNeedsLogin] = useState(false);
  const mutation = useMutation({
    mutationFn: async (input: LookupInput): Promise<Match[]> => {
      const key = input.bookingCode.trim().toUpperCase();
      const contact = normalizeVerification(input.verificationValue);
      const verify = async (matches: Match[]): Promise<Match[]> => {
        const bookings = await Promise.all(
          [...new Set(matches.map((m) => m.bookingId))].map((id) =>
            apiJson(`/api/v1/bookings/${id}`, bookingSchema),
          ),
        );
        const authorized = new Set(
          bookings
            .filter(
              (b) =>
                normalizeVerification(b.contact.email) === contact ||
                normalizeVerification(b.contact.phone) === contact,
            )
            .map((b) => b.id),
        );
        return matches.filter((m) => authorized.has(m.bookingId));
      };
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
              bookingId: t.bookingId,
              publicCode: t.publicCode,
              passengerName: t.passengerName,
              status: t.status,
            })),
        );
        if (page + 1 >= result.totalPages || matches.length) break;
      }
      if (matches.length) return verify(matches);
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
              bookingId: t.bookingId,
              publicCode: t.publicCode,
              passengerName: t.passengerName,
              status: t.status,
            })),
        );
        if (page + 1 >= result.totalPages) break;
      }
      return verify(matches);
    },
    retry: false,
  });
  return (
    <TicketLookupLayout>
      {!isHydrated ? (
        <p role="status">Đang kiểm tra phiên đăng nhập…</p>
      ) : !session ? (
        <>
          <TicketLookupForm
            live
            isPending={false}
            onSubmit={() => setNeedsLogin(true)}
          />
          {needsLogin && (
            <Toast
              tone="error"
              message="Vui lòng đăng nhập tài khoản đã đặt vé để tiếp tục tra cứu."
            />
          )}
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
          <TicketLookupForm
            live
            isPending={mutation.isPending}
            onSubmit={(input) => mutation.mutate(input)}
          />
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
