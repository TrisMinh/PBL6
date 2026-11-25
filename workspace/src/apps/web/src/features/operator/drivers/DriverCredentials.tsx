import { useState, type ReactElement } from "react";
import { Button } from "@/shared/ui/Button/Button";
import { Input } from "@/shared/ui/Input/Input";
import "./DriverCredentials.css";

export type DriverCredentialsData = { email: string; password: string };

export function DriverCredentials({
  credentials,
}: {
  credentials: DriverCredentialsData;
}): ReactElement {
  const [visible, setVisible] = useState(false);
  const [feedback, setFeedback] = useState("");

  async function copyCredentials(): Promise<void> {
    try {
      await navigator.clipboard.writeText(
        `Email đăng nhập: ${credentials.email}\nMật khẩu tạm thời: ${credentials.password}`,
      );
      setFeedback("Đã sao chép thông tin đăng nhập.");
    } catch {
      setVisible(true);
      setFeedback("Hãy chọn và sao chép thông tin trong hai ô bên dưới.");
    }
  }

  return (
    <div className="driver-credentials">
      <Input label="Email đăng nhập" value={credentials.email} readOnly />
      <Input
        label="Mật khẩu tạm thời"
        type={visible ? "text" : "password"}
        value={credentials.password}
        readOnly
        autoComplete="off"
        trailingControl={
          <button
            type="button"
            className="driver-credentials__visibility"
            aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
            onClick={() => setVisible(!visible)}
          >
            {visible ? "Ẩn" : "Hiện"}
          </button>
        }
      />
      <Button
        type="button"
        variant="secondary"
        onClick={() => void copyCredentials()}
      >
        Sao chép thông tin đăng nhập
      </Button>
      <span className="driver-credentials__feedback" role="status">
        {feedback}
      </span>
    </div>
  );
}
