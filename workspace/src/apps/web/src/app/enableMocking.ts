import { isMockApi } from "@/shared/api/config";
export async function enableMocking(): Promise<void> {
  if (!isMockApi || typeof window === "undefined") return;

  const { worker } = await import("@/mocks/browser");
  await worker.start({ onUnhandledFrame: "bypass", quiet: true });
}
