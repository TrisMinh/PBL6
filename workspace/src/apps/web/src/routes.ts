import { createPortalRoutes, type PortalTarget } from "./app/portalRoutes";
const target = process.env.BLUE_APP_TARGET ?? "customer";
if (!["customer", "operator", "admin", "all"].includes(target))
  throw new Error(`Unknown BLUE_APP_TARGET: ${target}`);
export default createPortalRoutes(target as PortalTarget);
