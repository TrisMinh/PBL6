import { useEffect, type ReactElement } from "react";
import { CheckCircle } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { WarningCircle } from "@phosphor-icons/react/dist/csr/WarningCircle";
import { X } from "@phosphor-icons/react/dist/csr/X";
import "./Toast.css";

export function Toast({
  message,
  tone = "success",
  onClose,
}: {
  message: string;
  tone?: "success" | "error";
  onClose: () => void;
}): ReactElement {
  useEffect(() => {
    const timer = window.setTimeout(onClose, 5000);
    return () => window.clearTimeout(timer);
  }, [onClose]);
  const Icon = tone === "error" ? WarningCircle : CheckCircle;
  return (
    <div
      className="app-toast"
      data-tone={tone}
      role={tone === "error" ? "alert" : "status"}
      aria-atomic="true"
    >
      <Icon size={24} weight="fill" aria-hidden="true" />
      <span>{message}</span>
      <button
        className="app-toast__close"
        type="button"
        aria-label="Đóng thông báo"
        onClick={onClose}
      >
        <X size={18} aria-hidden="true" />
      </button>
    </div>
  );
}
