import type { ReactElement } from "react";
import {
  matchPath,
  Navigate,
  Outlet,
  useLocation,
  useParams,
} from "react-router";

import { GuardLoading } from "@/app/guards/GuardLoading";
import { useMockSession } from "@/features/auth/hooks/useMockSession";
import { useBookingDraftHydration } from "@/features/booking/hooks/useBookingDraftHydration";
import {
  selectBookingSession,
  useBookingDraftStore,
} from "@/features/booking/store/bookingDraftStore";
import { ROUTES } from "@/shared/config/routes";
import { useSessionClock } from "@/shared/lib/useSessionClock";
import { isMockApi } from "@/shared/api/config";

export function BookingSessionRoute(): ReactElement {
  const { sessionId, bookingId } = useParams();
  const location = useLocation();
  const draft = useBookingDraftStore(selectBookingSession);
  const isHydrated = useBookingDraftHydration();
  const account = useMockSession();
  const nowMs = useSessionClock(draft?.expiresAt);
  if (!isMockApi) {
    if (!account.isHydrated) return <GuardLoading />;
    if (!account.session) return <Navigate replace to={ROUTES.login} />;
    // Checkout can reload an existing order from its authenticated API.
    if (bookingId) return <Outlet />;
  }
  const hasMatchingRoute =
    draft &&
    (sessionId
      ? draft.sessionId === sessionId
      : Boolean(bookingId && draft.bookingId === bookingId));
  if (!isHydrated || nowMs === null) return <GuardLoading />;
  const expiryMs = draft ? Date.parse(draft.expiresAt) : Number.NaN;
  // Live drafts have no hold deadline. Setting bookingId during checkout must
  // not turn their placeholder expiresAt into an expiry before navigation.
  // The payment page loads and enforces the real booking deadline from BE.
  const enforceExpiry = isMockApi;
  const isExactMatchingSeatRoute = Boolean(
    sessionId &&
    draft?.sessionId === sessionId &&
    matchPath(
      { path: "/booking/:sessionId/seats", end: true },
      location.pathname,
    ),
  );
  const canShowExpiredSeatState =
    isExactMatchingSeatRoute && Number.isFinite(expiryMs) && expiryMs <= nowMs;
  if (
    !hasMatchingRoute ||
    !draft ||
    !Number.isFinite(expiryMs) ||
    (enforceExpiry && expiryMs <= nowMs && !canShowExpiredSeatState)
  ) {
    return <Navigate replace to={`${ROUTES.trips}?reason=expired`} />;
  }
  return <Outlet />;
}
