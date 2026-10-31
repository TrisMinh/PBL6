import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/server";
import {
  exploreRepository,
  ExploreRepositoryError,
} from "@/features/explore/exploreRepository";
import { provinceDetailSchema } from "@/features/explore/explore.schema";

describe("Explore repository network boundary", () => {
  it("returns deterministic province summaries and matching pickup/dropoff detail", async () => {
    const provinces = await exploreRepository.list();
    expect(provinces.map((item) => item.slug)).toContain("lam-dong");
    for (const province of provinces) {
      const detail = await exploreRepository.detail(province.slug);
      expect(detail.slug).toBe(province.slug);
      expect(detail.pickupCount).toBe(
        detail.points.filter((point) => point.services.includes("pickup"))
          .length,
      );
      expect(detail.dropoffCount).toBe(
        detail.points.filter((point) => point.services.includes("dropoff"))
          .length,
      );
      expect(detail.isMock).toBe(true);
      for (const point of detail.points) {
        expect(point.latitude).toBeNull();
        expect(point.longitude).toBeNull();
        expect(point.coordinateSource).toBeNull();
        expect(detail.operators.map((operator) => operator.id)).toEqual(
          expect.arrayContaining(point.operatorIds),
        );
      }
    }
  });
  it("rejects unknown provinces as terminal404 and unsafe slugs before a request", async () => {
    await expect(
      exploreRepository.detail("unknown-province"),
    ).rejects.toMatchObject({ status: 404, canRetry: false });
    await expect(exploreRepository.detail("../private")).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
  });
  it("rejects malformed data and never exposes raw payloads", async () => {
    server.use(
      http.get("/api/v1/explore/provinces", () =>
        HttpResponse.json({ secret: "untrusted" }),
      ),
    );
    await expect(exploreRepository.list()).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
      message: "Không thể tải dữ liệu khám phá.",
    });
  });
  it("maps retryable network and service errors safely", async () => {
    server.use(
      http.get("/api/v1/explore/provinces", () => HttpResponse.error()),
    );
    await expect(exploreRepository.list()).rejects.toBeInstanceOf(
      ExploreRepositoryError,
    );
    server.use(
      http.get(
        "/api/v1/explore/provinces",
        () => new HttpResponse(null, { status: 503 }),
      ),
    );
    await expect(exploreRepository.list()).rejects.toMatchObject({
      status: 503,
      canRetry: true,
    });
  });
  it("rejects an invented partial coordinate pair and inconsistent counts", async () => {
    const detail = await exploreRepository.detail("lam-dong");
    const point = detail.points[0];
    expect(point).toBeDefined();
    expect(
      provinceDetailSchema.safeParse({
        ...detail,
        points: [{ ...point, latitude: 11 }],
      }).success,
    ).toBe(false);
    expect(
      provinceDetailSchema.safeParse({ ...detail, pickupCount: 999 }).success,
    ).toBe(false);
  });
  it("forwards cancellation and rejects malformed JSON or a mismatched detail", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      exploreRepository.list(controller.signal),
    ).rejects.toMatchObject({ code: "ABORTED", canRetry: false });
    server.use(
      http.get(
        "/api/v1/explore/provinces",
        () =>
          new HttpResponse("not-json", {
            headers: { "Content-Type": "application/json" },
          }),
      ),
    );
    await expect(exploreRepository.list()).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
    const detail = await exploreRepository.detail("lam-dong");
    server.use(
      http.get("/api/v1/explore/provinces/lam-dong", () =>
        HttpResponse.json({ ...detail, slug: "ha-noi" }),
      ),
    );
    await expect(exploreRepository.detail("lam-dong")).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
  });
});
