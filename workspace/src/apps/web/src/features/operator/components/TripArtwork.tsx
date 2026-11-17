import type { ReactElement } from "react";
import { useDriverFileUrl } from "../drivers/driverFiles";
import type { DriverAttachment } from "../drivers/drivers.schema";
import fallback from "@/assets/operator/schedule/imgTripVehicleThumbnail.png";
export function TripArtwork({
  photo,
  file,
  className,
  alt = "Ảnh chuyến xe",
}: {
  photo?: DriverAttachment;
  file?: File;
  className?: string;
  alt?: string;
}): ReactElement {
  const url = useDriverFileUrl(file ?? photo);
  return (
    <img
      className={className}
      src={url ?? fallback}
      alt={alt}
      onError={(event) => {
        event.currentTarget.src = fallback;
      }}
    />
  );
}
