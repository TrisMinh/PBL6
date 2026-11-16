import { useId, useState, type ReactElement } from "react";
import { Bank } from "@phosphor-icons/react/dist/csr/Bank";
import { CreditCard } from "@phosphor-icons/react/dist/csr/CreditCard";
import { QrCode } from "@phosphor-icons/react/dist/csr/QrCode";
import { Button } from "@/shared/ui/Button/Button";
import "./MockPaymentGateway.css";

export type SePayMethod = "BANK_TRANSFER" | "NAPAS_BANK_TRANSFER" | "CARD";
const methods = [
  { code: "BANK_TRANSFER", label: "SePay QR", Icon: QrCode },
  { code: "NAPAS_BANK_TRANSFER", label: "Thẻ ATM / Ngân hàng", Icon: Bank },
  { code: "CARD", label: "Thẻ quốc tế", Icon: CreditCard },
] as const;

/** The original gateway presentation, with server-supported methods and a signed SePay handoff. */
export function SePayGateway({
  methods: enabled,
  pending,
  onCheckout,
}: {
  methods: readonly SePayMethod[];
  pending: boolean;
  onCheckout: (method: SePayMethod) => void;
}): ReactElement {
  const [selected, setSelected] = useState<SePayMethod>("BANK_TRANSFER");
  const method = enabled.includes(selected) ? selected : enabled[0];
  const baseId = useId();
  return (
    <div className="mock-gateway mock-gateway--inline">
      <header className="mock-gateway__header">
        <strong aria-label="SePay">
          Se<span>Pay</span>
        </strong>
      </header>
      <h2>Chọn phương thức thanh toán</h2>
      <div
        className="mock-gateway__tabs"
        role="tablist"
        aria-label="Phương thức thanh toán"
      >
        {methods.map(({ code, label, Icon }, index) => (
          <button
            key={code}
            type="button"
            role="tab"
            id={`${baseId}-tab-${index}`}
            disabled={pending || !enabled.includes(code)}
            title={
              enabled.includes(code)
                ? label
                : "Phương thức chưa được kích hoạt trên SePay"
            }
            aria-selected={method === code}
            aria-controls={`${baseId}-panel`}
            tabIndex={method === code ? 0 : -1}
            onClick={() => setSelected(code)}
            onKeyDown={(event) => {
              if (
                !["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)
              )
                return;
              event.preventDefault();
              const available = methods.filter((item) =>
                enabled.includes(item.code),
              );
              const current = available.findIndex(
                (item) => item.code === method,
              );
              const next =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? available.length - 1
                    : (current +
                        (event.key === "ArrowRight"
                          ? 1
                          : available.length - 1)) %
                      available.length;
              const target = available[next];
              if (!target) return;
              setSelected(target.code);
              document
                .getElementById(`${baseId}-tab-${methods.indexOf(target)}`)
                ?.focus();
            }}
          >
            <Icon
              size={22}
              weight="bold"
              aria-hidden="true"
              focusable="false"
            />
            <span>{label}</span>
          </button>
        ))}
      </div>
      <section
        id={`${baseId}-panel`}
        role="tabpanel"
        aria-labelledby={`${baseId}-tab-${methods.findIndex((item) => item.code === method)}`}
        tabIndex={0}
        className="mock-gateway__panel"
      >
        {method === "BANK_TRANSFER" ? (
          <div className="mock-gateway__qr">
            <div className="mock-gateway__qr-symbol" aria-hidden="true">
              <QrCode size={160} />
            </div>
            <h3>Quét mã bằng ứng dụng ngân hàng</h3>
            <p className="mock-gateway__demo-tag">
              Mã thanh toán được tạo bảo mật trên SePay khi bạn tiếp tục.
            </p>
          </div>
        ) : (
          <div className="mock-gateway__international">
            {method === "CARD" ? (
              <span className="mock-gateway__card-brand">
                VISA <span>Mastercard</span> JCB
              </span>
            ) : (
              <Bank size={48} aria-hidden="true" />
            )}
            <h3>
              {method === "CARD"
                ? "Thẻ thanh toán quốc tế"
                : "Thẻ ATM / Ngân hàng"}
            </h3>
            <p>Chọn ngân hàng và xác thực giao dịch trên cổng bảo mật SePay.</p>
          </div>
        )}
      </section>
      <footer className="mock-gateway__actions">
        <Button
          type="button"
          isLoading={pending}
          disabled={!method || pending}
          onClick={() => method && onCheckout(method)}
        >
          Thanh toán qua SePay
        </Button>
      </footer>
    </div>
  );
}
