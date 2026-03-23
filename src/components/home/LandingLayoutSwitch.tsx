"use client";

import { useMobileUi } from "@/hooks/useMobileUi";

type LandingLayoutSwitchProps = {
  initialIsMobile: boolean;
  desktop: React.ReactNode;
  mobile: React.ReactNode;
};

export function LandingLayoutSwitch({
  initialIsMobile,
  desktop,
  mobile,
}: LandingLayoutSwitchProps) {
  const isMobileUi = useMobileUi(initialIsMobile);

  return isMobileUi ? <>{mobile}</> : <>{desktop}</>;
}
