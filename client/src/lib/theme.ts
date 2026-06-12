export type ThemePreference = "light" | "dark";

const STORAGE_KEY = "pref_theme";

export function applyTheme(theme: ThemePreference) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  localStorage.setItem(STORAGE_KEY, theme);
}

export function getStoredTheme(): ThemePreference {
  return localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light";
}
