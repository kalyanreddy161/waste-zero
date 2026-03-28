import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { API_BASE, useMe } from "../Services/useMe";
import pushService from "../Services/pushService";
import socket from "../services/socket";
import MessageBox from "./MessageBox";
import ActionButton from "./ActionButton";
import {
  getAvailableAdminYears,
  getStoredAdminDashboardYear,
  setStoredAdminDashboardYear,
} from "../Services/adminDashboardYear";
import {
  DARK_THEME,
  LIGHT_THEME,
  resolveThemePreference,
  setThemePreference,
  syncThemeWithStorage,
  syncThemeWithSystemPreference,
} from "../Services/theme";
import "../styles/NavbarComponents-styles/Settings.css";

const Settings = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const initialYear = getStoredAdminDashboardYear();
  const [savedYear, setSavedYear] = useState(initialYear);
  const [draftYear, setDraftYear] = useState(initialYear);
  const [theme, setTheme] = useState(() => resolveThemePreference());
  const [notification, setNotification] = useState({ open: false, message: "", type: "info", closing: false });
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const availableYears = getAvailableAdminYears();
  const isAdmin = me?.role === "admin";
  const hasYearChanges = draftYear !== savedYear;
  const isDarkMode = theme === DARK_THEME;

  useEffect(() => {
    const cleanupSystemTheme = syncThemeWithSystemPreference(setTheme);
    const cleanupStoredTheme = syncThemeWithStorage(setTheme);

    return () => {
      cleanupSystemTheme();
      cleanupStoredTheme();
    };
  }, []);

  const handleSaveAdminYear = () => {
    const nextYear = setStoredAdminDashboardYear(draftYear);
    setSavedYear(nextYear);
    navigate("/home/dashboard");
  };

  const handleThemeToggle = (event) => {
    const nextTheme = event.target.checked ? DARK_THEME : LIGHT_THEME;
    setTheme(setThemePreference(nextTheme));
  };

  const showMessage = (message, type = "info", duration = 3200) => {
    setNotification({ open: true, message, type, closing: false });
    window.setTimeout(() => {
      setNotification((current) => ({ ...current, closing: true }));
      window.setTimeout(() => {
        setNotification({ open: false, message: "", type: "info", closing: false });
      }, 300);
    }, duration);
  };

  const closeDeleteAccountModal = () => {
    if (isDeletingAccount) return;
    setDeleteAccountOpen(false);
    setDeletePassword("");
    setDeleteError("");
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      setDeleteError("Enter your account password to continue.");
      return;
    }

    setDeleteError("");
    setIsDeletingAccount(true);

    try {
      const res = await fetch(`${API_BASE}/profile/account`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: deletePassword }),
      });
      const payload = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 401) {
          showMessage(payload.message || "Incorrect password", "error");
          return;
        }

        setDeleteError(payload.message || "Failed to delete account.");
        return;
      }

      try { await pushService.unsubscribePush(); } catch (error) { }
      socket.disconnect();
      queryClient.clear();
      try {
        sessionStorage.setItem("global_message", JSON.stringify({
          message: payload.message || "Account deleted permanently",
          type: "success",
        }));
      } catch (error) { }
      navigate("/");
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Failed to delete account.");
    } finally {
      setIsDeletingAccount(false);
    }
  };

  return (
    <div className="page settings-page">
      <div className="settings-header">
        <h2>Settings</h2>
        <p>Adjust your WasteZero experience and role-specific preferences.</p>
      </div>

      <div className="settings-grid">
        <div className="settings-card">
          <div>
            <h3>Appearance</h3>
            <p>Choose the theme you want WasteZero to use across the app.</p>
          </div>
          <label className="settings-toggle-row">
            <span>Dark Mode</span>
            <input
              className="settings-theme-toggle"
              type="checkbox"
              role="switch"
              aria-label="Toggle dark mode"
              checked={isDarkMode}
              onChange={handleThemeToggle}
            />
          </label>
        </div>

        {isAdmin && (
          <div className="settings-card admin-settings-card">
            <div>
              <h3>Admin Dashboard Year</h3>
              <p>Select which year the admin dashboard should use for analytics.</p>
            </div>

            <div className="settings-admin-year-row">
              <select
                className="settings-year-select"
                value={draftYear}
                onChange={(e) => setDraftYear(Number(e.target.value))}
              >
                {availableYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>

              {hasYearChanges && (
                <button className="settings-dashboard-btn" onClick={handleSaveAdminYear}>
                  Go to Dashboard
                </button>
              )}
            </div>

            <p className="settings-helper-text">
              Default is the present year ({availableYears[0]}). You can also review the previous two years.
            </p>
          </div>
        )}

        <div className="settings-card settings-danger-card">
          <div>
            <h3>Delete Account</h3>
            <p>Permanently remove this WasteZero account, your conversations, and related activity. This action cannot be undone.</p>
          </div>

          <ActionButton
            type="button"
            icon="delete"
            tone="danger"
            minWidth={190}
            onClick={() => setDeleteAccountOpen(true)}
          >
            Delete Account
          </ActionButton>
        </div>
      </div>

      {deleteAccountOpen && (
        <div className="settings-modal-backdrop" onClick={closeDeleteAccountModal}>
          <div className="settings-modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="settings-modal-head">
              <div>
                <h3>Delete Account Permanently</h3>
                <p>This will permanently remove your account and notify admin about the deletion.</p>
              </div>
              <ActionButton
                type="button"
                icon="close"
                tone="neutral"
                size="sm"
                minWidth={124}
                onClick={closeDeleteAccountModal}
                disabled={isDeletingAccount}
              >
                Close
              </ActionButton>
            </div>

            <div className="settings-warning-box">
              This action cannot be undone. Enter your current account password to confirm permanent deletion.
            </div>

            <label className="settings-modal-label" htmlFor="delete-account-password">
              Account Password
            </label>
            <input
              id="delete-account-password"
              type="password"
              className="settings-modal-input"
              value={deletePassword}
              onChange={(event) => {
                setDeletePassword(event.target.value);
                setDeleteError("");
              }}
              placeholder="Enter your password"
              autoFocus
            />

            {deleteError && <div className="settings-modal-error">{deleteError}</div>}

            <div className="settings-modal-actions">
              <ActionButton
                type="button"
                icon="back"
                tone="neutral"
                minWidth={144}
                onClick={closeDeleteAccountModal}
                disabled={isDeletingAccount}
              >
                Cancel
              </ActionButton>
              <ActionButton
                type="button"
                icon="delete"
                tone="danger"
                minWidth={214}
                onClick={handleDeleteAccount}
                disabled={isDeletingAccount}
              >
                {isDeletingAccount ? "Deleting..." : "Delete Permanently"}
              </ActionButton>
            </div>
          </div>
        </div>
      )}

      {notification.open && (
        <MessageBox message={notification.message} type={notification.type} closing={notification.closing} />
      )}
    </div>
  );
};

export default Settings;
