"use client";

import { StreamsDesktop } from "@/components/streams/StreamsDesktop";
import { StreamsMobile } from "@/components/streams/StreamsMobile";
import { useMobileUi } from "@/hooks/useMobileUi";

export function StreamsResponsive() {
  const isMobileUi = useMobileUi();

  if (isMobileUi) {
    return <StreamsMobile />;
  }

  return <StreamsDesktop />;
}
