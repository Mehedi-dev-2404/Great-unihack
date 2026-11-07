import { useSyncExternalStore } from "react";

export type TextSize = "normal" | "large" | "xl";
export interface Settings {
  textSize: TextSize;
  language: string;
  speakReplies: boolean;
  optInOpportunities: boolean;
}

const KEY = "fola-settings";
const DEFAULTS: Settings = { textSize: "normal", language: "en", speakReplies: false, optInOpportunities: false };

let current: Settings = DEFAULTS;
const listeners = new Set<() => void>();

export function loadSettings() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) current = { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    /* storage unavailable */
  }
  applyTextSize();
  listeners.forEach((l) => l());
}

export function updateSettings(patch: Partial<Settings>) {
  current = { ...current, ...patch };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* ignore */
  }
  applyTextSize();
  listeners.forEach((l) => l());
}

export function getSettings() {
  return current;
}

function applyTextSize() {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  el.classList.remove("text-size-large", "text-size-xl");
  if (current.textSize === "large") el.classList.add("text-size-large");
  if (current.textSize === "xl") el.classList.add("text-size-xl");
}

export function useSettings(): Settings {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
    () => DEFAULTS,
  );
}

const LANG_VOICE: Record<string, string> = { en: "en-GB", so: "so-SO", pl: "pl-PL", ur: "ur-PK", ar: "ar-SA", cy: "cy-GB" };

export function speak(text: string, lang = current.language) {
  try {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = LANG_VOICE[lang] ?? "en-GB";
    u.rate = 0.95;
    window.speechSynthesis.speak(u);
  } catch {
    /* speech unavailable */
  }
}

export function shouldAutoRead(accessibility: string[] | undefined): boolean {
  return current.speakReplies || !!accessibility?.some((a) => a === "read_aloud" || a === "low_vision");
}
