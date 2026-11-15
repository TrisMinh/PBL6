import { Toast } from "@/shared/ui/Toast/Toast";
import { useState, type FormEvent, type ReactElement } from "react";
import { Link } from "react-router";
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
    if (Date.now() >= expiresAt) {
      setError("Mã đã hết hạn. Vui lòng gửi lại mã.");
      return;
    }
    if (code !== "123456") {
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
      await completeDemoChallenge(reset, password);
      setError("");
      setComplete(true);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Không thể xác nhận. Hãy thử lại.",
      );
    }
  }
  return (
    <AuthShell mode={reset ? "reset" : "verify"}>
      <div className="auth-page__challenge">
        <p className="auth-page__challenge-demo">
          Mã trải nghiệm: <strong>123456</strong> · Có hiệu lực 10 phút. Không
          gửi email thật.
        </p>
        {complete ? (
          <div className="auth-page__success">
            <Toast
              message={
                reset
                  ? "Mật khẩu mô phỏng đã được cập nhật."
                  : "Email đã được xác minh."
              }
            />
            <p>
              Bạn có thể tiếp tục khám phá bằng tài khoản mẫu với mật khẩu
              BlueDemo2026.
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
                <Button type="submit">
                  {reset ? "Lưu mật khẩu mới" : "Xác nhận email"}
                </Button>
              </fieldset>
            </form>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
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
