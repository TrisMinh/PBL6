import { delay, http, HttpResponse } from "msw";
import { exploreProvinces } from "@/mocks/fixtures/explore";
import { provinceSummarySchema } from "@/features/explore/explore.schema";

async function scenario(request: Request): Promise<Response | null> {
  if (import.meta.env.PROD) return null;
  const state = request.headers.get("x-mock-scenario");
  if (state === "loading") await delay(1200);
  if (state === "error")
    return HttpResponse.json(
      { title: "Dữ liệu tạm thời không khả dụng", status: 503 },
      { status: 503 },
    );
  return null;
}
export const exploreHandlers = [
  http.get("/api/v1/explore/provinces", async ({ request }) => {
    const failure = await scenario(request);
    if (failure) return failure;
    const empty =
      !import.meta.env.PROD &&
      request.headers.get("x-mock-scenario") === "empty";
    return HttpResponse.json({
      items: empty
        ? []
        : exploreProvinces.map((province) =>
            provinceSummarySchema.parse({
              slug: province.slug,
              name: province.name,
              region: province.region,
              description: province.description,
              operatorCount: province.operatorCount,
              pickupCount: province.pickupCount,
              dropoffCount: province.dropoffCount,
              isMock: province.isMock,
            }),
          ),
    });
  }),
  http.get("/api/v1/explore/provinces/:slug", async ({ request, params }) => {
    const failure = await scenario(request);
    if (failure) return failure;
    const province = exploreProvinces.find((item) => item.slug === params.slug);
    return province
      ? HttpResponse.json(province)
      : HttpResponse.json(
          { title: "Không tìm thấy tỉnh, thành", status: 404 },
          { status: 404 },
        );
  }),
];
