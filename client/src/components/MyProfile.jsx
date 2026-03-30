import React, { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import MessageBox from "./MessageBox";
import Loading from "./Loading";
import MapPicker from "./MapPicker";
import ActionButton from "./ActionButton";
import "../styles/NavbarComponents-styles/MyProfile.css";
import { useMe, API_BASE } from "../Services/useMe";
import useIsMobile from "../Services/useIsMobile";

const MyProfile = () => {
  const [active, setActive] = useState("profile");
  const [toggleChecked, setToggleChecked] = useState(false);
  const [editing, setEditing] = useState(false);
  const isMobile = useIsMobile();

  const [fullName, setFullName] = useState("");
  const [skills, setSkills] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState(null);
  const [localCaptured, setLocalCaptured] = useState(false);

  const [currentEmail, setCurrentEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newEmailLocked, setNewEmailLocked] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState("");
  const [emailError, setEmailError] = useState("");

  const [curpassword, setCurpassword] = useState("");
  const [newpassword, setNewpassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [message, setMessage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [address, setAddress] = useState("");
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const queryClient = useQueryClient();
  const _msgTimers = useRef([]);

  const resetEditProcess = () => {
    setOtpSent(false);
    setNewEmailLocked(false);
    setOtp("");
    setOtpError("");
    setEmailError("");
    setNewEmail("");
    setIsLoading(false);
    setLocalCaptured(false);
  };

  useEffect(() => {
    return () => {
      _msgTimers.current.forEach((id) => clearTimeout(id));
      _msgTimers.current = [];
    };
  }, []);

  useEffect(() => {
    try {
      const v = sessionStorage.getItem("profile_editing");
      if (v === "1") setEditing(true);
    } catch (e) { }
  }, []);

  useEffect(() => {
    setToggleChecked(active === "password");
  }, [active]);

  useEffect(() => {
    if (!isMobile) return;
    const handler = (ev) => {
      const detail = ev?.detail || {};
      if (detail.page !== "profile") return;
      setActive(detail.key === "password" ? "password" : "profile");
    };
    window.addEventListener("mobile:custom-link", handler);
    return () => window.removeEventListener("mobile:custom-link", handler);
  }, [isMobile]);

  useEffect(() => {
    if (!isMobile) return;
    window.dispatchEvent(new CustomEvent("mobile:custom-state", { detail: { page: "profile", key: active } }));
  }, [active, isMobile]);

  const handleToggleChange = (e) => {
    const checked = e.target.checked;
    setToggleChecked(checked);
    setActive(checked ? "password" : "profile");
  };

  const { data: meData, isLoading: meLoading } = useMe();

  useEffect(() => {
    const u = meData;
    if (u) {
      setFullName(u.fullName || "");
      setCurrentEmail(u.email || "");
      setSkills((u.skills && u.skills.join(", ")) || "");
      setBio(u.bio || "");
      setLocation(u.location || null);

      (async () => {
        if (u.location && u.location.coordinates && u.location.coordinates.length === 2) {
          const lng = u.location.coordinates[0];
          const lat = u.location.coordinates[1];
          const addr = await getAddress(lat, lng);
          if (addr) setAddress(addr);
        }
      })();
    }
  }, [meData]);

  const getAddress = async (lat, lng) => {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) return null;
      const data = await res.json();
      const addr = data && data.address ? data.address : {};
      const villageOrArea = addr.village || addr.suburb || addr.hamlet || "";
      const cityOrTown = addr.city || addr.town || addr.county || "";
      const compact = [villageOrArea, cityOrTown].filter(Boolean);
      if (compact.length > 0) {
        return compact.filter((part, index, arr) => arr.indexOf(part) === index).join(", ");
      }
    } catch (err) {
      // ignore
    }
    return null;
  };

  const showMessage = (text, type = "info", timeout = 4000) => {
    const SHOW_DELAY = 200;
    const FADE_MS = 440;

    _msgTimers.current.forEach((id) => clearTimeout(id));
    _msgTimers.current = [];

    const tShow = setTimeout(() => {
      setMessage({ text, type, closing: false });

      const tCloseStart = setTimeout(() => {
        setMessage((prev) => (prev ? { ...prev, closing: true } : prev));
      }, timeout);

      const tRemove = setTimeout(() => setMessage(null), timeout + FADE_MS);

      _msgTimers.current.push(tCloseStart, tRemove);
    }, SHOW_DELAY);

    _msgTimers.current.push(tShow);
  };

  const withTooltip = (title, button) => {
    if (!title) return button;
    const isDisabled = button.props && button.props.disabled;
    if (isDisabled) return <span className="btn-wrap" title={title}>{button}</span>;
    return React.cloneElement(button, { title });
  };

  const validateEmail = (val) => {
    if (!val) return "";
    const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@(([^<>()[\]\\.,;:\s@"]+\.)+[^<>()[\]\\.,;:\s@"]{2,})$/i;
    return re.test(String(val).toLowerCase()) ? "" : "Enter a valid email";
  };

  const handleSendOtp = async () => {
    if (!newEmail) return showMessage("Enter new email first", "error");
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/profile/send-otp-update`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: meData?.id, email: newEmail })
      });
      const data = await res.json();
      if (res.ok) {
        setOtpSent(true);
        setNewEmailLocked(true);
        showMessage(data.message || "OTP sent", "success");
      } else {
        showMessage(data.message || "Failed to send OTP", "error");
      }
    } catch (err) {
      showMessage(err.message || "Network error", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyAndUpdateEmail = async () => {
    setOtpError("");
    if (!otp) {
      setOtpError("Enter OTP");
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/profile/email`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: meData?.id, email: newEmail, otp })
      });
      const data = await res.json();
      if (res.ok) {
        showMessage(data.message || "Email updated", "success");
        setOtp("");
        setOtpSent(false);
        setNewEmailLocked(false);
        try {
          sessionStorage.removeItem("profile_editing");
        } catch (e) { }
        resetEditProcess();
        await queryClient.invalidateQueries({ queryKey: ["me"] });
        setEditing(false);
      } else {
        showMessage(data.message || "Failed to update email", "error");
      }
    } catch (err) {
      setOtpError("Network error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateProfile = async () => {
    setIsLoading(true);
    try {
      const body = { fullName, skills: skills.split(",").map((s) => s.trim()).filter(Boolean), bio };
      if (location) body.location = { coordinates: location.coordinates };
      const res = await fetch(`${API_BASE}/profile`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (res.ok) {
        showMessage(data.message || "Profile updated", "success");
        await queryClient.invalidateQueries({ queryKey: ["me"] });
        try {
          sessionStorage.removeItem("profile_editing");
        } catch (e) {
          // ignore
        }
        resetEditProcess();
        setEditing(false);
      } else {
        showMessage(data.message || "Failed to update profile", "error");
      }
    } catch (err) {
      showMessage(err.message || "Network error", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleChooseLocation = async (selectedLocation) => {
    setIsLoading(true);
    try {
      const coords = [selectedLocation.lon, selectedLocation.lat];
      setLocation({ coordinates: coords });
      setLocalCaptured(true);
      const addr = await getAddress(selectedLocation.lat, selectedLocation.lon);
      setAddress(addr || "");
      showMessage("Location selected", "success");
    } finally {
      setIsLoading(false);
      setShowLocationPicker(false);
    }
  };

  const handleChangePassword = async () => {
    if (!curpassword || !newpassword) return showMessage("Fill passwords", "error");
    if (newpassword !== confirmPassword) return showMessage("Passwords do not match", "error");
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/profile/password`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: meData?.id, curpassword, newpassword })
      });
      const data = await res.json();
      if (res.ok) {
        showMessage(data.message || "Password updated", "success");
        setCurpassword("");
        setNewpassword("");
        setConfirmPassword("");
      } else {
        showMessage(data.message || "Failed to update password", "error");
      }
    } catch (err) {
      showMessage(err.message || "Network error", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const dbHasLocation = Boolean(meData && meData.location && meData.location.coordinates && meData.location.coordinates.length === 2);

  const locationLabel = (dbHasLocation || localCaptured) ? "Choose new location" : "Choose location";

  const profileName = fullName || meData?.fullName || meData?.username || "User";
  const profileUsername = meData?.username || "--";
  const profileRole = meData?.role || "--";
  const profileSkills = skills ? skills : ((meData && meData.skills && meData.skills.length) ? meData.skills.join(", ") : "--");
  const profileBio = bio ? bio : (meData?.bio || "--");
  const profileLocation = address
    ? address
    : (location && location.coordinates
      ? `${location.coordinates[1].toFixed(4)}, ${location.coordinates[0].toFixed(4)}`
      : (meData && meData.location && meData.location.coordinates
        ? `${meData.location.coordinates[1].toFixed(4)}, ${meData.location.coordinates[0].toFixed(4)}`
        : "--"));
  const profileEmail = meData?.email || "--";
  const profileInitials = profileName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "U";
  const profileStateLabel = active === "password"
    ? "Password panel"
    : (editing ? "Editing enabled" : "Profile ready");

  return (
    <div className="page profile-page">
      <section className="profile-hero">
        <div className="profile-hero-copy">
          <span className="profile-hero-kicker">Account Center</span>
          <div className="page-header-wrapper left">
            <h1 className="page-header">Profile</h1>
            <p className="page-subtitle">Manage your account, identity details, and security settings from one place.</p>
          </div>
          <div className="profile-hero-tags">
            <span className="profile-hero-tag">{editing ? "Edit mode" : "View mode"}</span>
            <span className="profile-hero-tag muted">{active === "password" ? "Security" : "Profile"}</span>
          </div>
        </div>

        <div className="profile-hero-card">
          <div className="profile-avatar">{profileInitials}</div>
          <div className="profile-hero-meta">
            <span className="profile-role-pill">{profileRole}</span>
            <h2>{profileName}</h2>
            <p>@{profileUsername}</p>
          </div>
          <div className="profile-hero-facts">
            <div className="profile-fact">
              <span>Account email</span>
              <strong>{profileEmail}</strong>
            </div>
            <div className="profile-fact">
              <span>Current view</span>
              <strong>{active === "password" ? "Password and security" : (editing ? "Edit profile" : "Profile overview")}</strong>
            </div>
          </div>
        </div>
      </section>

      <div className="profile-box">
        <div className="profile-box-header">
          <div className="profile-box-copy">
            <span className="profile-box-kicker">Workspace</span>
            <h2>{active === "password" ? "Password and security" : "Profile details"}</h2>
            <p>
              {active === "password"
                ? "Update your password securely without leaving the page."
                : (editing
                  ? "Review your email OTP flow, personal details, and saved location before updating."
                  : "Browse your account details and switch into edit mode whenever you need to change them.")}
            </p>
          </div>

          {!isMobile && (
            <label htmlFor="profile-password-toggle" className="switch" aria-label="Toggle Profile/Password">
              <input
                type="checkbox"
                id="profile-password-toggle"
                checked={toggleChecked}
                onChange={handleToggleChange}
              />
              <span>Profile</span>
              <span>Password</span>
            </label>
          )}
        </div>

        <div className="profile-main-grid">
          <aside className="profile-overview-card">
            <div className="profile-overview-top">
              <div className="profile-overview-avatar">{profileInitials}</div>
              <div className="profile-overview-text">
                <p className="profile-overview-label">Account owner</p>
                <h3>{profileName}</h3>
                <span>@{profileUsername}</span>
              </div>
            </div>

            <div className="profile-overview-list">
              <div className="profile-overview-item">
                <span>Role</span>
                <strong>{profileRole}</strong>
              </div>
              <div className="profile-overview-item">
                <span>Email</span>
                <strong>{profileEmail}</strong>
              </div>
              <div className="profile-overview-item">
                <span>Status</span>
                <strong>{profileStateLabel}</strong>
              </div>
              <div className="profile-overview-item">
                <span>Location</span>
                <strong>{profileLocation}</strong>
              </div>
            </div>

            <div className="profile-overview-note">
              {active === "password"
                ? "Use a strong password and make sure the confirmation matches before saving."
                : (editing
                  ? "Email updates still go through OTP verification, and profile fields keep the same save flow."
                  : "All values shown here come from your current account data and saved profile details.")}
            </div>
          </aside>

          <div className="profile-main-column">
            <div className="profile-content" data-active={active}>
              <div className="profile-doc panel">
                <div className="panel-header">
                  <div>
                    <div className="panel-title">Profile</div>
                    <p className="panel-subtitle">
                      {editing
                        ? "Update your email, personal information, and saved location."
                        : "A clean overview of the personal details currently stored for your account."}
                    </p>
                  </div>
                  <div className="panel-actions">
                    {editing && withTooltip("Cancel changes", <ActionButton type="button" icon="back" tone="neutral" size="sm" minWidth={140} onClick={() => {
                      try {
                        sessionStorage.removeItem("profile_editing");
                      } catch (e) { }
                      resetEditProcess();
                      setEditing(false);
                    }}>Back</ActionButton>)}
                  </div>
                </div>

                {!editing && (
                  <>
                    <div className="doc-row">
                      <div className="field-label">Full name</div>
                      <div className="doc-value">{profileName}</div>
                    </div>

                    <div className="doc-row">
                      <div className="field-label">Username</div>
                      <div className="doc-value">{profileUsername}</div>
                    </div>

                    <div className="doc-row">
                      <div className="field-label">Role</div>
                      <div className="doc-value">{profileRole}</div>
                    </div>

                    <div className="doc-row">
                      <div className="field-label">Skills</div>
                      <div className="doc-value">{profileSkills}</div>
                    </div>

                    <div className="doc-row">
                      <div className="field-label">Bio</div>
                      <div className="doc-value">{profileBio}</div>
                    </div>

                    <div className="doc-row">
                      <div className="field-label">Location</div>
                      <div className="doc-value">{profileLocation}</div>
                    </div>

                    <div className="doc-row">
                      <div className="field-label">Email</div>
                      <div style={{ flex: 1, display: "flex", gap: 8 }}>
                        <div className="doc-value">{profileEmail}</div>
                      </div>
                    </div>

                    {active === "profile" && (
                      <div className="profile-actions">
                        {withTooltip("Edit your profile", <ActionButton type="button" icon="edit" tone="primary" minWidth={180} onClick={() => {
                          setLocalCaptured(false);
                          try {
                            sessionStorage.setItem("profile_editing", "1");
                          } catch (e) { }
                          setEditing(true);
                        }}>Edit Profile</ActionButton>)}
                      </div>
                    )}
                  </>
                )}

                {editing && (
                  <>
                    <div className="section-sep">
                      <div className="section-head">
                        <div className="section-title">Update Email</div>
                        <p className="section-caption">Verify the new email with OTP before the account email is changed.</p>
                      </div>
                      <div className="doc-row">
                        <div className="field-label">Current Email</div>
                        <input type="email" value={currentEmail} disabled />
                      </div>
                      <div className="doc-row">
                        <div className="field-label">New Email</div>
                        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                          <div className="field-inline-actions">
                            <input
                              type="email"
                              value={newEmail}
                              onChange={(e) => {
                                const v = e.target.value;
                                if (!newEmailLocked) setNewEmail(v);
                                const err = validateEmail(v) || (v && v === currentEmail ? "Please use another email" : "");
                                setEmailError(err);
                              }}
                              placeholder="Enter new email"
                              disabled={!editing || newEmailLocked || isLoading}
                            />
                            {withTooltip(
                              emailError || (!newEmail ? "Please enter email first" : (otpSent ? "OTP sent" : "")),
                              <ActionButton
                                type="button"
                                icon="mail"
                                tone="info"
                                size="sm"
                                minWidth={140}
                                onClick={handleSendOtp}
                                disabled={!editing || otpSent || newEmailLocked || !newEmail || isLoading || !!emailError}
                              >
                                Get OTP
                              </ActionButton>
                            )}
                          </div>
                          {emailError && <div className="field-error">{emailError}</div>}
                        </div>
                      </div>
                      <div className="doc-row">
                        <div className="field-label">OTP</div>
                        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                          <div className="field-inline-actions">
                            <input className="otp-input" type="number" value={otp} onChange={(e) => { setOtp(e.target.value); setOtpError(""); }} disabled={!otpSent || isLoading} />
                            {withTooltip(
                              otpSent ? (isLoading ? "Please wait..." : "") : "Request OTP first",
                              <ActionButton
                                type="button"
                                icon="check"
                                tone="primary"
                                size="sm"
                                minWidth={190}
                                onClick={handleVerifyAndUpdateEmail}
                                disabled={!otpSent || isLoading}
                              >
                                Verify &amp; Update
                              </ActionButton>
                            )}
                          </div>
                          {otpError && <div className="field-error">{otpError}</div>}
                        </div>
                      </div>
                    </div>

                    <div className="section-sep">
                      <div className="section-head">
                        <div className="section-title">Update Personal Details</div>
                        <p className="section-caption">Keep your skills, bio, and location current without changing the existing save logic.</p>
                      </div>
                      <div className="doc-row">
                        <div className="field-label">Skills (comma separated)</div>
                        <input value={skills} onChange={(e) => setSkills(e.target.value)} />
                      </div>
                      <div className="doc-row">
                        <div className="field-label">Bio</div>
                        <input value={bio} onChange={(e) => setBio(e.target.value)} />
                      </div>
                      <div className="doc-row">
                        <div className="field-label">Location</div>
                        <div className="location-row">
                          <div className="location-value">{profileLocation}</div>
                          <div>
                            {withTooltip(
                              isLoading ? "Loading map selection..." : "",
                              <ActionButton
                                type="button"
                                icon={localCaptured || address || dbHasLocation ? "crosshair" : "map"}
                                tone={localCaptured || address || dbHasLocation ? "primary" : "neutral"}
                                size="sm"
                                minWidth={190}
                                onClick={() => setShowLocationPicker(true)}
                                disabled={isLoading}
                              >
                                {locationLabel}
                              </ActionButton>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="profile-actions">
                        {withTooltip(
                          isLoading ? "Please wait..." : "",
                          <ActionButton
                            type="button"
                            icon="save"
                            tone="primary"
                            minWidth={190}
                            onClick={handleUpdateProfile}
                            disabled={isLoading}
                          >
                            Update Profile
                          </ActionButton>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="password-panel panel">
                <div className="panel-header">
                  <div>
                    <div className="panel-title">Change Password</div>
                    <p className="panel-subtitle">Use your current password, set a new one, and confirm it before saving.</p>
                  </div>
                </div>
                <div className="password-form">
                  <div className="pw-row">
                    <label>Current password</label>
                    <input type="password" value={curpassword} onChange={(e) => setCurpassword(e.target.value)} />
                  </div>
                  <div className="pw-row">
                    <label>New password</label>
                    <input type="password" value={newpassword} onChange={(e) => setNewpassword(e.target.value)} />
                  </div>
                  <div className="pw-row">
                    <label>Confirm password</label>
                    <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                  </div>
                  <div className="profile-actions">
                    {(() => {
                      const pwDisabled = isLoading || !curpassword || !newpassword || !confirmPassword || (newpassword !== confirmPassword);
                      const tip = isLoading ? "Please wait..." : (!curpassword || !newpassword || !confirmPassword ? "Fill all password fields" : (newpassword !== confirmPassword ? "Passwords do not match" : "Change password"));
                      return withTooltip(
                        tip,
                        <ActionButton
                          type="button"
                          icon="password"
                          tone="warning"
                          minWidth={200}
                          onClick={handleChangePassword}
                          disabled={pwDisabled}
                        >
                          Update Password
                        </ActionButton>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Loading isLoading={isLoading || meLoading} />
      <MapPicker
        open={showLocationPicker}
        initial={location?.coordinates?.length === 2 ? [location.coordinates[1], location.coordinates[0]] : null}
        onCancel={() => setShowLocationPicker(false)}
        onChoose={handleChooseLocation}
      />
      {message && <MessageBox message={message.text} type={message.type} closing={message.closing} />}
    </div>
  );
};

export default MyProfile;
