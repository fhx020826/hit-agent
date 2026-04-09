export type AppearancePayload = {
  mode?: string;
  accent?: string;
  font?: string;
  skin?: string;
  language?: string;
};

export const APPEARANCE_CACHE_KEY = "hit-agent-active-appearance";

export function applyAppearance(appearance: AppearancePayload) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.themeMode = appearance.mode || "day";
  root.dataset.themeAccent = appearance.accent || "blue";
  root.dataset.themeFont = appearance.font || "default";
  root.dataset.themeSkin = appearance.skin || "clean";
  root.lang = appearance.language || "zh-CN";
}

export function persistAppearance(appearance: AppearancePayload) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(APPEARANCE_CACHE_KEY, JSON.stringify(appearance));
}
