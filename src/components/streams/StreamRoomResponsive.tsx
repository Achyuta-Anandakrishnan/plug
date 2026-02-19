"use client";

import { StreamRoomDesktop } from "@/components/streams/StreamRoomDesktop";
import { StreamRoomMobile } from "@/components/streams/StreamRoomMobile";
import type { AuctionDetail } from "@/hooks/useAuction";
import { useMobileUi } from "@/hooks/useMobileUi";

type StreamRoomResponsiveProps = {
  auctionId: string;
  initialData?: AuctionDetail | null;
  stripeEnabled?: boolean;
};

export function StreamRoomResponsive({
  auctionId,
  initialData,
  stripeEnabled,
}: StreamRoomResponsiveProps) {
  const isMobileUi = useMobileUi();

  if (isMobileUi) {
    return (
      <StreamRoomMobile
        auctionId={auctionId}
        initialData={initialData}
        stripeEnabled={stripeEnabled}
      />
    );
  }

  return (
    <StreamRoomDesktop
      auctionId={auctionId}
      initialData={initialData}
      stripeEnabled={stripeEnabled}
    />
  );
}
