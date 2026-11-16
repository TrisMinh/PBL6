import { useEffect, useLayoutEffect } from "react";
import { useLocation } from "react-router";

const REVEAL_TARGETS = [
  ".popular-routes",
  ".trust-journey",
  ".support-banner",
  ".explore-discovery",
  ".explore--catalog",
  ".partner-sales__benefits",
  ".partner-sales__process",
  ".partner-sales__faq",
  ".partner-sales__closing",
].join(",");

export function MotionExperience(): null {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (preference.matches) return;
    const main = document.querySelector<HTMLElement>(
      "#main-content, #operator-main, #admin-main-content",
    );
    if (!main?.animate) return;
    const animation = main.animate(
      [
        { opacity: 0.65, translate: "0 7px" },
        { opacity: 1, translate: "0 0" },
      ],
      { duration: 280, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
    );
    const stop = (): void => {
      if (preference.matches) animation.cancel();
    };
    preference.addEventListener("change", stop);
    return () => {
      animation.cancel();
      preference.removeEventListener("change", stop);
    };
  }, [pathname]);

  useEffect(() => {
    if (!["/", "/explore", "/partners"].includes(pathname)) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (preference.matches || !("IntersectionObserver" in window)) return;
    const root = document.querySelector(".app-startup__content");
    if (!root) return;
    const registered = new Set<HTMLElement>();
    let frame = 0;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.setAttribute("data-motion-reveal", "visible");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -24px 0px" },
    );

    const scan = (): void => {
      frame = 0;
      root.querySelectorAll<HTMLElement>(REVEAL_TARGETS).forEach((element) => {
        if (registered.has(element)) return;
        registered.add(element);
        // Above-the-fold content stays readable while the page starts.
        if (element.getBoundingClientRect().top < window.innerHeight - 24)
          return;
        element.dataset.motionReveal = "pending";
        observer.observe(element);
      });
    };
    const schedule = (): void => {
      if (!frame) frame = window.requestAnimationFrame(scan);
    };
    const mutations = new MutationObserver(schedule);
    mutations.observe(root, { childList: true, subtree: true });
    const showAll = (): void => {
      if (!preference.matches) return;
      observer.disconnect();
      mutations.disconnect();
      registered.forEach((element) =>
        element.removeAttribute("data-motion-reveal"),
      );
    };
    preference.addEventListener("change", showAll);
    scan();
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      mutations.disconnect();
      registered.forEach((element) =>
        element.removeAttribute("data-motion-reveal"),
      );
      preference.removeEventListener("change", showAll);
    };
  }, [pathname]);

  return null;
}
