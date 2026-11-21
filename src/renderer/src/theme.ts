export type ThemeMode = "dark" | "light" | "custom";
export type ThemeBase = "dark" | "light";
export type ThemeSettings = { mode: ThemeMode; base: ThemeBase; accent: string };

export const DEFAULT_ACCENT = "#5fe7f2";
export const ACCENT_PRESETS = ["#5fe7f2", "#8b7cff", "#55d6a0", "#f0b95c", "#f0779c", "#6fb5ff"];
export const DEFAULT_THEME: ThemeSettings = { mode: "dark", base: "dark", accent: DEFAULT_ACCENT };

const STORAGE_KEY = "opscoder.theme.v1";
const HEX = /^#[0-9a-f]{6}$/i;

export function loadTheme(): ThemeSettings {
 try {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { ...DEFAULT_THEME };
  const value = JSON.parse(raw) as Partial<ThemeSettings>;
  return {
   mode: value.mode === "light" || value.mode === "custom" ? value.mode : "dark",
   base: value.base === "light" ? "light" : "dark",
   accent: typeof value.accent === "string" && HEX.test(value.accent) ? value.accent : DEFAULT_ACCENT
  };
 } catch {
  return { ...DEFAULT_THEME };
 }
}

export function applyTheme(theme: ThemeSettings) {
 const root = document.documentElement;
 const accent = theme.mode === "custom" ? theme.accent : DEFAULT_ACCENT;
 root.dataset.theme = theme.mode;
 root.dataset.base = theme.base;
 root.style.setProperty("--accent", accent);
 root.style.setProperty("--on-accent", readableInk(accent));
 const dark = theme.mode === "dark" || (theme.mode === "custom" && theme.base === "dark");
 root.style.colorScheme = dark ? "dark" : "light";
 document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#0b0e12" : "#ffffff");
}

export function saveTheme(theme: ThemeSettings) {
 try { localStorage.setItem(STORAGE_KEY, JSON.stringify(theme)); } catch { /* Storage can be unavailable. */ }
 applyTheme(theme);
}

function readableInk(hex: string) {
 const value = hex.replace("#", "");
 const channels = [0, 2, 4].map(offset => parseInt(value.slice(offset, offset + 2), 16) / 255);
 const linear = channels.map(channel => channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
 const luminance = 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
 return luminance > 0.46 ? "#041014" : "#ffffff";
}
