"use client";

import { useMediaQuery } from "@/hooks/useMediaQuery";

export const MOBILE_QUERY = "(max-width: 768px)";

export function useMobileUi(initialValue?: boolean) {
  return useMediaQuery(MOBILE_QUERY) ?? initialValue ?? false;
}
