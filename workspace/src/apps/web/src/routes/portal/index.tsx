import { Navigate } from "react-router";
import { portalHome } from "@/shared/config/portal";
import { useMockSession } from "@/features/auth/hooks/useMockSession";
import PortalLogin from "./login";
export { meta } from "./login";
export default function PortalIndex(): React.ReactElement {
  const { session, isHydrated } = useMockSession();
  return isHydrated && session ? (
    <Navigate to={portalHome} replace />
  ) : (
    <PortalLogin />
  );
}
