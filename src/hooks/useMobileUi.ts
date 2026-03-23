"use client";

import { useMediaQuery } from "@/hooks/useMediaQuery";

export const MOBILE_QUERY = "(max-width: 768px)";

export function useMobileUi() {
  return useMediaQuery(MOBILE_QUERY) ?? false;
}
