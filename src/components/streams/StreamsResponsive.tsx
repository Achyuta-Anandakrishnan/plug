"use client";

import { StreamsDesktop } from "@/components/streams/StreamsDesktop";
import { StreamsMobile } from "@/components/streams/StreamsMobile";
import { useIsMobileViewport } from "@/hooks/useIsMobileViewport";

export function StreamsResponsive() {
  const isMobile = useIsMobileViewport();
  return isMobile ? <StreamsMobile /> : <StreamsDesktop />;
}

