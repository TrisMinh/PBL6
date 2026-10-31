import { useEffect, useState } from "react";

import { useBookingDraftStore } from "@/features/booking/store/bookingDraftStore";

export function useBookingDraftHydration(): boolean {
  const [isHydrated, setIsHydrated] = useState(false);
  useEffect(() => {
    let active = true;
    void Promise.resolve(useBookingDraftStore.persist.rehydrate()).then(() => {
      if (active) setIsHydrated(true);
    });
    return () => {
      active = false;
    };
  }, []);
  return isHydrated;
}
