import { apiFetch } from "@/shared/api/client";
import { useEffect, useState } from "react";
import type { DriverAttachment } from "./drivers.schema";

export async function validateDriverFile(
  file: File,
  avatar = false,
): Promise<void> {
  const limit = (avatar ? 5 : 10) * 1024 * 1024;
  const supported = avatar
    ? ["image/jpeg", "image/png"]
    : ["image/jpeg", "image/png", "application/pdf"];
  if (!supported.includes(file.type))
    throw Error(
      avatar ? "Chỉ nhận ảnh JPG hoặc PNG." : "Chỉ nhận tệp JPG, PNG hoặc PDF.",
    );
  if (!file.size || file.size > limit)
    throw Error(
      `Tệp phải có dung lượng lớn hơn 0 và tối đa ${avatar ? 5 : 10} MB.`,
    );
  if (file.name.length > 255) throw Error("Tên tệp tối đa 255 ký tự.");
  const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const valid =
    file.type === "image/png"
      ? [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)
      : file.type === "image/jpeg"
        ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
        : [37, 80, 68, 70, 45].every((v, i) => bytes[i] === v);
  if (!valid)
    throw Error("Nội dung tệp không khớp định dạng JPG, PNG hoặc PDF.");
}
export async function storeDriverFile(
  file: File,
  avatar = false,
): Promise<DriverAttachment> {
  await validateDriverFile(file, avatar);
  // The upload header uses ASCII. Profile metadata retains the original name.
  const extension =
    file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
  const headerName =
    /^[ -~]+$/.test(file.name) && file.name.trim()
      ? file.name
      : `tep-dinh-kem.${extension}`;
  const response = await apiFetch("/api/v1/operator/driver-files/", {
    method: "POST",
    headers: { "Content-Type": file.type, "X-File-Name": headerName },
    body: file,
  });
  if (!response.ok) throw Error("Không tải được tệp lên máy chủ.");
  const stored = (await response.json()) as DriverAttachment;
  return { ...stored, name: file.name || stored.name };
}
export async function deleteDriverFile(id: string): Promise<void> {
  const response = await apiFetch(
    `/api/v1/operator/driver-files/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
  if (!response.ok && response.status !== 404)
    throw Error("Không xóa được tệp.");
}
export async function readDriverFile(id: string): Promise<Blob | undefined> {
  const response = await apiFetch(
    `/api/v1/operator/driver-files/${encodeURIComponent(id)}`,
  );
  if (response.status === 404) return undefined;
  if (!response.ok) throw Error("Không đọc được tệp.");
  return response.blob();
}

export function useDriverFileUrl(
  file?: File | DriverAttachment,
): string | undefined {
  const [result, setResult] = useState<{ key: File | string; url: string }>();
  useEffect(() => {
    if (!file) return;
    let active = true,
      url: string | undefined;
    const read =
      file instanceof File ? Promise.resolve(file) : readDriverFile(file.id);
    void read
      .then((blob) => {
        if (active && blob) {
          url = URL.createObjectURL(blob);
          setResult({ key: file instanceof File ? file : file.id, url });
        }
      })
      .catch(() => {
        /* The caller renders its missing-file fallback. */
      });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [file]);
  return result?.key === (file instanceof File ? file : file?.id)
    ? result?.url
    : undefined;
}
