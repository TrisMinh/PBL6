import { useState, type ReactElement } from "react";
import { Link, useNavigate } from "react-router";
import { LockKey } from "@phosphor-icons/react/dist/csr/LockKey";
import { ArrowLeft } from "@phosphor-icons/react/dist/csr/ArrowLeft";
import { SignIn } from "@phosphor-icons/react/dist/csr/SignIn";
import { logoutApi } from "@/shared/api/client";
import { Button } from "@/shared/ui/Button/Button";
import "./PaymentAccessNotice.css";

export function PaymentAccessNotice({
  returnTo,
  kind = "payment",
}: {
  returnTo: string;
  kind?: "payment" | "booking";
}): ReactElement {
  const navigate = useNavigate();
  const [switching, setSwitching] = useState(false);
  return (
    <section className="payment-access" aria-labelledby="payment-access-title">
      <div className="payment-access__card">
        <div className="payment-access__icon" aria-hidden="true">
          <LockKey size={36} weight="duotone" />
        </div>
        <p className="payment-access__eyebrow">THÔNG TIN ĐẶT VÉ</p>
        <h1 id="payment-access-title">
          {kind === "booking"
            ? "Chưa thể xem đơn đặt vé"
            : "Chưa thể xem giao dịch"}
        </h1>
        <p className="payment-access__description">
          Đăng nhập bằng tài khoản đã đặt vé để tiếp tục.
        </p>
        <div className="payment-access__explanation">
          <strong>Kiểm tra lại tài khoản hoặc đường dẫn</strong>
          <p>
            Thông tin này có thể thuộc một tài khoản khác hoặc đường dẫn không
            còn hợp lệ.
          </p>
        </div>
        <div className="payment-access__actions">
          <Button
            isLoading={switching}
            onClick={async () => {
              if (switching) return;
              setSwitching(true);
              await logoutApi().catch(() => undefined);
              void navigate("/login", { state: { from: returnTo } });
            }}
          >
            <SignIn size={20} aria-hidden="true" />
            Đăng nhập tài khoản khác
          </Button>
          <Link to="/account/tickets">
            <ArrowLeft size={18} aria-hidden="true" />
            Hành trình của tôi
          </Link>
        </div>
      </div>
    </section>
  );
}
