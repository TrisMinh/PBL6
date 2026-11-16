import { Toast } from "@/shared/ui/Toast/Toast";
import { useState, type FormEvent, type ReactElement } from "react";
import { Link, useSearchParams } from "react-router";
import { isMockApi } from "@/shared/api/config";
import {
  verifyEmail,
  resetPassword,
  resendVerification,
} from "../repositories/backendAuthRepository";
import { AuthShell } from "../components/AuthShell";
import { Button } from "@/shared/ui/Button/Button";
import { Input } from "@/shared/ui/Input/Input";
import {
  completeDemoChallenge,
  resendDemoChallenge,
} from "@/mocks/state/customerAccounts";

export function MockAccountChallenge({
  reset,
}: {
  reset: boolean;
}): ReactElement {
  const [params] = useSearchParams();
  const [pending, setPending] = useState(false);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [expiresAt, setExpiresAt] = useState(() => Date.now() + 600000);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [complete, setComplete] = useState(false);
  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setNotice("");
    if (isMockApi && Date.now() >= expiresAt) {
      setError("Mã đã hết hạn. Vui lòng gửi lại mã.");
      return;
    }
    if (isMockApi && code !== "123456") {
      setError("Mã xác minh chưa đúng. Vui lòng kiểm tra lại.");
      return;
    }
    if (reset && !/^(?=.*[a-zA-Z])(?=.*\d).{8,128}$/.test(password)) {
      setError("Mật khẩu cần từ 8 ký tự, gồm chữ và số.");
      return;
    }
    if (reset && password !== confirm) {
      setError("Mật khẩu xác nhận chưa khớp.");
      return;
    }
    try {
      setPending(true);
      if (isMockApi) await completeDemoChallenge(reset, password);
      else {
        const challengeId = params.get("challengeId") ?? "";
        if (!challengeId)
          throw new Error("Mở liên kết xác minh trong email để tiếp tục.");
        if (reset) await resetPassword(challengeId, code, password);
        else await verifyEmail(challengeId, code);
      }
      setError("");
      setComplete(true);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Không thể xác nhận. Hãy thử lại.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <AuthShell mode={reset ? "reset" : "verify"}>
      <div className="auth-page__challenge">
        <p className="auth-page__challenge-demo">
          {isMockApi ? (
            <>
              Mã trải nghiệm: <strong>123456</strong> · Có hiệu lực 10 phút.
              Không gửi email thật.
            </>
          ) : (
            <>
              Nhập mã xác minh được gửi đến email của bạn. Mở trang này bằng
              liên kết trong email.
            </>
          )}
        </p>
        {complete ? (
          <div className="auth-page__success">
            <Toast
              message={
                reset
                  ? isMockApi
                    ? "Mật khẩu mô phỏng đã được cập nhật."
                    : "Mật khẩu đã được cập nhật."
                  : "Email đã được xác minh."
              }
            />
            <p>
              {isMockApi
                ? "Bạn có thể tiếp tục khám phá bằng tài khoản mẫu với mật khẩu BlueDemo2026."
                : "Bạn có thể đăng nhập bằng thông tin tài khoản của mình."}
            </p>
            <Link to="/login">Tiếp tục đăng nhập</Link>
          </div>
        ) : (
          <>
            {error && (
              <Toast
                tone="error"
                message={error}
                onClose={() => setError("")}
              />
            )}
            <form noValidate onSubmit={submit}>
              <fieldset className="auth-page__fields">
                <legend className="auth-page__sr-only">
                  {reset ? "Tạo mật khẩu mới" : "Xác minh tài khoản"}
                </legend>
                <Input
                  label="Mã xác minh"
                  value={code}
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  onChange={(event) => {
                    setCode(event.target.value.replace(/\D/g, ""));
                    setError("");
                  }}
                />
                {reset && (
                  <>
                    <Input
                      label="Mật khẩu mới"
                      value={password}
                      type="password"
                      autoComplete="new-password"
                      maxLength={128}
                      required
                      onChange={(event) => setPassword(event.target.value)}
                    />
                    <Input
                      label="Xác nhận mật khẩu mới"
                      value={confirm}
                      type="password"
                      autoComplete="new-password"
                      maxLength={128}
                      required
                      onChange={(event) => setConfirm(event.target.value)}
                    />
                  </>
                )}
                <Button type="submit" isLoading={pending}>
                  {reset ? "Lưu mật khẩu mới" : "Xác nhận email"}
                </Button>
              </fieldset>
            </form>
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={async () => {
                if (!isMockApi) {
                  const email = params.get("email");
                  if (!email || reset) {
                    setError(
                      "Vui lòng quay lại trang đăng ký hoặc quên mật khẩu để gửi yêu cầu mới.",
                    );
                    return;
                  }
                  setPending(true);
                  try {
                    await resendVerification(email);
                    setNotice(
                      "Yêu cầu đã được tiếp nhận. Mở liên kết mới trong email.",
                    );
                  } catch {
                    setError("Chưa gửi lại được mã. Hãy thử lại sau.");
                  } finally {
                    setPending(false);
                  }
                  return;
                }
                setCode("");
                setExpiresAt(Date.now() + 600000);
                resendDemoChallenge();
                setError("");
                setNotice(
                  "Mã mới đã sẵn sàng. Dùng 123456 để tiếp tục trải nghiệm.",
                );
              }}
            >
              Gửi lại mã
            </Button>
            {notice && <Toast message={notice} onClose={() => setNotice("")} />}
            <Link className="auth-page__back-login" to="/login">
              ← Quay lại đăng nhập
            </Link>
          </>
        )}
      </div>
    </AuthShell>
  );
}
