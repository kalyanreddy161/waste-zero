import React, { useEffect, useRef, useState } from "react";
import { useQueryClient } from '@tanstack/react-query';
import MessageBox from "./MessageBox";
import Loading from "./Loading";
import "../styles/NavbarComponents-styles/MyProfile.css";
import { useMe, API_BASE } from "../Services/useMe";

const MyProfile = () => {
  const [active, setActive] = useState("profile");
  const [toggleChecked, setToggleChecked] = useState(false);
  const [editing, setEditing] = useState(false);

  // profile form state
  const [fullName, setFullName] = useState("");
  const [skills, setSkills] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState(null);
  const [localCaptured, setLocalCaptured] = useState(false);

  // email update state
  const [currentEmail, setCurrentEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newEmailLocked, setNewEmailLocked] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState("");
  const [emailError, setEmailError] = useState("");

  // password state
  const [curpassword, setCurpassword] = useState("");
  const [newpassword, setNewpassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // message box
  const [message, setMessage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [address, setAddress] = useState("");
  const queryClient = useQueryClient();
  const _msgTimers = useRef([]);

  // reset edit-related transient state (OTP flow, local captures)
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
      // clear any pending timers on unmount
      _msgTimers.current.forEach(id => clearTimeout(id));
      _msgTimers.current = [];
    };
  }, []);

  // restore editing state across navigations using sessionStorage
  useEffect(() => {
    try {
      const v = sessionStorage.getItem('profile_editing');
      if (v === '1') setEditing(true);
    } catch (e) {
      console.error("Error restoring profile editing state:", e);
    }
  }, []);

  // sync checkbox state with active tab
  useEffect(() => {
    setToggleChecked(active === "password");
  }, [active]);

  const handleToggleChange = (e) => {
    const checked = e.target.checked;
    setToggleChecked(checked);
    setActive(checked ? "password" : "profile");
  };

  // fetch and cache /me using react-query
  const { data: meData, isLoading: meLoading } = useMe();

  // populate local fields when query returns
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

  // reverse geocode to human-readable address using Google Maps Geocoding API
  const getAddress = async (lat, lng) => {
    try {
      // Use Nominatim (OpenStreetMap) reverse geocoding — no API key required.
      // Note: Nominatim has usage policies and rate limits; in browser the Referer header is sent automatically.
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) return null;
      const data = await res.json();
      if (data && data.display_name) return data.display_name;
    } catch (err) {
      // ignore
    }
    return null;
  };

  const showMessage = (text, type = "info", timeout = 4000) => {
    // trigger bell animation first
    try { window.dispatchEvent(new CustomEvent('notify:incoming', { detail: { type } })); } catch (e) {
      console.error("Error triggering bell animation:", e);
    }

    const SHOW_DELAY = 200; // play bell then show
    const FADE_MS = 440; // match CSS closePop animation duration (420ms) + small buffer

    // clear previous timers
    _msgTimers.current.forEach(id => clearTimeout(id));
    _msgTimers.current = [];

    const tShow = setTimeout(() => {
      setMessage({ text, type, closing: false });

      // schedule start of closing
      const tCloseStart = setTimeout(() => {
        setMessage(prev => prev ? { ...prev, closing: true } : prev);
      }, timeout);

      // schedule removal after fade
      const tRemove = setTimeout(() => setMessage(null), timeout + FADE_MS);

      _msgTimers.current.push(tCloseStart, tRemove);
    }, SHOW_DELAY);

    _msgTimers.current.push(tShow);
  };

  // small helper to render buttons with tooltip when disabled (disabled elements often don't show title)
  const withTooltip = (title, button) => {
    if (!title) return button;
    // if button is disabled, wrap in span so tooltip shows
    const isDisabled = button.props && button.props.disabled;
    if (isDisabled) return <span className="btn-wrap" title={title}>{button}</span>;
    return React.cloneElement(button, { title });
  };

  // simple email validation
  const validateEmail = (val) => {
    if (!val) return "";
    const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@(([^<>()[\]\\.,;:\s@"]+\.)+[^<>()[\]\\.,;:\s@"]{2,})$/i;
    return re.test(String(val).toLowerCase()) ? "" : "Enter a valid email";
  };

  // send OTP for update
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
        try { sessionStorage.removeItem('profile_editing'); } catch (e) {
          console.error("Error removing profile editing state:", e);
        }
        resetEditProcess();
        await queryClient.invalidateQueries({ queryKey: ["me"] });
        setEditing(false);
      } else {
        // show OTP-related errors inline under the OTP input when possible
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
      const body = { fullName, skills: skills.split(",").map(s => s.trim()).filter(Boolean), bio };
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
        try { sessionStorage.removeItem('profile_editing'); } catch (e) {
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

  const handleFetchLocation = () => {
    if (!navigator.geolocation) return showMessage("Geolocation not supported", "error");
    setIsLoading(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        const coords = [pos.coords.longitude, pos.coords.latitude];
        setLocation({ coordinates: coords });
        // mark that user captured a location this session (do not treat DB location as captured)
        setLocalCaptured(true);
        // resolve address for display
        (async () => {
          const addr = await getAddress(coords[1], coords[0]);
          if (addr) setAddress(addr);
        })();
        showMessage("Location captured", "success");
        setIsLoading(false);
      },
      err => {
        showMessage("Unable to fetch location", "error");
        setIsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
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
        setCurpassword(""); setNewpassword(""); setConfirmPassword("");
      } else {
        showMessage(data.message || "Failed to update password", "error");
      }
    } catch (err) {
      showMessage(err.message || "Network error", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // whether the DB has a saved location (distinct from a local capture in this session)
  const dbHasLocation = Boolean(meData && meData.location && meData.location.coordinates && meData.location.coordinates.length === 2);

  // location label logic (separate from loading text)
  const locationLabel = localCaptured
    ? 'Location captured'
    : (dbHasLocation ? 'Get new location' : 'Get Location');

  return (
    <div className="page profile-page">
      <div className="profile-box">
        <div className="profile-box-header">
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
          <div className="profile-box-actions"></div>
        </div>

        <div className="profile-content" data-active={active}>
          <div className="profile-doc panel">
            <div className="panel-header">
              <div className="panel-title">Profile</div>
              <div className="panel-actions">
                {editing && withTooltip('Cancel changes', <button className="btn cancel-btn" onClick={() => {
                  try { sessionStorage.removeItem('profile_editing'); } catch (e) {
                    console.error("Error removing profile editing state:", e);
                  } resetEditProcess(); setEditing(false);
                }}>Back</button>)}
              </div>
            </div>

            {/* static read-only document (hidden when editing) */}
            {!editing && (
              <>
                <div className="doc-row">
                  <div className="field-label">Full name</div>
                  <div className="doc-value">{fullName || meData?.fullName || "—"}</div>
                </div>

                <div className="doc-row">
                  <div className="field-label">Username</div>
                  <div className="doc-value">{meData?.username || "—"}</div>
                </div>

                <div className="doc-row">
                  <div className="field-label">Role</div>
                  <div className="doc-value">{meData?.role || "—"}</div>
                </div>

                <div className="doc-row">
                  <div className="field-label">Skills</div>
                  <div className="doc-value">{skills ? skills : ((meData && meData.skills && meData.skills.length) ? meData.skills.join(", ") : "—")}</div>
                </div>

                <div className="doc-row">
                  <div className="field-label">Bio</div>
                  <div className="doc-value">{bio ? bio : (meData?.bio || "—")}</div>
                </div>

                <div className="doc-row">
                  <div className="field-label">Location</div>
                  <div className="doc-value">{address ? address : (location && location.coordinates ? `${location.coordinates[1].toFixed(4)}, ${location.coordinates[0].toFixed(4)}` : (meData && meData.location && meData.location.coordinates ? `${meData.location.coordinates[1].toFixed(4)}, ${meData.location.coordinates[0].toFixed(4)}` : "—"))}</div>
                </div>

                <div className="doc-row">
                  <div className="field-label">Email</div>
                  <div style={{ flex: 1, display: "flex", gap: 8 }}>
                    <div className="doc-value">{meData?.email || "—"}</div>
                  </div>
                </div>

                {/* edit button shown at bottom of document only on profile tab */}
                {active === "profile" && (
                  <div className="profile-actions">
                    {withTooltip('Edit your profile', <button className="btn btn-primary btn-large" onClick={() => {
                      setLocalCaptured(false); try { sessionStorage.setItem('profile_editing', '1'); } catch (e) {
                        console.error("Error setting profile editing state:", e);
                      } setEditing(true);
                    }}>Edit Profile</button>)}
                  </div>
                )}
              </>
            )}

            {/* when editing: show Update Email and Personal Details sections */}
            {editing && (
              <>
                <div className="section-sep">
                  <div className="section-title" style={{ fontWeight: 700, marginBottom: 8 }}>Update Email</div>
                  <div className="doc-row">
                    <div className="field-label">Current Email</div>
                    <input type="email" value={currentEmail} disabled />
                  </div>
                  <div className="doc-row">
                    <div className="field-label">New Email</div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input type="email" value={newEmail} onChange={e => {
                          const v = e.target.value;
                          if (!newEmailLocked) setNewEmail(v);
                          const err = validateEmail(v) || (v && v === currentEmail ? 'Please use another email' : '');
                          setEmailError(err);
                        }} placeholder="enter new email" disabled={!editing || newEmailLocked || isLoading} />
                        {withTooltip(emailError || (!newEmail ? 'Please enter email first' : (otpSent ? 'OTP sent' : '')), <button className="btn btn-primary" onClick={handleSendOtp} disabled={!editing || otpSent || newEmailLocked || !newEmail || isLoading || !!emailError}>Get OTP</button>)}
                      </div>
                      {emailError && <div className="field-error">{emailError}</div>}
                    </div>
                  </div>
                  <div className="doc-row">
                    <div className="field-label">OTP</div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input className="otp-input" type="number" value={otp} onChange={e => { setOtp(e.target.value); setOtpError(''); }} disabled={!otpSent || isLoading} />
                        {withTooltip(otpSent ? (isLoading ? 'Please wait...' : '') : 'Request OTP first', <button className="btn btn-primary" onClick={handleVerifyAndUpdateEmail} disabled={!otpSent || isLoading}>Verify & Update</button>)}
                      </div>
                      {otpError && <div className="field-error">{otpError}</div>}
                    </div>
                  </div>
                </div>

                <div className="section-sep" style={{ marginTop: 16 }}>
                  <div className="section-title" style={{ fontWeight: 700, marginBottom: 8 }}>Update Personal Details</div>
                  <div className="doc-row">
                    <div className="field-label">Skills (comma separated)</div>
                    <input value={skills} onChange={e => setSkills(e.target.value)} />
                  </div>
                  <div className="doc-row">
                    <div className="field-label">Bio</div>
                    <input value={bio} onChange={e => setBio(e.target.value)} />
                  </div>
                  <div className="doc-row">
                    <div className="field-label">Location</div>
                    <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ flex: 1 }}>{address ? address : (meData && meData.location && meData.location.coordinates ? 'Not resolved address' : 'Not set')}</div>
                      <div style={{ marginLeft: 12 }}>
                        {withTooltip(navigator.geolocation ? (isLoading ? 'Fetching location...' : (localCaptured ? 'Location captured' : (dbHasLocation ? 'Get new location' : 'Get Location'))) : 'Geolocation not supported', <button className={`btn ${localCaptured || address ? 'btn-primary' : ''}`} onClick={handleFetchLocation} disabled={isLoading}>{isLoading ? 'Fetching...' : locationLabel}</button>)}
                      </div>
                    </div>
                  </div>

                  <div className="profile-actions">
                    {withTooltip(isLoading ? 'Please wait...' : '', <button className="btn btn-primary btn-large" onClick={handleUpdateProfile} disabled={isLoading}>Update Profile</button>)}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="password-panel panel">
            <div className="panel-header">
              <div className="panel-title">Change Password</div>
            </div>
            <div className="password-form">
              <div className="pw-row">
                <label>Current password</label>
                <input type="password" value={curpassword} onChange={e => setCurpassword(e.target.value)} />
              </div>
              <div className="pw-row">
                <label>New password</label>
                <input type="password" value={newpassword} onChange={e => setNewpassword(e.target.value)} />
              </div>
              <div className="pw-row">
                <label>Confirm password</label>
                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
              </div>
              <div className="profile-actions">
                {(() => {
                  const pwDisabled = isLoading || !curpassword || !newpassword || !confirmPassword || (newpassword !== confirmPassword);
                  const tip = isLoading ? 'Please wait...' : (!curpassword || !newpassword || !confirmPassword ? 'Fill all password fields' : (newpassword !== confirmPassword ? 'Passwords do not match' : 'Change password'));
                  return withTooltip(tip, <button className="btn btn-primary" onClick={handleChangePassword} disabled={pwDisabled}>Update Password</button>);
                })()}
              </div>
            </div>
          </div>
        </div>
      </div>
      <Loading isLoading={isLoading} />
      {message && <MessageBox message={message.text} type={message.type} closing={message.closing} />}
    </div>
  );
};

export default MyProfile;
