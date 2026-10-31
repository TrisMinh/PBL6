import { isMockApi } from "@/shared/api/config";
export async function enableMocking(): Promise<void> {
  if (!isMockApi || !import.meta.env.DEV || typeof window === "undefined")
    return;

  const { worker } = await import("@/mocks/browser");
  await worker.start({ onUnhandledFrame: "bypass", quiet: true });
}
