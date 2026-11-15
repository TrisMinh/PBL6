import type { ReactElement } from "react";
import { Link } from "react-router";
import { Ticket } from "@phosphor-icons/react/dist/csr/Ticket";
import { ShieldCheck } from "@phosphor-icons/react/dist/csr/ShieldCheck";
import { EnvelopeSimple } from "@phosphor-icons/react/dist/csr/EnvelopeSimple";
import { ArrowRight } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { Headset } from "@phosphor-icons/react/dist/csr/Headset";
import journeyImage from "@/assets/auth/scenic-bus.png";
import { Toast } from "@/shared/ui/Toast/Toast";
import { ROUTES } from "@/shared/config/routes";
import { TicketLookupForm } from "@/features/tickets/components/TicketLookupForm";
import { useLookupTickets } from "@/features/tickets/hooks/useLookupTickets";
import "./TicketPage.css";
import "./TicketLookupPage.css";

export function TicketLookupPage(): ReactElement {
  const lookup = useLookupTickets();
  return (
    <div className="ticket-page ticket-page--lookup">
      <div className="ticket-lookup-shell">
        <aside
          className="ticket-lookup-visual"
          aria-label="Hành trình cùng BLUE"
        >
          <img
            className="ticket-lookup-visual__image"
            src={journeyImage}
            alt="Xe khách trên cung đường núi xanh"
            width={1536}
            height={1024}
          />
          <div className="ticket-lookup-visual__copy">
            <span className="ticket-lookup-visual__eyebrow">
              <Ticket size={18} aria-hidden /> VÉ ĐIỆN TỬ BLUE
            </span>
            <h2>
              Vé đã đặt.
              <br />
              Hành trình trong tay.
            </h2>
            <p>Mọi thông tin chuyến đi, chỉ một lần tra cứu.</p>
          </div>
          <div className="ticket-lookup-visual__ticket">
            <span className="ticket-lookup-visual__ticket-icon">
              <Ticket size={28} weight="duotone" aria-hidden />
            </span>
            <div>
              <strong>Sẵn sàng cho chuyến đi</strong>
              <span>Xem lịch khởi hành, ghế và điểm đón.</span>
            </div>
          </div>
        </aside>
        <section className="ticket-lookup" aria-label="Tra cứu đặt vé">
          <header className="ticket-lookup__heading">
            <span className="ticket-lookup__symbol">
              <Ticket size={26} weight="duotone" aria-hidden />
            </span>
            <h1>Tra cứu vé</h1>
            <p>Nhập thông tin đặt vé để mở vé điện tử của bạn.</p>
          </header>
          {lookup.error && (
            <Toast
              tone="error"
              message={
                lookup.error.code === "NOT_FOUND"
                  ? "Không tìm thấy vé phù hợp. Kiểm tra thông tin và tra cứu lại."
                  : lookup.error.code === "STORAGE_UNAVAILABLE"
                    ? "Chưa thể lưu phiên tra cứu. Cho phép lưu dữ liệu trong tab rồi thử lại."
                    : "Chưa thể tra cứu. Kiểm tra kết nối và thử lại."
              }
            />
          )}
          <TicketLookupForm
            isPending={lookup.isPending}
            onSubmit={lookup.submit}
          />
          <p className="ticket-lookup__privacy">
            <ShieldCheck size={19} aria-hidden />
            <span>
              Thông tin đặt vé chỉ dùng để xác thực và không hiển thị trên đường
              dẫn.
            </span>
          </p>
          <Link className="ticket-lookup__support" to="/contact">
            <Headset size={18} aria-hidden /> Cần hỗ trợ tra cứu?{" "}
            <ArrowRight size={16} aria-hidden />
          </Link>
        </section>
      </div>
      <div className="ticket-lookup-help">
        <section>
          <span className="ticket-lookup-help__icon">
            <EnvelopeSimple size={22} weight="duotone" aria-hidden />
          </span>
          <div>
            <h2>Tìm mã đặt vé ở đâu?</h2>
            <p>
              Mã BLUE nằm trong xác nhận đặt vé và phần chi tiết đơn của bạn.
            </p>
          </div>
        </section>
        <section className="ticket-lookup-help__account">
          <span className="ticket-lookup-help__icon">
            <Ticket size={22} weight="duotone" aria-hidden />
          </span>
          <div>
            <h2>Đã đặt vé bằng tài khoản?</h2>
            <p>Xem lại vé điện tử và các chuyến đã đặt.</p>
          </div>
          <Link
            className="ticket-lookup-help__tickets-button"
            to={ROUTES.accountTickets}
          >
            Vé của tôi <ArrowRight size={16} aria-hidden />
          </Link>
        </section>
      </div>
    </div>
  );
}
