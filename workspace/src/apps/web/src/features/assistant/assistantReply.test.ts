import { expect, it } from "vitest";
import { getAssistantReply } from "./assistantReply";
it("prepares canonical route search from accented Vietnamese and date without claiming a reservation", () => {
  const reply = getAssistantReply("Sài Gòn đi Đà Lạt 01/01/2099, 2 người");
  const url = new URL(reply.actions?.[0].to ?? "", "https://example.invalid");
  expect(url.pathname).toBe("/trips");
  expect(Object.fromEntries(url.searchParams)).toEqual({
    originId: "loc-hcm",
    destinationId: "loc-dalat",
    departureDate: "2099-01-01",
    passengerCount: "2",
  });
  expect(reply.text).toContain("chưa đặt hoặc giữ ghế");
});
it("honors route direction and rejects past dates or excessive passengers", () => {
  const reply = getAssistantReply("Đà Lạt đi Sài Gòn 2099-01-01, 3 người");
  expect(reply.actions?.[0].to).toContain(
    "originId=loc-dalat&destinationId=loc-hcm",
  );
  expect(
    getAssistantReply("Sài Gòn đi Hà Nội 2000-01-01").actions,
  ).toBeUndefined();
  expect(
    getAssistantReply("Hà Nội đi Đà Nẵng 2099-01-01 9 người").actions,
  ).toBeUndefined();
});
it("offers supported help and keeps mock route IDs out of live mode", () => {
  expect(getAssistantReply("Tra cứu vé").actions?.[0].to).toBe(
    "/tickets/lookup",
  );
  expect(getAssistantReply("Hủy vé").actions?.[0].to).toBe("/account/tickets");
  expect(getAssistantReply("Thanh toán VNPay").text).toContain(
    "không thu tiền thật",
  );
  expect(getAssistantReply("Sài Gòn đi Đà Lạt", false).actions?.[0].to).toBe(
    "/trips",
  );
  expect(getAssistantReply("xin chào").text).toContain("chưa kết nối AI thật");
});
