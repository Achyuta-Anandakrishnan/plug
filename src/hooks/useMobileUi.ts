"use client";

import { useEffect, useState } from "react";

const MOBILE_QUERY = "(max-width: 767px)";

export function useMobileUi() {
  const [isMobileUi, setIsMobileUi] = useState<boolean | null>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia(MOBILE_QUERY);
    const update = () => setIsMobileUi(mediaQuery.matches);

    update();
    mediaQuery.addEventListener("change", update);
    window.addEventListener("pageshow", update);
    return () => {
      mediaQuery.removeEventListener("change", update);
      window.removeEventListener("pageshow", update);
    };
  }, []);

  return isMobileUi ?? false;
}
