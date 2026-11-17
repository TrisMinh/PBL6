import { beforeEach, expect, it, vi } from "vitest";
import { tripPictures, saveTripPicture } from "./tripPresentation";
import { metadata, request, saveMetadata } from "../liveOriginalApi";

vi.mock("../liveOriginalApi", () => ({
  metadata: vi.fn(),
  request: vi.fn(),
  saveMetadata: vi.fn(),
}));
const photo = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "trip.png",
  type: "image/png" as const,
  size: 100,
};
beforeEach(() => vi.resetAllMocks());
it("reads only the current organization's valid trip attachments", async () => {
  vi.mocked(request).mockResolvedValue({ id: "org" });
  vi.mocked(metadata).mockResolvedValue({
    org: { tripImages: { trip: photo, broken: { id: "invalid" } } },
    other: { tripImages: { hidden: photo } },
  });
  expect(await tripPictures()).toEqual({ trip: photo });
});
it("retains the organization's profile and other trip pictures when saving", async () => {
  vi.mocked(metadata).mockResolvedValue({
    org: { logo: "keep", tripImages: { earlier: photo } },
  });
  await saveTripPicture("new", "org", photo);
  expect(saveMetadata).toHaveBeenCalledWith("organization", "org", {
    logo: "keep",
    tripImages: { earlier: photo, new: photo },
  });
});
it("propagates a failed attachment save so the form can offer retry", async () => {
  vi.mocked(metadata).mockResolvedValue({});
  vi.mocked(saveMetadata).mockRejectedValue(new Error("Unavailable"));
  await expect(saveTripPicture("new", "org", photo)).rejects.toThrow(
    "Unavailable",
  );
});
