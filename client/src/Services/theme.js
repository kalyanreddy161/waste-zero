export const THEME_STORAGE_KEY = "theme";
export const LIGHT_THEME = "light";
export const DARK_THEME = "dark";

const THEME_MEDIA_QUERY = "(prefers-color-scheme: dark)";

function canUseWindow() {
  return typeof window !== "undefined";
}

function canUseDocument() {
  return typeof document !== "undefined";
}

function prepareThemeTransition() {
  if (!canUseWindow() || !canUseDocument()) {
    return;
  }

  const root = document.documentElement;
  const existingTimeout = root.__themeTransitionTimeout;
  if (existingTimeout) {
    window.clearTimeout(existingTimeout);
  }

  root.classList.add("theme-transition");
  root.__themeTransitionTimeout = window.setTimeout(() => {
    root.classList.remove("theme-transition");
    root.__themeTransitionTimeout = null;
  }, 320);
}

function notifyThemeChange(theme) {
  if (!canUseWindow()) {
    return;
  }

  window.dispatchEvent(
    new CustomEvent("themechange", {
      detail: { theme },
    })
  );
}

export function getStoredThemePreference() {
  if (!canUseWindow()) {
    return null;
  }

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  return storedTheme === DARK_THEME || storedTheme === LIGHT_THEME
    ? storedTheme
    : null;
}

export function getSystemThemePreference() {
  if (!canUseWindow() || typeof window.matchMedia !== "function") {
    return LIGHT_THEME;
  }

  return window.matchMedia(THEME_MEDIA_QUERY).matches
    ? DARK_THEME
    : LIGHT_THEME;
}

export function resolveThemePreference() {
  return getStoredThemePreference() || getSystemThemePreference();
}

export function applyTheme(theme) {
  const resolvedTheme = theme === DARK_THEME ? DARK_THEME : LIGHT_THEME;

  if (!canUseDocument()) {
    return resolvedTheme;
  }

  prepareThemeTransition();

  const root = document.documentElement;
  root.classList.toggle(DARK_THEME, resolvedTheme === DARK_THEME);
  root.setAttribute("data-theme", resolvedTheme);
  root.style.colorScheme = resolvedTheme;

  return resolvedTheme;
}

export function initializeTheme() {
  return applyTheme(resolveThemePreference());
}

export function setThemePreference(theme) {
  const resolvedTheme = theme === DARK_THEME ? DARK_THEME : LIGHT_THEME;

  if (canUseWindow()) {
    window.localStorage.setItem(THEME_STORAGE_KEY, resolvedTheme);
  }

  applyTheme(resolvedTheme);
  notifyThemeChange(resolvedTheme);
  return resolvedTheme;
}

export function clearThemePreference() {
  if (canUseWindow()) {
    window.localStorage.removeItem(THEME_STORAGE_KEY);
  }

  const resolvedTheme = applyTheme(getSystemThemePreference());
  notifyThemeChange(resolvedTheme);
  return resolvedTheme;
}

export function syncThemeWithSystemPreference(callback) {
  if (!canUseWindow() || typeof window.matchMedia !== "function") {
    return () => {};
  }

  const mediaQuery = window.matchMedia(THEME_MEDIA_QUERY);
  const handleChange = () => {
    if (getStoredThemePreference()) {
      return;
    }

    const resolvedTheme = applyTheme(getSystemThemePreference());
    notifyThemeChange(resolvedTheme);
    callback?.(resolvedTheme);
  };

  if (typeof mediaQuery.addEventListener === "function") {
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }

  mediaQuery.addListener(handleChange);
  return () => mediaQuery.removeListener(handleChange);
}

export function syncThemeWithStorage(callback) {
  if (!canUseWindow()) {
    return () => {};
  }

  const handleStorage = (event) => {
    if (event.key && event.key !== THEME_STORAGE_KEY) {
      return;
    }

    const resolvedTheme = initializeTheme();
    notifyThemeChange(resolvedTheme);
    callback?.(resolvedTheme);
  };

  window.addEventListener("storage", handleStorage);
  return () => window.removeEventListener("storage", handleStorage);
}
