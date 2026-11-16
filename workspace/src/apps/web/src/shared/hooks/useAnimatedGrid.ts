import { useLayoutEffect, useRef, type RefObject } from "react";

/** Animate position changes while React retains the cards and their state. */
export function useAnimatedGrid(
  layoutKey: string,
): RefObject<HTMLUListElement | null> {
  const ref = useRef<HTMLUListElement>(null);
  const positions = useRef(new Map<string, { x: number; y: number }>());

  useLayoutEffect(() => {
    const list = ref.current;
    if (!list) return;
    const origin = list.getBoundingClientRect();
    const next = new Map<string, { x: number; y: number }>();
    const animations: Animation[] = [];
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    Array.from(list.children).forEach((element) => {
      if (!(element instanceof HTMLElement)) return;
      const key = element.dataset.motionKey;
      if (!key) return;
      const rect = element.getBoundingClientRect();
      const position = { x: rect.left - origin.left, y: rect.top - origin.top };
      const previous = positions.current.get(key);
      next.set(key, position);
      if (!previous || preference.matches || !element.animate) return;
      const x = previous.x - position.x;
      const y = previous.y - position.y;
      if (Math.abs(x) < 1 && Math.abs(y) < 1) return;
      animations.push(
        element.animate(
          [{ translate: `${x}px ${y}px` }, { translate: "0px 0px" }],
          { duration: 320, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
        ),
      );
    });
    positions.current = next;
    const stop = (): void => {
      if (preference.matches)
        animations.forEach((animation) => animation.cancel());
    };
    preference.addEventListener("change", stop);
    return () => {
      animations.forEach((animation) => animation.cancel());
      preference.removeEventListener("change", stop);
    };
  }, [layoutKey]);

  return ref;
}
