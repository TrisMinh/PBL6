import { useEffect, useRef, useState, type ReactElement } from "react";
import { createPortal } from "react-dom";
import { CheckCircle } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { WarningCircle } from "@phosphor-icons/react/dist/csr/WarningCircle";
import { X } from "@phosphor-icons/react/dist/csr/X";
import "./Toast.css";

type ToastProps = {
  message: string;
  tone?: "success" | "error";
  onClose?: () => void;
};

export function Toast(props: ToastProps): ReactElement {
  return <ToastMessage key={`${props.tone}:${props.message}`} {...props} />;
}

function ToastMessage({
  message,
  tone = "success",
  onClose,
}: ToastProps): ReactElement | null {
  const [visible, setVisible] = useState(true);
  const closeRef = useRef(onClose);
  const timerRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    timerRef.current = window.setTimeout(() => {
      setVisible(false);
      closeRef.current?.();
    }, 3000);
    return () => window.clearTimeout(timerRef.current);
  }, []);
  if (!visible || typeof document === "undefined") return null;
  const Icon = tone === "error" ? WarningCircle : CheckCircle;
  return createPortal(
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
        onClick={() => {
          window.clearTimeout(timerRef.current);
          setVisible(false);
          closeRef.current?.();
        }}
      >
        <X size={18} aria-hidden="true" />
      </button>
    </div>,
    document.body,
  );
}
