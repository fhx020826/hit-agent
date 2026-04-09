"use client";

import { useEffect } from "react";
import { APPEARANCE_CACHE_KEY, applyAppearance } from "@/lib/appearance";

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const raw = window.localStorage.getItem(APPEARANCE_CACHE_KEY);
    if (!raw) return;
    try {
      applyAppearance(JSON.parse(raw) as { mode?: string; accent?: string; font?: string; skin?: string });
    } catch {
      // ignore malformed local cache
    }
  }, []);

  return <>{children}</>;
}
