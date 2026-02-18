"use client";

import { useEffect, useState } from "react";

const MOBILE_QUERY = "(max-width: 639px)";

function getViewportMobileState() {
  if (typeof window === "undefined") return false;
  return window.matchMedia(MOBILE_QUERY).matches;
}

export function useIsMobileViewport() {
  const [isMobile, setIsMobile] = useState<boolean>(getViewportMobileState);

  useEffect(() => {
    const media = window.matchMedia(MOBILE_QUERY);

    const update = () => {
      setIsMobile(media.matches);
    };

    update();
    media.addEventListener("change", update);

    // Back/forward cache can restore a page with stale viewport state.
    window.addEventListener("pageshow", update);

    return () => {
      media.removeEventListener("change", update);
      window.removeEventListener("pageshow", update);
    };
  }, []);

  return isMobile;
}
