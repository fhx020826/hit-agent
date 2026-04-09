"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { api } from "@/lib/api";
import { APPEARANCE_CACHE_KEY, applyAppearance, persistAppearance } from "@/lib/appearance";
import type { LanguageCode } from "@/lib/i18n";

type LanguageContextValue = {
  language: LanguageCode;
  setLanguage: (language: LanguageCode) => void;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function normalizeLanguage(value?: string): LanguageCode {
  return value === "en-US" ? "en-US" : "zh-CN";
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [language, setLanguageState] = useState<LanguageCode>("zh-CN");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(APPEARANCE_CACHE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as { language?: string; mode?: string; accent?: string; font?: string; skin?: string };
      setLanguageState(normalizeLanguage(parsed.language));
    } catch {
      // ignore malformed cache
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !user) return;
    let alive = true;
    api.getMyAppearance()
      .then((result) => {
        if (!alive) return;
        setLanguageState(normalizeLanguage(result.language));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [isAuthenticated, user]);

  const setLanguage = (nextLanguage: LanguageCode) => {
    setLanguageState(nextLanguage);
    if (typeof document === "undefined") return;
    const nextAppearance = {
      mode: document.documentElement.dataset.themeMode || "day",
      accent: document.documentElement.dataset.themeAccent || "blue",
      font: document.documentElement.dataset.themeFont || "default",
      skin: document.documentElement.dataset.themeSkin || "clean",
      language: nextLanguage,
    };
    applyAppearance(nextAppearance);
    persistAppearance(nextAppearance);
  };

  const value = useMemo<LanguageContextValue>(() => ({ language, setLanguage }), [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used inside LanguageProvider");
  }
  return context;
}
