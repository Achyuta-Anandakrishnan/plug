"use client";

import { useEffect, useState } from "react";

const MOBILE_BREAKPOINT = 768;

function detectMobileUi() {
  if (typeof window === "undefined") return false;
  const widthIsMobile = window.innerWidth < MOBILE_BREAKPOINT;
  const coarsePointer = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
  return widthIsMobile && coarsePointer;
}

export function useMobileUi() {
  const [isMobileUi, setIsMobileUi] = useState(false);

  useEffect(() => {
    const update = () => setIsMobileUi(detectMobileUi());

    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return isMobileUi;
}
