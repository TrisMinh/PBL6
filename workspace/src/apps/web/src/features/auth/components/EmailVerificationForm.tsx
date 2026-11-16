import { useEffect, useRef, useState, type ReactElement } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft } from "@phosphor-icons/react/dist/csr/ArrowLeft";
import { ArrowClockwise } from "@phosphor-icons/react/dist/csr/ArrowClockwise";
import { EnvelopeSimple } from "@phosphor-icons/react/dist/csr/EnvelopeSimple";
import { useAuthAction } from "../hooks/useAuthAction";
import { resendVerification } from "../repositories/backendAuthRepository";
import {
  readPendingVerification,
  type PendingVerification,
} from "../lib/pendingVerification";
import { Input } from "@/shared/ui/Input/Input";
import { Button } from "@/shared/ui/Button/Button";
import { Toast } from "@/shared/ui/Toast/Toast";
import "./EmailVerificationForm.css";

export function EmailVerificationForm({
  pending,
  onChange,
  onEdit,
}: {
  pending: PendingVerification;
  onChange: (pending: PendingVerification) => void;
  onEdit: () => void;
}): ReactElement {
  const action = useAuthAction();
  const [code, setCode] = useState("");
  const [now, setNow] = useState(Date.now);
  const codeInput = useRef<HTMLInputElement>(null);
  const remaining = Math.max(
    0,
    Math.ceil((pending.requestedAt + 60_000 - now) / 1000),
  );
  useEffect(() => {
    codeInput.current?.focus();
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const resend = useMutation({
    mutationFn: () => resendVerification(pending.email),
    retry: false,
    onSuccess: () => {
      const next = readPendingVerification();
      if (next) onChange(next);
      setCode("");
      action.reset();
      codeInput.current?.focus();
    },
  });
  const busy = action.isPending || resend.isPending;
  return (
    <div className="auth-verification">
      <ol className="auth-verification__steps" aria-label="Tiến trình đăng ký">
        <li>
          <span>✓</span>Thông tin tài khoản
        </li>
        <li aria-current="step">
          <span>2</span>Xác minh email
        </li>
      </ol>
      <div className="auth-verification__recipient">
        <EnvelopeSimple size={22} aria-hidden />
        <div>
          <span>Email nhận mã xác minh</span>
          <strong>{pending.email}</strong>
        </div>
      </div>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (/^\d{6}$/.test(code) && !busy)
            action.submit({
              kind: "verify",
              input: { challengeId: pending.challengeId, code },
            });
        }}
      >
        <Input
          ref={codeInput}
          label="Mã xác minh"
          className="auth-verification__code"
          autoComplete="one-time-code"
          inputMode="numeric"
          pattern="[0-9]{6}"
          placeholder="000000"
          maxLength={6}
          value={code}
          disabled={busy}
          aria-describedby="verification-help"
          error={action.error?.message}
          onChange={(event) => {
            setCode(event.target.value.replace(/\D/g, "").slice(0, 6));
            if (action.error) action.reset();
          }}
        />
        <p id="verification-help" className="auth-verification__hint">
          Nhập mã gồm 6 chữ số trong email của bạn.
        </p>
        <Button
          type="submit"
          className="auth-page__submit"
          isLoading={action.isPending}
          disabled={code.length !== 6 || busy}
        >
          Xác minh và tiếp tục
        </Button>
      </form>
      <div className="auth-verification__resend">
        <span>Chưa nhận được mã? Kiểm tra cả thư rác.</span>
        <Button
          type="button"
          variant="ghost"
          disabled={remaining > 0 || busy}
          isLoading={resend.isPending}
          onClick={() => resend.mutate()}
        >
          <ArrowClockwise size={16} aria-hidden />
          {remaining > 0 ? `Gửi lại sau ${remaining}s` : "Gửi lại mã"}
        </Button>
      </div>
      {resend.isSuccess && (
        <p className="auth-verification__notice" role="status">
          Đã gửi lại mã. Vui lòng dùng mã mới nhất.
        </p>
      )}
      {resend.isError && <Toast tone="error" message={resend.error.message} />}
      <Button
        type="button"
        variant="secondary"
        className="auth-verification__edit"
        disabled={busy}
        onClick={onEdit}
      >
        <ArrowLeft size={16} aria-hidden />
        Sửa thông tin đăng ký
      </Button>
    </div>
  );
}
