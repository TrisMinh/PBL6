import { useRef, useState, type ReactElement } from "react";
import { Button } from "@/shared/ui/Button/Button";
import type { DriverAttachment } from "./drivers.schema";
import { validateDriverFile, useDriverFileUrl } from "./driverFiles";
import photoIcon from "@/assets/operator/drivers/add/imgFrame8.svg";

export function DriverUpload({
  avatar = false,
  label,
  file,
  existing,
  referenceName,
  onChange,
  onBusy,
}: {
  avatar?: boolean;
  label: string;
  file?: File;
  existing?: DriverAttachment;
  referenceName?: string;
  onChange: (file?: File) => void;
  onBusy: (busy: boolean) => void;
}): ReactElement {
  const input = useRef<HTMLInputElement>(null),
    sequence = useRef(0);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const currentFile = file ?? existing,
    url = useDriverFileUrl(currentFile);
  const name = currentFile?.name ?? referenceName;
  async function choose(files: File[]): Promise<void> {
    const current = ++sequence.current;
    setError("");
    setBusy(true);
    onBusy(true);
    try {
      if (files.length !== 1)
        throw Error("Vui lòng chọn một tệp cho mỗi vị trí.");
      const next = files[0];
      if (!next) throw Error("Chưa có tệp được chọn.");
      await validateDriverFile(next, avatar);
      if (current === sequence.current) onChange(next);
    } catch (e) {
      if (current === sequence.current)
        setError(e instanceof Error ? e.message : "Không đọc được tệp.");
    } finally {
      if (current === sequence.current) {
        setBusy(false);
        onBusy(false);
      }
    }
  }
  return (
    <div
      className={
        avatar ? "driver-add__photo-control" : "driver-add__document-control"
      }
    >
      <input
        ref={input}
        type="file"
        className="driver-add__file-input"
        aria-label={label}
        accept={
          avatar
            ? "image/jpeg,image/png"
            : "image/jpeg,image/png,application/pdf"
        }
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length) void choose(files);
        }}
      />
      {avatar ? (
        <>
          <div className="driver-add__photo-row">
            <span className="driver-add__photo">
              {url ? (
                <img
                  src={url}
                  width={64}
                  height={64}
                  alt="Ảnh đại diện đã chọn"
                />
              ) : (
                <img src={photoIcon} width={28} height={28} alt="" />
              )}
            </span>
            <Button
              type="button"
              variant="secondary"
              onClick={() => input.current?.click()}
              disabled={busy}
            >
              Tải ảnh lên
            </Button>
          </div>
          <small>JPG, PNG · Tối đa 5 MB</small>
        </>
      ) : (
        <button
          type="button"
          className="driver-add__drop"
          onClick={() => input.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void choose(Array.from(e.dataTransfer.files));
          }}
          disabled={busy}
          aria-label={`Chọn ${label.toLowerCase()}`}
        >
          <strong>{label}</strong>
          <span>
            {busy
              ? "Đang kiểm tra tệp…"
              : name
                ? `${name}${existing || referenceName ? " · Thay tệp" : ""}`
                : "↑  Chọn tệp hoặc kéo thả vào đây"}
          </span>
          <small>
            {existing
              ? `Đã tải lên · ${existing.type === "image/jpeg" ? "JPG" : existing.type === "image/png" ? "PNG" : "PDF"}`
              : referenceName && !file
                ? "Chưa có tệp trong mock · JPG"
                : "JPG, PNG, PDF · Tối đa 10 MB"}
          </small>
        </button>
      )}
      {currentFile && (
        <div className="driver-add__file-actions">
          {avatar && <span>{currentFile.name}</span>}
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              download={
                currentFile.type === "application/pdf"
                  ? currentFile.name
                  : undefined
              }
            >
              Xem tệp
            </a>
          )}
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              sequence.current++;
              setError("");
              setBusy(false);
              onBusy(false);
              onChange();
            }}
            aria-label={`Xóa ${label.toLowerCase()}`}
          >
            Xóa
          </Button>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
