import type { ReactElement } from "react";
import "./ExploreImage.css";

export type Artwork = readonly [sheet: string, index: number, columns?: number];

export function ExploreImage({
  art,
  eager = false,
}: {
  art: Artwork;
  eager?: boolean;
}): ReactElement {
  const [sheet, index, columns = 2] = art;
  const row = Math.floor(index / columns);
  return (
    <div className="explore-discovery__image">
      <img
        src={`/images/explore/${sheet}.webp`}
        alt=""
        loading={eager ? "eager" : "lazy"}
        data-wide={columns === 2 || undefined}
        style={{
          width: `${columns * 100}%`,
          height: columns === 1 ? "100%" : "200%",
          left: `${-100 * (index % columns)}%`,
          top: `${-100 * row}%`,
          transformOrigin: `center ${columns === 1 ? 50 : 25 + 50 * row}%`,
        }}
      />
    </div>
  );
}
