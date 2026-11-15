import { useSyncExternalStore } from "react";
import { customerProfileSchema } from "./customerPreferences";
import defaultAvatar from "@/assets/auth/robot-happy.svg";

export const defaultCustomerAvatar = defaultAvatar;

export async function prepareCustomerAvatar(file: File): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Chọn ảnh JPG, PNG hoặc WebP.");
  }
  if (file.size > 5 * 1024 * 1024) throw new Error("Chọn ảnh nhỏ hơn 5 MB.");
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Chưa xử lý được ảnh. Hãy thử ảnh khác.");
    const side = Math.min(bitmap.width, bitmap.height);
    context.drawImage(
      bitmap,
      (bitmap.width - side) / 2,
      (bitmap.height - side) / 2,
      side,
      side,
      0,
      0,
      256,
      256,
    );
    return canvas.toDataURL("image/webp", 0.85);
  } finally {
    bitmap.close();
  }
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("blue-account-updated", onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener("blue-account-updated", onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useCustomerAvatar(userId?: string): string {
  return useSyncExternalStore(
    subscribe,
    () => {
      if (!userId) return "";
      try {
        const profile = customerProfileSchema.safeParse(
          JSON.parse(
            sessionStorage.getItem(
              `blue-account:${encodeURIComponent(userId)}:profile`,
            ) ?? "null",
          ),
        );
        return profile.success ? profile.data.avatar : "";
      } catch {
        return "";
      }
    },
    () => "",
  );
}
