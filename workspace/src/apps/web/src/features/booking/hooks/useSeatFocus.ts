import { useRef } from "react";

export interface SeatFocus {
  bindRegion: (node: HTMLDivElement | null) => void;
  remember: () => void;
  restore: () => void;
}
export function useSeatFocus(): SeatFocus {
  const target = useRef<HTMLElement | null>(null);
  const region = useRef<HTMLDivElement | null>(null);
  return {
    bindRegion: (node) => {
      region.current = node;
    },
    remember: () => {
      target.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
    },
    restore: () => {
      const element = target.current;
      if (element?.isConnected && !element.matches(":disabled"))
        element.focus();
      else
        region.current?.querySelector<HTMLElement>('[role="region"]')?.focus();
    },
  };
}
