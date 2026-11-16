import {
  useEffect,
  useState,
  useSyncExternalStore,
  type RefObject,
} from "react";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
function subscribeMotion(listener: () => void): () => void {
  const preference = window.matchMedia(REDUCED_MOTION);
  preference.addEventListener("change", listener);
  return () => preference.removeEventListener("change", listener);
}
const motionReduced = (): boolean => window.matchMedia(REDUCED_MOTION).matches;
const serverMotion = (): boolean => false;

export function useAutoCarousel(
  ref: RefObject<HTMLDivElement | null>,
  itemCount: number,
): { paused: boolean; reducedMotion: boolean; togglePaused: () => void } {
  const [paused, setPaused] = useState(false);
  const reducedMotion = useSyncExternalStore(
    subscribeMotion,
    motionReduced,
    serverMotion,
  );
  useEffect(() => {
    const track = ref.current;
    if (!track || paused || reducedMotion || itemCount < 2) return;
    const region = track.closest("section") ?? track;
    let timer: number | undefined;
    let visible = !("IntersectionObserver" in window);
    let disposed = false;
    let hovering =
      window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
      region.matches(":hover");
    let pressing = false;

    const schedule = (): void => {
      window.clearTimeout(timer);
      if (disposed) return;
      const focus = document.activeElement;
      if (
        !visible ||
        document.hidden ||
        hovering ||
        pressing ||
        (region.contains(focus) && focus?.matches(":focus-visible"))
      )
        return;
      timer = window.setTimeout(() => {
        const end = track.scrollWidth - track.clientWidth;
        if (end > 2) {
          const first = track.children[0]?.getBoundingClientRect();
          const second = track.children[1]?.getBoundingClientRect();
          const step =
            first && second ? second.left - first.left : track.clientWidth;
          track.scrollTo({
            left:
              track.scrollLeft >= end - 2
                ? 0
                : Math.min(end, track.scrollLeft + step),
            behavior: "smooth",
          });
        }
        schedule();
      }, 4500);
    };
    const enter = (event: PointerEvent): void => {
      if (event.pointerType === "mouse") hovering = true;
      schedule();
    };
    const leave = (): void => {
      hovering = false;
      pressing = false;
      schedule();
    };
    const press = (): void => {
      pressing = true;
      schedule();
    };
    const release = (): void => {
      pressing = false;
      schedule();
    };
    const focusOut = (): void => {
      queueMicrotask(schedule);
    };
    const observer =
      "IntersectionObserver" in window
        ? new IntersectionObserver(
            (entries) => {
              visible = entries.some(
                (entry) =>
                  entry.isIntersecting && entry.intersectionRatio >= 0.2,
              );
              schedule();
            },
            { threshold: 0.2 },
          )
        : undefined;
    observer?.observe(track);
    region.addEventListener("pointerenter", enter);
    region.addEventListener("pointerleave", leave);
    region.addEventListener("pointerdown", press, { passive: true });
    window.addEventListener("pointerup", release, { passive: true });
    region.addEventListener("focusin", schedule);
    region.addEventListener("focusout", focusOut);
    track.addEventListener("scroll", schedule, { passive: true });
    document.addEventListener("visibilitychange", schedule);
    schedule();
    return () => {
      disposed = true;
      window.clearTimeout(timer);
      observer?.disconnect();
      region.removeEventListener("pointerenter", enter);
      region.removeEventListener("pointerleave", leave);
      region.removeEventListener("pointerdown", press);
      window.removeEventListener("pointerup", release);
      region.removeEventListener("focusin", schedule);
      region.removeEventListener("focusout", focusOut);
      track.removeEventListener("scroll", schedule);
      document.removeEventListener("visibilitychange", schedule);
    };
  }, [ref, itemCount, paused, reducedMotion]);

  return {
    paused: paused || reducedMotion,
    reducedMotion,
    togglePaused: () => setPaused((value) => !value),
  };
}
