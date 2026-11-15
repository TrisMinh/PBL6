import { useEffect, useState, type ReactElement } from "react";
import { Link } from "react-router";
import { ClockCounterClockwise } from "@phosphor-icons/react/dist/csr/ClockCounterClockwise";
import { ArrowRight } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { X } from "@phosphor-icons/react/dist/csr/X";
import {
  homeSearchPath,
  readRecentSearches,
  rememberSearch,
  removeRecentSearch,
  RECENT_SEARCHES_EVENT,
  type RecentSearch,
} from "../../lib/recentSearches";
import "./RecentSearches.css";
export function RecentSearches(): ReactElement | null {
  const [items, setItems] = useState<RecentSearch[]>([]);
  useEffect(() => {
    const refresh = (): void => setItems(readRecentSearches());
    refresh();
    window.addEventListener(RECENT_SEARCHES_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(RECENT_SEARCHES_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  if (!items.length) return null;
  return (
    <section className="recent-searches" aria-label="Tìm kiếm gần đây">
      <header>
        <h2>
          <ClockCounterClockwise size={21} aria-hidden="true" />
          Tìm kiếm gần đây
        </h2>
        <button type="button" onClick={() => removeRecentSearch()}>
          Xóa tất cả
        </button>
      </header>
      <ul>
        {items.map((item) => {
          const key = homeSearchPath(item.search);
          return (
            <li key={key}>
              <Link to={key} onClick={() => rememberSearch(item)}>
                <strong>
                  {item.originLabel}
                  <ArrowRight size={14} aria-hidden="true" />
                  {item.destinationLabel}
                </strong>
                <span>
                  {item.search.departureDate.split("-").reverse().join("/")} ·{" "}
                  {item.search.passengerCount} người
                </span>
              </Link>
              <button
                type="button"
                aria-label={`Xóa tìm kiếm ${item.originLabel} đến ${item.destinationLabel}`}
                onClick={() => removeRecentSearch(key)}
              >
                <X size={16} aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
