import * as Dialog from "@radix-ui/react-dialog";
import { useId, useState, type ReactElement } from "react";
import { Bank } from "@phosphor-icons/react/dist/csr/Bank";
import { CreditCard } from "@phosphor-icons/react/dist/csr/CreditCard";
import { QrCode } from "@phosphor-icons/react/dist/csr/QrCode";
import { Button } from "@/shared/ui/Button/Button";
import { formatCurrencyVnd } from "@/shared/lib/formatCurrencyVnd";
import type { PaymentStatus } from "../types/payment";
import "./MockPaymentGateway.css";

const METHODS = ["VNPay QR", "Thẻ ATM / Ngân hàng", "Thẻ quốc tế"] as const;
const BANKS = [
  { code: "VCB", name: "Vietcombank" },
  { code: "BIDV", name: "BIDV" },
  { code: "VTB", name: "VietinBank" },
  { code: "TCB", name: "Techcombank" },
  { code: "MB", name: "MB Bank" },
  { code: "ACB", name: "ACB" },
] as const;

interface Props {
  inline?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
  amount: number;
  bookingId: string;
  pending: boolean;
  onPay: (scenario: PaymentStatus) => void;
}

/** A self-contained demo gateway. It never requests or transmits bank credentials. */
export function MockPaymentGateway({
  inline = false,
  open,
  onOpenChange,
  hideTrigger = false,
  amount,
  bookingId,
  pending,
  onPay,
}: Props): ReactElement {
  const [method, setMethod] = useState<(typeof METHODS)[number]>("VNPay QR");
  const [bank, setBank] = useState("VCB");
  const [outcome, setOutcome] = useState<PaymentStatus>("success");
  const baseId = useId();
  const content = (
    <>
      <header className="mock-gateway__header">
        <strong aria-label="VNPay">
          VN<span>PAY</span>
        </strong>
        {!inline && (
          <Dialog.Close asChild>
            <button
              type="button"
              aria-label="Đóng cổng thanh toán"
              className="mock-gateway__close"
            >
              ×
            </button>
          </Dialog.Close>
        )}
      </header>
      {inline ? (
        <h2>Chọn phương thức thanh toán</h2>
      ) : (
        <Dialog.Title>Thanh toán VNPay mô phỏng</Dialog.Title>
      )}
      {!inline && (
        <Dialog.Description id={`${baseId}-description`}>
          Trải nghiệm thanh toán mẫu. Không thu tiền và không nhập thông tin
          ngân hàng thật.
        </Dialog.Description>
      )}
      {!inline && (
        <div className="mock-gateway__receipt">
          <span>
            Đơn đặt vé <strong>{bookingId}</strong>
          </span>
          <span>
            Số tiền thanh toán <strong>{formatCurrencyVnd(amount)}</strong>
          </span>
        </div>
      )}
      <div
        className="mock-gateway__tabs"
        role="tablist"
        aria-label="Phương thức thanh toán"
      >
        {METHODS.map((item, index) => (
          <button
            key={item}
            type="button"
            role="tab"
            disabled={pending}
            aria-selected={method === item}
            id={`${baseId}-tab-${index}`}
            aria-controls={`${baseId}-panel`}
            tabIndex={method === item ? 0 : -1}
            onKeyDown={(event) => {
              if (
                !["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)
              )
                return;
              event.preventDefault();
              const next =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? 2
                    : (index + (event.key === "ArrowRight" ? 1 : 2)) % 3;
              setMethod(METHODS[next]);
              document.getElementById(`${baseId}-tab-${next}`)?.focus();
            }}
            onClick={() => setMethod(item)}
          >
            {item === "VNPay QR" ? (
              <QrCode
                size={22}
                weight="bold"
                aria-hidden="true"
                focusable="false"
              />
            ) : item === "Thẻ ATM / Ngân hàng" ? (
              <Bank
                size={22}
                weight="bold"
                aria-hidden="true"
                focusable="false"
              />
            ) : (
              <CreditCard
                size={22}
                weight="bold"
                aria-hidden="true"
                focusable="false"
              />
            )}
            <span>{item}</span>
          </button>
        ))}
      </div>
      <section
        id={`${baseId}-panel`}
        role="tabpanel"
        aria-labelledby={`${baseId}-tab-${METHODS.indexOf(method)}`}
        tabIndex={0}
        className="mock-gateway__panel"
      >
        {method === "VNPay QR" ? (
          <div className="mock-gateway__qr">
            <div className="mock-gateway__qr-symbol" aria-hidden="true">
              <QrCode size={inline ? 160 : 112} />
            </div>
            <h3>Quét mã bằng ứng dụng ngân hàng</h3>
            {!inline && (
              <div className="mock-gateway__waiting" role="status">
                <span />
                Chờ ngân hàng xác nhận thanh toán
              </div>
            )}
            <p className="mock-gateway__demo-tag">
              MÃ MINH HỌA · KHÔNG QUÉT ĐỂ CHUYỂN TIỀN
            </p>
          </div>
        ) : method === "Thẻ ATM / Ngân hàng" ? (
          <fieldset className="mock-gateway__banks">
            <legend>Chọn ngân hàng</legend>
            {BANKS.map((item) => (
              <label key={item.code}>
                <input
                  type="radio"
                  name={`${baseId}-bank`}
                  checked={bank === item.code}
                  onChange={() => setBank(item.code)}
                />
                <strong>{item.code}</strong>
                <span>{item.name}</span>
              </label>
            ))}
            <p>Tài khoản mẫu: 9704 00•• •••• 2026 · NGUYEN VAN DEMO</p>
          </fieldset>
        ) : (
          <div className="mock-gateway__international">
            <span className="mock-gateway__card-brand">
              VISA <span>Mastercard</span> JCB
            </span>
            <h3>Thẻ thanh toán quốc tế</h3>
            <p>Thẻ mẫu •••• 2026 · NGUYEN VAN DEMO</p>
            <p>
              Bản mô phỏng đã điền thông tin mẫu; không yêu cầu số thẻ, CVV hoặc
              OTP.
            </p>
          </div>
        )}
      </section>
      <details className="mock-gateway__demo-controls" open={!inline}>
        <summary>Bản trải nghiệm · Mô phỏng kết quả ngân hàng</summary>
        <label className="mock-gateway__outcome" htmlFor={`${baseId}-outcome`}>
          Kết quả giao dịch mô phỏng
          <select
            id={`${baseId}-outcome`}
            value={outcome}
            disabled={pending}
            onChange={(event) =>
              setOutcome(event.target.value as PaymentStatus)
            }
          >
            <option value="success">Thành công — phát hành vé</option>
            <option value="failed">Thất bại — ngân hàng từ chối</option>
            <option value="pending">Đang xử lý — chờ xác nhận</option>
            <option value="cancelled">Khách hủy thanh toán</option>
          </select>
        </label>
        <footer className="mock-gateway__actions">
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() => onPay("cancelled")}
          >
            Hủy giao dịch
          </Button>
          <Button
            type="button"
            isLoading={pending}
            onClick={() => onPay(outcome)}
          >
            Xác nhận thanh toán mô phỏng
          </Button>
        </footer>
      </details>
      {!inline && (
        <p className="mock-gateway__security">
          Chỉ phát hành vé sau khi nhận kết quả xác nhận. Mã minh họa không dùng
          để chuyển tiền thật.
        </p>
      )}
    </>
  );
  if (inline)
    return <div className="mock-gateway mock-gateway--inline">{content}</div>;
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {!hideTrigger && (
        <Dialog.Trigger asChild>
          <Button type="button" variant="secondary" disabled={pending}>
            Chọn phương thức thanh toán
          </Button>
        </Dialog.Trigger>
      )}
      <Dialog.Portal>
        <Dialog.Overlay className="mock-gateway__overlay" />
        <Dialog.Content
          className="mock-gateway"
          aria-describedby={`${baseId}-description`}
        >
          {content}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
