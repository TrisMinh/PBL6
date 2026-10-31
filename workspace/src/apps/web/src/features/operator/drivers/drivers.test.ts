import { beforeEach, describe, expect, it, vi } from "vitest";
import { driversSchema, driverSchema } from "./drivers.schema";
const endpoint = new URL(
  "/api/v1/operator/drivers-preview",
  window.location.origin,
);
async function request(
  suffix = "",
  method = "GET",
  body?: unknown,
): Promise<Response> {
  return fetch(`${endpoint}${suffix}`, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
async function fixture(): Promise<Record<string, unknown>> {
  const {
    id: _id,
    joinedAt: _joined,
    status: _status,
    ...input
  } = driversSchema.parse(await (await request()).json())[0] ??
  (() => {
    throw Error("Missing fixture");
  })();
  void _id;
  void _joined;
  void _status;
  return input;
}
describe("Operator drivers mock", () => {
  beforeEach(() => sessionStorage.removeItem("blue-operator-drivers-v1"));
  it("returns six designed drivers and persists validated create/edit without changing status", async () => {
    const list = driversSchema.parse(await (await request()).json());
    expect(list).toHaveLength(6);
    expect(list[0]).toMatchObject({
      id: "TX-001",
      name: "Nguyễn Minh Khang",
      licenseNumber: "790123456789",
    });
    const input = {
      ...(await fixture()),
      name: "Tài Xế Mới",
      phone: "0912345678",
      licenseNumber: "123456789012",
    };
    const created = await request("", "POST", input);
    expect(created.status).toBe(201);
    const item = driverSchema.parse(await created.json());
    expect(item.id).toBe("TX-007");
    expect(
      (await request(`/${item.id}`, "PUT", { ...input, address: "Đà Lạt" }))
        .status,
    ).toBe(200);
    expect(
      JSON.parse(sessionStorage.getItem("blue-operator-drivers-v1") ?? "[]"),
    ).toHaveLength(7);
    const next = driversSchema.parse(await (await request()).json());
    expect(next[6]).toMatchObject({ address: "Đà Lạt", status: "available" });
  });
  it("rejects duplicates, bad dates/phones and missing driver without mutating the catalogue", async () => {
    const input = await fixture();
    expect((await request("", "POST", input)).status).toBe(409);
    for (const overrides of [
      { phone: "abc" },
      { expiresAt: "2020-01-01" },
      { birthDate: "2024-02-30" },
      { licenseNumber: "123" },
    ])
      expect(
        (await request("/TX-001", "PUT", { ...input, ...overrides })).status,
      ).toBe(400);
    expect((await request("/TX-999", "PUT", input)).status).toBe(404);
    expect(driversSchema.parse(await (await request()).json())).toHaveLength(6);
    expect(sessionStorage.getItem("blue-operator-drivers-v1")).toBeNull();
  });
  it("pauses and resumes available drivers but protects running assignments", async () => {
    expect(
      (await request("/TX-001/status", "PATCH", { status: "paused" })).status,
    ).toBe(200);
    expect(
      driverSchema.parse(
        await (
          await request("/TX-001/status", "PATCH", { status: "available" })
        ).json(),
      ).status,
    ).toBe("available");
    expect(
      (await request("/TX-002/status", "PATCH", { status: "paused" })).status,
    ).toBe(409);
    expect(
      (await request("/TX-001/status", "PATCH", { status: "running" })).status,
    ).toBe(400);
  });
  it("recovers invalid caches and does not report success when storage fails", async () => {
    sessionStorage.setItem("blue-operator-drivers-v1", "broken");
    expect(driversSchema.parse(await (await request()).json())).toHaveLength(6);
    sessionStorage.removeItem("blue-operator-drivers-v1");
    const mock = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw Error("quota");
      });
    expect(
      (await request("/TX-001/status", "PATCH", { status: "paused" })).status,
    ).toBe(503);
    mock.mockRestore();
    expect(driversSchema.parse(await (await request()).json())[0]?.status).toBe(
      "available",
    );
  });
});

describe("Add Driver profile details", () => {
  beforeEach(() => sessionStorage.removeItem("blue-operator-drivers-v1"));
  it("creates optional-profile fields and preserves attachments, notes and status when editing", async () => {
    const file = {
      id: "01234567-89ab-4def-8123-456789abcdef",
      name: "front.pdf",
      type: "application/pdf",
      size: 100,
    };
    const input = {
      ...(await fixture()),
      phone: "0912345678",
      licenseNumber: "123456789012",
      email: "",
      birthDate: "",
      address: "",
      notes: "Quen tuyến Đà Lạt",
      status: "paused",
      licenseFront: file,
    };
    const response = await request("", "POST", input);
    expect(response.status).toBe(201);
    const item = driverSchema.parse(await response.json());
    expect(item).toMatchObject({
      email: "",
      birthDate: "",
      status: "paused",
      licenseFront: file,
      notes: input.notes,
    });
    const {
      status: _status,
      licenseFront: _file,
      notes: _notes,
      ...edit
    } = input;
    void _status;
    void _file;
    void _notes;
    const updated = driverSchema.parse(
      await (
        await request("/" + item.id, "PUT", { ...edit, name: "Tên đã sửa" })
      ).json(),
    );
    expect(updated).toMatchObject({
      name: "Tên đã sửa",
      status: "paused",
      licenseFront: file,
      notes: input.notes,
    });
  });
  it("rejects invalid initial status, attachment MIME/size and future birth date without saving", async () => {
    const input = {
      ...(await fixture()),
      phone: "0912345678",
      licenseNumber: "123456789012",
    };
    const file = {
      id: "01234567-89ab-4def-8123-456789abcdef",
      name: "file.pdf",
      type: "application/pdf",
      size: 100,
    };
    for (const extra of [
      { status: "running" },
      { avatar: file },
      { licenseFront: { ...file, size: 11 * 1024 * 1024 } },
      { licenseBack: { ...file, type: "text/html" } },
      { birthDate: "2099-01-01" },
    ])
      expect((await request("", "POST", { ...input, ...extra })).status).toBe(
        400,
      );
    expect(driversSchema.parse(await (await request()).json())).toHaveLength(6);
  });
});

describe("Edit Driver full profile", () => {
  beforeEach(() => sessionStorage.removeItem("blue-operator-drivers-v1"));
  it("updates profile/status/notes/attachments atomically and supports removing attachments", async () => {
    const input = await fixture(),
      front = {
        id: "01234567-89ab-4def-8123-456789abcdef",
        name: "license.png",
        type: "image/png",
        size: 100,
      };
    const response = await request("/TX-001", "PUT", {
      ...input,
      name: "Khang đã sửa",
      notes: "Tuyến quen thuộc",
      status: "paused",
      licenseFront: front,
    });
    expect(response.status).toBe(200);
    const edited = driverSchema.parse(await response.json());
    expect(edited).toMatchObject({
      id: "TX-001",
      joinedAt: "2024-03-12",
      name: "Khang đã sửa",
      notes: "Tuyến quen thuộc",
      status: "paused",
      licenseFront: front,
    });
    const removed = driverSchema.parse(
      await (
        await request("/TX-001", "PUT", { ...input, licenseFront: null })
      ).json(),
    );
    expect(removed.licenseFront).toBeUndefined();
    expect(removed.notes).toBe("Tuyến quen thuộc");
    expect(removed.status).toBe("paused");
  });
  it("prevents changing running state and leaves all fields unchanged on conflicts", async () => {
    const list = driversSchema.parse(await (await request()).json()),
      running = list.find((d) => d.id === "TX-002");
    if (!running) throw Error("Missing fixture");
    const response = await request("/TX-002", "PUT", {
      ...running,
      name: "Must not save",
      status: "paused",
    });
    expect(response.status).toBe(409);
    expect(
      (
        await request("/TX-001", "PUT", {
          ...(await fixture()),
          status: "running",
        })
      ).status,
    ).toBe(400);
    const next = driversSchema.parse(await (await request()).json());
    expect(next.find((d) => d.id === "TX-002")).toEqual(running);
    expect(
      (
        await request("/TX-002", "PUT", {
          ...running,
          notes: "Chỉ cập nhật hồ sơ",
        })
      ).status,
    ).toBe(200);
  });
});
