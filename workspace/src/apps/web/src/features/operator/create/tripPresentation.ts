import { metadata, request, saveMetadata } from "../liveOriginalApi";
import {
  driverAttachmentSchema,
  type DriverAttachment,
} from "../drivers/drivers.schema";
export async function tripPictures(
  signal?: AbortSignal,
): Promise<Record<string, DriverAttachment>> {
  const [org, values] = await Promise.all([
    request("/api/v1/operator/organization", "GET", undefined, signal),
    metadata("organization", signal),
  ]);
  const images = values[org.id]?.tripImages ?? {};
  return Object.fromEntries(
    Object.entries(images).flatMap(([id, value]) => {
      const parsed = driverAttachmentSchema.safeParse(value);
      return parsed.success ? [[id, parsed.data]] : [];
    }),
  );
}
export async function saveTripPicture(
  tripId: string,
  organizationId: string,
  photo: DriverAttachment,
): Promise<void> {
  const current = (await metadata("organization"))[organizationId] ?? {};
  await saveMetadata("organization", organizationId, {
    ...current,
    tripImages: { ...current.tripImages, [tripId]: photo },
  });
}
