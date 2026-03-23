"use client";

import { useEffect, useState } from "react";

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState<boolean | null>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    const update = () => setMatches(mediaQuery.matches);

    update();
    mediaQuery.addEventListener("change", update);
    window.addEventListener("pageshow", update);
    return () => {
      mediaQuery.removeEventListener("change", update);
      window.removeEventListener("pageshow", update);
    };
  }, [query]);

  return matches;
}
