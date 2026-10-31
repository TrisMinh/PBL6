import { apiBaseUrl, isMockApi } from "./config";
import { ApiError, responseError } from "./error";
import {
  backendSessionSchema,
  clearApiSession,
  readApiSession,
  saveApiSession,
  refreshAttemptKey,
} from "./session";

let refreshInFlight: Promise<string> | undefined;
export async function refreshAccessToken(): Promise<string> {
  if (refreshInFlight) return refreshInFlight;
  const session = readApiSession();
  if (!session)
    throw new ApiError("AUTHENTICATION_REQUIRED", 401, "Vui lòng đăng nhập.");
  refreshInFlight = (async () => {
    const response = await globalThis.fetch(
      `${apiBaseUrl}/api/v1/auth/refresh`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": refreshAttemptKey(session.sessionId),
        },
        body: JSON.stringify({ refreshToken: session.refreshToken }),
        signal: AbortSignal.timeout(20_000),
      },
    );
    // Never let a late refresh restore a signed-out or replaced session.
    if (readApiSession()?.refreshToken !== session.refreshToken)
      throw new ApiError(
        "SESSION_CHANGED",
        401,
        "Phiên đăng nhập đã thay đổi.",
      );
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) clearApiSession();
      throw await responseError(response);
    }
    let next;
    try {
      next = backendSessionSchema.parse(await response.json());
    } catch {
      throw new ApiError(
        "INVALID_RESPONSE",
        response.status,
        "Dữ liệu phiên đăng nhập không hợp lệ.",
      );
    }
    if (readApiSession()?.refreshToken !== session.refreshToken)
      throw new ApiError(
        "SESSION_CHANGED",
        401,
        "Phiên đăng nhập đã thay đổi.",
      );
    return saveApiSession(next).accessToken;
  })()
    .catch((error: unknown) => {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        "NETWORK_ERROR",
        0,
        "Không thể làm mới phiên đăng nhập. Vui lòng kiểm tra kết nối.",
      );
    })
    .finally(() => {
      refreshInFlight = undefined;
    });
  return refreshInFlight;
}

export interface ApiOptions extends RequestInit {
  auth?: boolean;
}
/** Only application-relative API paths are accepted, so credentials cannot leak to another host. */
export async function apiFetch(
  path: string | URL,
  options: ApiOptions = {},
): Promise<Response> {
  const value = String(path);
  if (isMockApi) return globalThis.fetch(path, options);
  if (
    !value.startsWith("/api/v1/") ||
    value.includes("\\") ||
    value.includes("#")
  )
    throw new ApiError("INVALID_API_PATH", 0, "Đường dẫn API không hợp lệ.");
  if (
    /\/operator\/[^/?]*-preview(?:[/?]|$)|\/booking-sessions(?:[/?]|$)|\/explore\/(?!routes(?:[/?]|$))|\/locations(?:[/?]|$)|\/auth\/oauth(?:[/?]|$)/.test(
      value,
    )
  )
    throw new ApiError(
      "FEATURE_UNAVAILABLE",
      501,
      "Chức năng này chưa có API tương ứng.",
    );
  const { auth = true, ...init } = options;
  let session = auth ? readApiSession() : null;
  if (session && session.expiresAt <= Date.now() + 30_000) {
    await refreshAccessToken();
    session = readApiSession();
  }
  const headers = new Headers(init.headers);
  headers.delete("X-Mock-Session-Token");
  headers.delete("X-Ticket-Access-Token");
  headers.set("Accept", "application/json");
  headers.set("X-Correlation-ID", crypto.randomUUID());
  const send = (token?: string): Promise<Response> => {
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return globalThis.fetch(`${apiBaseUrl}${value}`, {
      ...init,
      headers,
      signal: init.signal
        ? AbortSignal.any([init.signal, AbortSignal.timeout(20_000)])
        : AbortSignal.timeout(20_000),
    });
  };
  try {
    let response = await send(session?.accessToken);
    if (
      response.status === 401 &&
      session &&
      !value.startsWith("/api/v1/auth/")
    ) {
      const current = readApiSession();
      const token =
        current && current.accessToken !== session.accessToken
          ? current.accessToken
          : await refreshAccessToken();
      response = await send(token); // At most one retry, preserving body and idempotency key.
      if (response.status === 401) clearApiSession();
    }
    return response;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (init.signal?.aborted)
      throw new ApiError("ABORTED", 0, "Yêu cầu đã được hủy.");
    throw new ApiError(
      "NETWORK_ERROR",
      0,
      "Không kết nối được dịch vụ. Vui lòng thử lại.",
    );
  }
}

export async function apiJson<T>(
  path: string,
  schema: { parse(value: unknown): T },
  options: Omit<ApiOptions, "body"> & {
    body?: unknown;
    idempotencyKey?: string;
  } = {},
): Promise<T> {
  const { body, idempotencyKey, ...init } = options;
  const headers = new Headers(init.headers);
  if (body !== undefined) headers.set("Content-Type", "application/json");
  if (idempotencyKey) headers.set("Idempotency-Key", idempotencyKey);
  const response = await apiFetch(path, {
    ...init,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) throw await responseError(response);
  try {
    return schema.parse(
      response.status === 204 ? undefined : await response.json(),
    );
  } catch {
    throw new ApiError(
      "INVALID_RESPONSE",
      response.status,
      "Dữ liệu dịch vụ trả về không hợp lệ.",
    );
  }
}

export async function logoutApi(): Promise<void> {
  const session = readApiSession();
  clearApiSession();
  if (!session) return;
  await apiJson(
    "/api/v1/auth/logout",
    { parse: () => undefined },
    {
      method: "POST",
      auth: false,
      headers: { Authorization: `Bearer ${session.accessToken}` },
      idempotencyKey: crypto.randomUUID(),
    },
  );
}
