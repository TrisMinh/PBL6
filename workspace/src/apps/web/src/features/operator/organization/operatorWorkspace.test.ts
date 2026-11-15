import { beforeEach, describe, expect, it } from "vitest";
import { operatorBookingFixtures } from "@/mocks/fixtures/operatorBookings";
import {
  readWorkspace,
  saveOrganization,
  saveMember,
  setMemberStatus,
  settlementTotals,
  settlementCsv,
} from "./operatorWorkspace";

beforeEach(() => sessionStorage.clear());
describe("operator demo workspace", () => {
  it("persists organization changes without modifying member and settlement records", () => {
    const initial = readWorkspace();
    saveOrganization({ ...initial.organization, phone: "0912345678" });
    expect(readWorkspace().organization.phone).toBe("0912345678");
    expect(readWorkspace().members).toEqual(initial.members);
    expect(readWorkspace().settlements).toEqual(initial.settlements);
  });
  it("rejects duplicate emails and persists a valid invite with its chosen role", () => {
    expect(() =>
      saveMember({
        name: "Test",
        email: readWorkspace().members[0].email.toUpperCase(),
        phone: "0901234567",
        role: "dispatcher",
      }),
    ).toThrow(/đã tồn tại/);
    const saved = saveMember({
      name: "Phạm Bảo Ngọc",
      email: "ngoc@example.invalid",
      phone: "0901234567",
      role: "accountant",
    });
    expect(
      readWorkspace().members.find((m) => m.id === saved.id),
    ).toMatchObject({ role: "accountant", status: "invited" });
  });
  it("preserves at least one active owner and updates a non-owner member", () => {
    const members = readWorkspace().members;
    const owner = members.find((m) => m.role === "owner");
    const person = members.find((m) => m.role === "dispatcher");
    if (!owner || !person) throw Error("Missing owner/dispatcher seed");
    expect(() => setMemberStatus(owner.id, "suspended")).toThrow(
      /quản trị viên/,
    );
    setMemberStatus(person.id, "suspended");
    expect(
      readWorkspace().members.find((m) => m.id === person.id)?.status,
    ).toBe("suspended");
  });
  it("calculates settlement totals from amounts rather than static summary labels", () => {
    const records = readWorkspace().settlements;
    const totals = settlementTotals(records);
    expect(totals.net).toBe(totals.gross - totals.refunds - totals.commission);
    expect(new Set(records.map((r) => r.status)).size).toBe(3);
    expect(settlementCsv(records.slice(0, 1))).toContain(records[0].code);
    for (const settlement of records) {
      const booking = operatorBookingFixtures.find(
        (item) => item.id === settlement.bookingCode,
      );
      expect(booking?.amount).toBe(settlement.gross);
      expect(settlement.refunds + settlement.commission).toBeLessThanOrEqual(
        settlement.gross,
      );
    }
  });
  it("recovers cleanly from corrupt stored data", () => {
    sessionStorage.setItem("blue-operator-workspace-v1", "not json");
    expect(readWorkspace().members.length).toBeGreaterThan(4);
  });
});
