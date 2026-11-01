import type { ReactElement } from "react";

import { TicketLookupForm } from "@/features/tickets/components/TicketLookupForm";
import { useLookupTickets } from "@/features/tickets/hooks/useLookupTickets";

import "./TicketPage.css";

export function TicketLookupPage(): ReactElement {
  const lookup = useLookupTickets();
  return (
    <div className="ticket-page ticket-page--lookup">
      <header className="ticket-page__heading">
        <h1>Tra cứu vé</h1>
        <p>Xác thực thông tin đặt vé để xem vé điện tử của bạn.</p>
      </header>
      <section className="ticket-lookup" aria-label="Tra cứu đặt vé">
        {lookup.error && (
          <p role="alert" className="ticket-page__error">
            {lookup.error.code === "NOT_FOUND"
              ? "Không tìm thấy vé phù hợp. Kiểm tra thông tin và tra cứu lại."
              : lookup.error.code === "STORAGE_UNAVAILABLE"
                ? "Chưa thể lưu phiên tra cứu. Cho phép lưu dữ liệu trong tab rồi thử lại."
                : "Chưa thể tra cứu. Kiểm tra kết nối và thử lại."}
          </p>
        )}
        <TicketLookupForm
          isPending={lookup.isPending}
          onSubmit={lookup.submit}
        />
        <p className="ticket-lookup__privacy">
          Thông tin xác thực chỉ được gửi khi tra cứu và không xuất hiện trên
          đường dẫn.
        </p>
      </section>
    </div>
  );
}
