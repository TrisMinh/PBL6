/** Authenticated ticket lookup in live mode. Search is limited to the signed-in customer's own tickets and bookings. */
import { useMutation } from "@tanstack/react-query";
import { useState, type FormEvent, type ReactElement } from "react";
import { Link, useLocation } from "react-router";
import { lookupOwnedTickets } from "../repositories/backendTicketRepository";
import { ApiFailure } from "@/shared/api/ResourcePage";
import { useAccountSession } from "@/features/auth/hooks/useAccountSession";
import { Button } from "@/shared/ui/Button/Button";

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
      return lookupOwnedTickets(key);
    },
    retry: false,
  });
  return (
    <section className="live-api">
      <h1>Tra cứu vé</h1>
      {!isHydrated ? (
        <p role="status">Đang kiểm tra phiên đăng nhập…</p>
      ) : !session ? (
        <>
          <p>
            Để bảo vệ thông tin hành khách, vui lòng đăng nhập tài khoản đã đặt
            vé trước khi tra cứu.
          </p>
          <Link to={`/login?redirect=${encodeURIComponent(location.pathname)}`}>
            Đăng nhập để tra cứu
          </Link>
        </>
      ) : (
        <>
          <p>Nhập mã vé hoặc mã đặt chỗ thuộc tài khoản của bạn.</p>
          <form
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              mutation.mutate(code);
            }}
          >
            <label>
              Mã vé / mã đơn
              <input
                required
                maxLength={80}
                value={code}
                onChange={(event) => setCode(event.target.value)}
                autoComplete="off"
              />
            </label>
            <Button type="submit" isLoading={mutation.isPending}>
              Tra cứu
            </Button>
          </form>
          {mutation.isError && <ApiFailure error={mutation.error} popup />}
          {mutation.isSuccess &&
            (mutation.data.length ? (
              <ul>
                {mutation.data.map((ticket) => (
                  <li key={ticket.id}>
                    <Link to={`/tickets/${encodeURIComponent(ticket.id)}`}>
                      {ticket.publicCode}
                    </Link>{" "}
                    — {ticket.passengerName} — {ticket.status}
                  </li>
                ))}
              </ul>
            ) : (
              <p role="status">
                Không tìm thấy vé hoặc đơn phù hợp trong tài khoản.
              </p>
            ))}
        </>
      )}
    </section>
  );
}
