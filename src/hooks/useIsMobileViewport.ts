"use client";

import { useSyncExternalStore } from "react";

const MOBILE_QUERY = "(max-width: 639px)";

function getViewportWidth() {
  if (typeof window === "undefined") return false;
  const visualViewportWidth = window.visualViewport?.width;
  const width = typeof visualViewportWidth === "number"
    ? visualViewportWidth
    : window.innerWidth;
  return width <= 639;
}

function subscribe(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const media = window.matchMedia(MOBILE_QUERY);
  const onChange = () => onStoreChange();

  media.addEventListener("change", onChange);
  window.addEventListener("resize", onChange);
  window.addEventListener("orientationchange", onChange);
  window.addEventListener("pageshow", onChange);
  document.addEventListener("visibilitychange", onChange);
  window.visualViewport?.addEventListener("resize", onChange);

  return () => {
    media.removeEventListener("change", onChange);
    window.removeEventListener("resize", onChange);
    window.removeEventListener("orientationchange", onChange);
    window.removeEventListener("pageshow", onChange);
    document.removeEventListener("visibilitychange", onChange);
    window.visualViewport?.removeEventListener("resize", onChange);
  };
}

function getServerSnapshot() {
  return false;
}

export function useIsMobileViewport() {
  return useSyncExternalStore(subscribe, getViewportWidth, getServerSnapshot);
}
