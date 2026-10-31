import { http, HttpResponse } from "msw";

import {
  MOCK_SESSION_LIMIT,
  MOCK_SESSION_TTL_MS,
} from "@/features/auth/config/session";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  oauthSchema,
} from "@/features/auth/schemas/auth.schema";
import { authenticatedSessionSchema } from "@/features/auth/schemas/session.schema";
import { ticketDetailSchema } from "@/features/tickets/schemas/ticket.schema";
import { accounts } from "@/mocks/fixtures/accounts";
import { authProblem } from "@/mocks/handlers/authHttp";
import { accountOwnsTicket, readAuthGrant } from "@/mocks/state/authState";
import { mockDb, type MockDb } from "@/mocks/state/mockDb";

interface Context {
  db: MockDb;
  now: () => number;
  scenariosEnabled: boolean;
}
function grant(context: Context, userId: string): Response {
  const now = context.now(),
    account = accounts.find((item) => item.userId === userId);
  if (!account) return authProblem("INVALID_CREDENTIALS");
  for (const [key, value] of context.db.authSessions)
    if (Date.parse(value.expiresAt) <= now) context.db.authSessions.delete(key);
  if (context.db.authSessions.size >= MOCK_SESSION_LIMIT)
    return authProblem("SERVICE_UNAVAILABLE");
  const session = authenticatedSessionSchema.parse({
    userId: account.userId,
    role: account.role,
    token: crypto.randomUUID(),
    expiresAt: new Date(now + MOCK_SESSION_TTL_MS).toISOString(),
  });
  context.db.authSessions.set(
    session.token,
    Object.freeze({ ...session, createdAt: new Date(now).toISOString() }),
  );
  context.db.save(now);
  return HttpResponse.json(session, {
    headers: { "Cache-Control": "no-store" },
  });
}
async function authenticate(
  context: Context,
  action: string,
  request: Request,
): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return authProblem("VALIDATION_ERROR");
  }
  if (action === "login") {
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) return authProblem("VALIDATION_ERROR");
    const account = accounts.find((item) => item.email === parsed.data.email);
    // Public demo credential only; no submitted credential is retained.
    if (!account || parsed.data.password !== "BlueDemo2026")
      return authProblem("INVALID_CREDENTIALS");
    return grant(context, account.userId);
  }
  if (action === "oauth") {
    const parsed = oauthSchema.safeParse(body);
    if (!parsed.success) return authProblem("VALIDATION_ERROR");
    if (context.scenariosEnabled && parsed.data.scenario === "error")
      return authProblem("SERVICE_UNAVAILABLE");
    return grant(context, "mock-customer");
  }
  const schema =
    action === "register"
      ? registerSchema
      : action === "forgot-password"
        ? forgotPasswordSchema
        : null;
  if (!schema?.safeParse(body).success) return authProblem("VALIDATION_ERROR");
  return HttpResponse.json(
    { accepted: true },
    { status: 202, headers: { "Cache-Control": "no-store" } },
  );
}
function history(context: Context, request: Request): Response {
  const grant = readAuthGrant(context.db, request, context.now());
  if (!grant) return authProblem("ACCESS_REQUIRED");
  if (grant.role !== "customer") return authProblem("FORBIDDEN");
  const url = new URL(request.url);
  if (
    url.searchParams.getAll("status").length > 1 ||
    (url.searchParams.has("status") &&
      !["all", "issued", "cancelled"].includes(
        url.searchParams.get("status") ?? "",
      ))
  )
    return authProblem("VALIDATION_ERROR");
  const status = url.searchParams.get("status") ?? "all";
  const items = [...context.db.tickets.values()]
    .filter((ticket) =>
      accountOwnsTicket(grant, ticket.guestVerification.email),
    )
    .filter((ticket) => status === "all" || ticket.status === status)
    .map((ticket) =>
      ticketDetailSchema.parse({
        ...ticket,
        passenger: { fullName: ticket.passenger.fullName },
        trip: context.db.trips.find((trip) => trip.id === ticket.tripId),
      }),
    );
  return HttpResponse.json(
    { items, total: items.length },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export function createAuthHandlers(
  options: { db?: MockDb; now?: () => number; scenariosEnabled?: boolean } = {},
): ReturnType<typeof http.get>[] {
  const context = {
    db: options.db ?? mockDb,
    now: options.now ?? Date.now,
    scenariosEnabled:
      options.scenariosEnabled ??
      (import.meta.env.DEV || import.meta.env.MODE === "test"),
  };
  return [
    http.post("/api/v1/auth/:action", async ({ request, params }) => {
      context.db.hydrate(context.now());
      return authenticate(context, String(params.action), request);
    }),
    http.get("/api/v1/me/tickets", ({ request }) => {
      context.db.hydrate(context.now());
      return history(context, request);
    }),
  ];
}
export const authHandlers = createAuthHandlers();
