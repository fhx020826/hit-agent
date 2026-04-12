"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

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

function readCachedLanguage(): LanguageCode {
  if (typeof window === "undefined") return "zh-CN";
  const raw = window.localStorage.getItem(APPEARANCE_CACHE_KEY);
  if (!raw) return "zh-CN";
  try {
    const parsed = JSON.parse(raw) as { language?: string };
    return normalizeLanguage(parsed.language);
  } catch {
    return "zh-CN";
  }
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [language, setLanguageState] = useState<LanguageCode>(readCachedLanguage);
  const manualOverrideRef = useRef(false);
  const sessionKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const nextSessionKey = isAuthenticated && user ? `${user.role}:${user.account}` : null;
    if (sessionKeyRef.current === nextSessionKey) return;
    sessionKeyRef.current = nextSessionKey;
    manualOverrideRef.current = false;
  }, [isAuthenticated, user]);

  useEffect(() => {
    if (!isAuthenticated || !user) return;
    let alive = true;
    api.getMyAppearance()
      .then((result) => {
        if (!alive || manualOverrideRef.current) return;
        setLanguageState(normalizeLanguage(result.language));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [isAuthenticated, user]);

  const setLanguage = (nextLanguage: LanguageCode) => {
    manualOverrideRef.current = true;
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
