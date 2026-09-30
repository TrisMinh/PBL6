export type ErrorEnvelope = {
  error: { code: string; message: string; correlationId: string; details?: Record<string, unknown> };
};

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly correlationId?: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export type Session = {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  sessionId: string;
  user: UserProfile;
};

export type UserProfile = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  status: string;
  roles: string[];
  organizationMemberships: { organizationId: string; roleCodes: string[]; status: string }[];
  rowVersion: number;
};

export type Money = { amount: number; currency: string };
export type TripStop = {
  id: string;
  name: string;
  address?: string;
  sequence: number;
  offsetMinutes: number;
  pickupAllowed: boolean;
  dropoffAllowed: boolean;
};
export type Trip = {
  id: string;
  organizationId: string;
  operatorName: string;
  busType: string;
  amenities: string[];
  departureAt: string;
  arrivalAt: string;
  origin: string;
  destination: string;
  fare: Money;
  status: string;
  sellable: boolean;
  availableSeatCount?: number;
  availabilityAsOf?: string;
  policyVersion?: string;
  stops: TripStop[];
  rowVersion: number;
};
export type TripPage = { page: number; size: number; totalElements: number; totalPages: number; items: Trip[] };
export type Seat = { id: string; code: string; type: string; status: string; price: Money; rowVersion: number };
export type SeatHold = {
  holdToken: string;
  tripId: string;
  status: string;
  seats: Seat[];
  expiresAt: string;
  serverTime: string;
};
export type Booking = {
  id: string;
  code: string;
  customerId: string;
  tripId: string;
  status: string;
  paymentChannel: string;
  contact: { fullName: string; email: string; phone: string };
  subtotal: number;
  discount: number;
  fee: number;
  total: number;
  currency: string;
  expiresAt: string;
  items: { seatId: string; fullName: string; pickupStopId: string; dropoffStopId: string }[];
  rowVersion: number;
};
export type Ticket = {
  id: string;
  publicCode: string;
  bookingId: string;
  tripId: string;
  passengerName: string;
  seatCode: string;
  status: string;
  paymentChannel: string;
  qrPayload?: string;
  issuedAt: string;
  checkedInAt?: string;
  rowVersion: number;
};
export type Payment = {
  id: string;
  bookingId: string;
  status: string;
  amount: number;
  currency: string;
  provider: string;
  providerAction?: { redirectUri?: string };
  statusUrl?: string;
};
export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
};

export type SessionStore = {
  read(): Session | null;
  write(session: Session | null): void;
};

export function createSessionStore(storageKey = "busticket.session"): SessionStore {
  const storage = typeof globalThis.sessionStorage === "undefined" ? null : globalThis.sessionStorage;
  return {
    read() {
      const raw = storage?.getItem(storageKey);
      return raw ? (JSON.parse(raw) as Session) : null;
    },
    write(session) {
      if (!storage) return;
      if (session) storage.setItem(storageKey, JSON.stringify(session));
      else storage.removeItem(storageKey);
    },
  };
}

export const browserSession = createSessionStore();

function idempotencyKey() {
  return crypto.randomUUID().replaceAll("-", "") + "00";
}

export function createClient(options: { baseUrl?: string; session: SessionStore }) {
  const baseUrl = options.baseUrl ?? "";
  let inflightRefresh: Promise<boolean> | null = null;

  async function parse<T>(response: Response): Promise<T> {
    if (response.status === 204) return undefined as T;
    const text = await response.text();
    const body = text ? JSON.parse(text) : null;
    if (!response.ok) {
      const err = body as ErrorEnvelope | null;
      throw new ApiError(
        response.status,
        err?.error?.code ?? "HTTP_ERROR",
        err?.error?.message ?? response.statusText,
        err?.error?.correlationId,
        err?.error?.details,
      );
    }
    return body as T;
  }

  async function refresh(): Promise<boolean> {
    const session = options.session.read();
    if (!session?.refreshToken) return false;
    const response = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey() },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
    });
    if (!response.ok) {
      options.session.write(null);
      return false;
    }
    options.session.write(await parse<Session>(response));
    return true;
  }

  async function request<T>(path: string, init: RequestInit & { auth?: boolean; idempotent?: boolean } = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    if (init.idempotent) headers.set("Idempotency-Key", headers.get("Idempotency-Key") ?? idempotencyKey());
    const session = options.session.read();
    if (init.auth !== false && session?.accessToken) headers.set("Authorization", `Bearer ${session.accessToken}`);
    const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
    if (response.status === 401 && init.auth !== false && session?.refreshToken) {
      inflightRefresh ??= refresh().finally(() => {
        inflightRefresh = null;
      });
      if (await inflightRefresh) return request<T>(path, init);
    }
    return parse<T>(response);
  }

  return {
    request,
    register: (body: { fullName: string; email: string; phone: string; password: string }) =>
      request<{ operationId: string; status: string }>("/api/v1/auth/register", {
        method: "POST",
        body: JSON.stringify(body),
        auth: false,
      }),
    verify: async (body: { challengeId: string; code: string }) => {
      const session = await request<Session>("/api/v1/auth/verify", {
        method: "POST",
        body: JSON.stringify(body),
        auth: false,
        idempotent: true,
      });
      if (session?.accessToken) options.session.write(session);
      return session;
    },
    resendVerification: (email: string) =>
      request<{ operationId: string; status: string }>("/api/v1/auth/resend-verification", {
        method: "POST",
        body: JSON.stringify({ email }),
        auth: false,
        idempotent: true,
      }),
    login: async (identifier: string, password: string) => {
      const session = await request<Session>("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({ identifier, password }),
        auth: false,
      });
      options.session.write(session);
      return session;
    },
    logout: async () => {
      try {
        await request("/api/v1/auth/logout", { method: "POST", auth: true });
      } finally {
        options.session.write(null);
      }
    },
    forgotPassword: (email: string) =>
      request<{ operationId: string }>("/api/v1/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
        auth: false,
        idempotent: true,
      }),
    resetPassword: (body: { challengeId: string; code: string; newPassword: string }) =>
      request("/api/v1/auth/reset-password", {
        method: "POST",
        body: JSON.stringify(body),
        auth: false,
        idempotent: true,
      }),
    me: () => request<UserProfile>("/api/v1/users/me"),
    updateMe: (body: { fullName?: string; email?: string; phone?: string; expectedVersion: number }) =>
      request<UserProfile>("/api/v1/users/me", { method: "PATCH", body: JSON.stringify(body) }),
    searchTrips: (query: URLSearchParams | Record<string, string>) => {
      const qs = query instanceof URLSearchParams ? query.toString() : new URLSearchParams(query).toString();
      return request<TripPage>(`/api/v1/trips?${qs}`);
    },
    getTrip: (tripId: string) => request<Trip>(`/api/v1/trips/${tripId}`),
    getTripStops: (tripId: string) => request<TripStop[]>(`/api/v1/trips/${tripId}/stops`),
    getSeats: (tripId: string) => request<{ tripId: string; seats: Seat[]; serverTime: string }>(`/api/v1/trips/${tripId}/seats`),
    createHold: (tripId: string, body: { seatIds: string[]; pickupStopId: string; dropoffStopId: string }) =>
      request<SeatHold>(`/api/v1/trips/${tripId}/seat-holds`, {
        method: "POST",
        body: JSON.stringify(body),
        idempotent: true,
      }),
    getHold: (token: string) => request<SeatHold>(`/api/v1/seat-holds/${encodeURIComponent(token)}`),
    releaseHold: (token: string) =>
      request(`/api/v1/seat-holds/${encodeURIComponent(token)}`, { method: "DELETE" }),
    createBooking: (body: unknown) =>
      request<Booking>("/api/v1/bookings", { method: "POST", body: JSON.stringify(body), idempotent: true }),
    listBookings: () => request<{ items: Booking[] }>("/api/v1/bookings?page=0&size=20"),
    getBooking: (id: string) => request<Booking>(`/api/v1/bookings/${id}`),
    previewCancel: (bookingId: string, ticketIds: string[]) =>
      request<{ previewId: string; fee: number; refundAmount: number; currency: string; expiresAt: string }>(
        `/api/v1/bookings/${bookingId}/cancellation-preview`,
        { method: "POST", body: JSON.stringify({ ticketIds }), idempotent: true },
      ),
    cancelBooking: (bookingId: string, body: { previewId: string; reason: string; expectedVersion: number }) =>
      request(`/api/v1/bookings/${bookingId}/cancel`, {
        method: "POST",
        body: JSON.stringify(body),
        idempotent: true,
      }),
    listTickets: () => request<{ items: Ticket[] }>("/api/v1/tickets?page=0&size=20"),
    getTicket: (id: string) => request<Ticket>(`/api/v1/tickets/${id}`),
    createPayment: (bookingId: string, body: { provider: string; method: string; returnUri: string }) =>
      request<Payment>(`/api/v1/bookings/${bookingId}/payments`, {
        method: "POST",
        body: JSON.stringify(body),
        idempotent: true,
      }),
    getPayment: (id: string) => request<Payment>(`/api/v1/payments/${id}`),
    listNotifications: () => request<{ items: NotificationItem[]; nextCursor?: string }>("/api/v1/notifications?limit=20"),
    markNotificationRead: (id: string) => request(`/api/v1/notifications/${id}/read`, { method: "PATCH" }),
    operatorOrganization: () => request<{ id: string; name: string; status: string; allowPayLater?: boolean; contactEmail?: string; contactPhone?: string; rowVersion: number }>("/api/v1/operator/organization"),
    patchOrganization: (body: { name: string; contactEmail: string; contactPhone: string; allowPayLater: boolean; expectedVersion: number }) =>
      request("/api/v1/operator/organization", { method: "PATCH", body: JSON.stringify(body) }),
    operatorBuses: () =>
      request<{ id: string; plateNumber: string; type: string; status: string; expectedVersion: number; seats: { code: string }[] }[]>("/api/v1/operator/buses"),
    createBus: (body: { plateNumber: string; type: string; amenities: string[]; expectedVersion: number }) =>
      request("/api/v1/operator/buses", { method: "POST", body: JSON.stringify(body), idempotent: true }),
    operatorDrivers: () =>
      request<{ id: string; userId: string; licenseNumber: string; licenseExpiresOn: string; status: string; expectedVersion: number }[]>(
        "/api/v1/operator/drivers",
      ),
    createDriver: (body: { userId: string; licenseNumber: string; licenseExpiresOn: string; expectedVersion: number }) =>
      request("/api/v1/operator/drivers", { method: "POST", body: JSON.stringify(body), idempotent: true }),
    operatorRoutes: () =>
      request<{ id: string; name: string; origin: string; destination: string; status: string; expectedVersion: number }[]>("/api/v1/operator/routes"),
    createRoute: (body: { name: string; origin: string; destination: string; durationMinutes: number; expectedVersion: number }) =>
      request("/api/v1/operator/routes", { method: "POST", body: JSON.stringify(body), idempotent: true }),
    createTrip: (body: {
      routeId: string;
      busId: string;
      driverId: string;
      departureAt: string;
      arrivalAt: string;
      fare: { amount: number; currency: string };
      policyVersion: string;
      expectedVersion: number;
    }) => request("/api/v1/operator/trips", { method: "POST", body: JSON.stringify(body), idempotent: true }),
    operatorTrips: () => request<TripPage>("/api/v1/operator/trips?page=0&size=50"),
    operatorPublish: (tripId: string, expectedVersion: number) =>
      request(`/api/v1/operator/trips/${tripId}/publish`, {
        method: "POST",
        body: JSON.stringify({ expectedVersion }),
        idempotent: true,
      }),
    operatorCancelTrip: (tripId: string, expectedVersion: number, reason = "OPERATOR_REQUEST") =>
      request(`/api/v1/operator/trips/${tripId}/cancel`, {
        method: "POST",
        body: JSON.stringify({ expectedVersion, reason }),
        idempotent: true,
      }),
    adminBookings: () => request<{ items: Booking[] }>("/api/v1/admin/bookings?page=0&size=20"),
    adminPayments: () => request<{ items: Payment[] }>("/api/v1/admin/payments?page=0&size=20"),
    report: (kind: "revenue" | "bookings" | "occupancy", from: string, to: string) =>
      request(`/api/v1/reports/${kind}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&timezone=Asia/Ho_Chi_Minh`),
    driverAssignments: () => request<{ tripId: string; startAt: string; endAt: string }[]>("/api/v1/driver/assignments"),
    manifest: (tripId: string) =>
      request<{
        tripId: string;
        generatedAt: string;
        passengers: { ticketId: string; passengerName: string; seatCode: string; pickupStopName: string; status: string }[];
      }>(`/api/v1/operator/trips/${tripId}/manifest`),
    checkIn: (ticketId: string, body: { tripId: string; scannedToken: string; expectedVersion: number }) =>
      request(`/api/v1/tickets/${ticketId}/check-in`, {
        method: "POST",
        body: JSON.stringify(body),
        idempotent: true,
      }),
    validateTicket: (body: { tripId: string; scannedToken: string; expectedVersion?: number }) =>
      request<{ valid: boolean; reasonCode?: string; ticket: Ticket | null }>("/api/v1/tickets/validate", {
        method: "POST",
        body: JSON.stringify({ expectedVersion: 0, ...body }),
      }),
  };
}

export type ApiClient = ReturnType<typeof createClient>;
