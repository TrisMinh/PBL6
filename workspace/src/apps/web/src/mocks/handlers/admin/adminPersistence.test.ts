import { beforeEach, describe, expect, it } from "vitest";
import { MOCK_SESSION_HEADER } from "@/features/auth/config/session";
import { server } from "@/mocks/server";
import { createMockDb } from "@/mocks/state/mockDb";
import { createAdminHandlers } from "./createCrudHandlers";

const NOW = Date.parse("2026-11-15T10:00:00.000Z");
const TOKEN = "00000000-0000-4000-8000-000000000010";
const STORAGE_KEY = "blue-mock-admin-db";
const memory = new Map<string, string>();
const storage = {
  getItem: (key: string): string | null => memory.get(key) ?? null,
  setItem: (key: string, value: string): void => {
    memory.set(key, value);
  },
  removeItem: (key: string): void => {
    memory.delete(key);
  },
};
let nextId = 0;
function reload(): void {
  const db = createMockDb();
  db.authSessions.set(TOKEN, {
    token: TOKEN,
    userId: "mock-admin",
    role: "admin",
    createdAt: new Date(NOW).toISOString(),
    expiresAt: new Date(NOW + 3600000).toISOString(),
  });
  server.resetHandlers();
  server.use(
    ...createAdminHandlers({
      db,
      storage,
      now: () => NOW,
      id: () => `persist-${++nextId}`,
    }),
  );
}
function request(
  path: string,
  method = "GET",
  body?: unknown,
  key?: string,
): Promise<Response> {
  return fetch(new URL(`/api/v1/admin/${path}`, window.location.origin), {
    method,
    headers: {
      [MOCK_SESSION_HEADER]: TOKEN,
      "Content-Type": "application/json",
      ...(key ? { "Idempotency-Key": key } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
beforeEach(() => {
  memory.clear();
  nextId = 0;
  reload();
});

describe("admin mock archive across reloads", () => {
  it("preserves created and edited organizations when the handler runtime is recreated", async () => {
    const input = {
      name: "Nhà xe bền vững",
      contactEmail: "demo@example.invalid",
      contactPhone: "0901234567",
      status: "active",
    };
    const created = await request("organizations", "POST", input);
    expect(created.status).toBe(201);
    const record = (await created.json()) as { id: string };
    reload();
    const loaded = await request(`organizations/${record.id}`);
    expect(loaded.status).toBe(200);
    expect(await loaded.json()).toMatchObject(input);
    expect(
      (
        await request(`organizations/${record.id}`, "PUT", {
          ...input,
          name: "Nhà xe đã đổi tên",
          status: "inactive",
        })
      ).status,
    ).toBe(200);
    reload();
    expect(
      await (await request(`organizations/${record.id}`)).json(),
    ).toMatchObject({ name: "Nhà xe đã đổi tên", status: "inactive" });
  });
  it("preserves staff edits, membership updates and idempotent creation replays", async () => {
    const staff = {
      organizationId: "ORG-001",
      fullName: "Nguyễn An Demo",
      email: "an@example.invalid",
      phone: "0912345678",
      status: "active",
      role: "OPERATOR_SCHEDULER",
    };
    const response = await request("staff", "POST", staff);
    expect(response.status).toBe(201);
    const record = (await response.json()) as { id: string };
    const member = {
      staffId: record.id,
      organizationId: "ORG-002",
      role: "DRIVER",
      status: "active",
      reason: "Phân công thử nghiệm",
    };
    const created = await request(
      "memberships",
      "POST",
      member,
      "membership-persistent-key",
    );
    expect(created.status).toBe(201);
    const original = await created.json();
    reload();
    expect(await (await request(`staff/${record.id}`)).json()).toMatchObject(
      staff,
    );
    const replay = await request(
      "memberships",
      "POST",
      member,
      "membership-persistent-key",
    );
    expect(replay.status).toBe(201);
    expect(await replay.json()).toEqual(original);
    const updated = {
      ...member,
      role: "OPERATOR_SCHEDULER",
      status: "inactive",
      reason: "Tạm ngưng demo",
    };
    expect(
      (await request(`memberships/ORG-002/${record.id}`, "PUT", updated))
        .status,
    ).toBe(200);
    expect(
      (
        await request(`staff/${record.id}`, "PUT", {
          ...staff,
          fullName: "Nguyễn An cập nhật",
        })
      ).status,
    ).toBe(200);
    reload();
    expect(
      await (await request(`memberships?staffId=${record.id}`)).json(),
    ).toContainEqual(expect.objectContaining(updated));
    expect(await (await request(`staff/${record.id}`)).json()).toMatchObject({
      fullName: "Nguyễn An cập nhật",
    });
  });
  it("rejects corrupt and orphaned archives rather than exposing unvalidated records", async () => {
    memory.set(STORAGE_KEY, '{"version":1,"organizations":[{"id":"bad"}]}');
    expect(() => reload()).not.toThrow();
    expect((await request("organizations/ORG-001")).status).toBe(200);
    expect(memory.has(STORAGE_KEY)).toBe(false);
  });
});
