"use client";

import { StreamRoomDesktop } from "@/components/streams/StreamRoomDesktop";
import { StreamRoomMobile } from "@/components/streams/StreamRoomMobile";
import type { AuctionDetail } from "@/hooks/useAuction";
import { useIsMobileViewport } from "@/hooks/useIsMobileViewport";

type StreamRoomResponsiveProps = {
  auctionId: string;
  initialData?: AuctionDetail | null;
  stripeEnabled?: boolean;
};

export function StreamRoomResponsive({
  auctionId,
  initialData,
  stripeEnabled = true,
}: StreamRoomResponsiveProps) {
  const isMobile = useIsMobileViewport();

  return isMobile ? (
    <StreamRoomMobile
      auctionId={auctionId}
      initialData={initialData}
      stripeEnabled={stripeEnabled}
    />
  ) : (
    <StreamRoomDesktop
      auctionId={auctionId}
      initialData={initialData}
      stripeEnabled={stripeEnabled}
    />
  );
}

