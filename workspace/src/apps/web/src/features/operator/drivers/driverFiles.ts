import { useEffect, useState } from "react";
import type { DriverAttachment } from "./drivers.schema";

const STORE = "files";
async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("blue-operator-driver-files", 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(Error("Không mở được kho tệp trong trình duyệt."));
  });
}
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
  const db = await database(),
    id = crypto.randomUUID();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(file, id);
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () =>
        reject(
          Error(
            "Không lưu được tệp. Kiểm tra dung lượng trình duyệt và thử lại.",
          ),
        );
    });
  } finally {
    db.close();
  }
  return {
    id,
    name: file.name,
    type: file.type as DriverAttachment["type"],
    size: file.size,
  };
}
export async function deleteDriverFile(id: string): Promise<void> {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(Error("Không xóa được tệp tạm."));
    });
  } finally {
    db.close();
  }
}
export async function readDriverFile(id: string): Promise<Blob | undefined> {
  const db = await database();
  try {
    return await new Promise<Blob | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly"),
        req = tx.objectStore(STORE).get(id);
      req.onsuccess = () =>
        resolve(req.result instanceof Blob ? req.result : undefined);
      req.onerror = () => reject(Error("Không đọc được tệp."));
    });
  } finally {
    db.close();
  }
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
