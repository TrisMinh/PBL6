import type { ReactElement } from "react";
import type { DriverAttachment } from "./drivers.schema";
import { useDriverFileUrl } from "./driverFiles";
export function DriverPhoto({
  attachment,
  fallback,
}: {
  attachment: DriverAttachment;
  fallback: string;
}): ReactElement {
  const url = useDriverFileUrl(attachment);
  return url ? (
    <img className="operator-drivers__uploaded-photo" src={url} alt="" />
  ) : (
    <>{fallback}</>
  );
}
export function DriverDocument({
  attachment,
}: {
  attachment?: DriverAttachment;
}): ReactElement {
  const url = useDriverFileUrl(attachment);
  return attachment ? (
    <div className="operator-drivers__uploaded-document">
      <p>{attachment.name}</p>
      {url ? (
        <>
          {attachment.type !== "application/pdf" && (
            <img src={url} alt="Giấy phép lái xe đã tải lên" />
          )}
          <a href={url} download={attachment.name}>
            Tải tệp xuống
          </a>
        </>
      ) : (
        <p>
          Không tìm thấy tệp trong trình duyệt này. Tệp chỉ lưu cục bộ ở bản
          mock.
        </p>
      )}
    </div>
  ) : (
    <p>Chưa có ảnh GPLX trong dữ liệu mock.</p>
  );
}
