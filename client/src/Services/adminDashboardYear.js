export const ADMIN_DASHBOARD_YEAR_KEY = "wastezero_admin_dashboard_year";
export const ADMIN_DASHBOARD_YEAR_EVENT = "admin-dashboard-year-changed";

export function getAvailableAdminYears() {
  const currentYear = new Date().getFullYear();
  return [currentYear, currentYear - 1, currentYear - 2];
}

export function getStoredAdminDashboardYear() {
  const defaultYear = getAvailableAdminYears()[0];

  if (typeof window === "undefined") {
    return defaultYear;
  }

  const stored = Number(window.localStorage.getItem(ADMIN_DASHBOARD_YEAR_KEY));
  return getAvailableAdminYears().includes(stored) ? stored : defaultYear;
}

export function setStoredAdminDashboardYear(year) {
  const fallback = getAvailableAdminYears()[0];
  const normalized = Number(year);
  const nextYear = getAvailableAdminYears().includes(normalized) ? normalized : fallback;

  if (typeof window !== "undefined") {
    window.localStorage.setItem(ADMIN_DASHBOARD_YEAR_KEY, String(nextYear));
    window.dispatchEvent(
      new CustomEvent(ADMIN_DASHBOARD_YEAR_EVENT, {
        detail: { year: nextYear },
      })
    );
  }

  return nextYear;
}
