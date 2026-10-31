export function getRemainingSeconds(
  expiresAt: string,
  nowMs = Date.now(),
): number {
  const expiryMs = Date.parse(expiresAt);
  if (!Number.isFinite(expiryMs) || !Number.isFinite(nowMs)) return 0;
  return Math.max(0, Math.ceil((expiryMs - nowMs) / 1_000));
}
