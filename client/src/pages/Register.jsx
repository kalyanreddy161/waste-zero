import { useEffect, useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Register.css";
import { UserContext } from "../Services/UserContext";
import { useLoading } from "../Services/LoadingContext";

const API = "http://localhost:3000/auth";

export default function Register() {
  const navigate = useNavigate();
  const { setUser } = useContext(UserContext);


    /* ======================
     SESSION CHECK ON LOAD
  ====================== */
  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await fetch(`${API}/home`, {
          credentials: "include",
        });

            if (res.ok) {
              const data = await res.json();
              if (data.user) setUser(data.user);
              navigate("/home");
            }
      } catch (err) {
        // stay on login page
      }
    };

    checkSession();
  }, [navigate]);

  const [mode, setMode] = useState("login");
  const [showPassword, setShowPassword] = useState(false);
  const [Password, setPassword] = useState('');
  const [ConfirmPassword, setConfirmPassword] = useState('');

  // live password match check
  const [passwordsMatch, setPasswordsMatch] = useState(true);

  // OTP states
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [pasteOTP, setPasteOTP] = useState("");
  const [otpError, setOtpError] = useState("");

  /* ======================
     REGISTER STATE
  ====================== */
  const [registerData, setRegisterData] = useState({
    fullName: "",
    email: "",
    username: "",
    password: "",
    confirmPassword: "",
    role: ""
  });

  const [emailExists, setEmailExists] = useState(false);
  const [usernameExists, setUsernameExists] = useState(false);
  const [registerWarning, setRegisterWarning] = useState("");
  const { isLoading, setLoading, withLoading } = useLoading();


  /* ======================
     LOGIN STATE
  ====================== */
  const [loginData, setLoginData] = useState({
    username: "",
    password: ""
  });

  const [loginError, setLoginError] = useState("");

  /* ======================
     INPUT HANDLERS
  ====================== */
  const handleRegisterChange = (e) => {
    setRegisterData({ ...registerData, [e.target.name]: e.target.value });
    setRegisterWarning("");
  };

  const handleLoginChange = (e) => {
    setLoginData({ ...loginData, [e.target.name]: e.target.value });
  };

  /* ======================
     CHECK EMAIL (1s)
  ====================== */
  useEffect(() => {
    if (!registerData.email) return;

    const timer = setTimeout(async () => {
      const res = await fetch(`${API}/exist-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: registerData.email })
      });
      const data = await res.json();
      setEmailExists(data.exists);
    }, 1000);

    return () => clearTimeout(timer);
  }, [registerData.email]);

  /* ======================
     CHECK USERNAME (3s)
  ====================== */
  useEffect(() => {
    if (!registerData.username) return;

    const timer = setTimeout(async () => {
      const res = await fetch(`${API}/exist-username`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: registerData.username })
      });
      const data = await res.json();
      setUsernameExists(data.exists);
    }, 1000);

    return () => clearTimeout(timer);
  }, [registerData.username]);

  // live-check password vs confirmPassword and show inline error
  useEffect(() => {
    const { password, confirmPassword } = registerData;
    if (!confirmPassword) {
      setPasswordsMatch(true);
      return;
    }
    setPasswordsMatch(password === confirmPassword);
  }, [registerData.password, registerData.confirmPassword]);

  /* ======================
     REGISTER SUBMIT
  ====================== */
  const handleRegister = async (e) => {
    e.preventDefault();
    if (isLoading) return;
    setLoginError("");
    setRegisterWarning("");
    console.log("handleRegister called", { registerData, otpVerified, emailExists, usernameExists });

    // validate required fields (exclude the show-password checkbox)
    const { fullName, email, username, password, confirmPassword, role } = registerData;
    if (!fullName || !email || !username || !password || !confirmPassword || !role) {
      setRegisterWarning("Please fill in all required fields.");
      return;
    }

    if (emailExists || usernameExists) return;
    if (!otpVerified) {
      setRegisterWarning("Please verify your email with OTP before registering.");
      return;
    }
    if (registerData.password !== registerData.confirmPassword) {
      setRegisterWarning("Passwords do not match.");
      return;
    }

    let res;
    try {
      setLoading(true);
      res = await fetch(`${API}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          fullName: registerData.fullName,
          email: registerData.email,
          username: registerData.username,
          password: registerData.password,
          role: registerData.role
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.user) setUser(data.user);
        navigate("/home");
        return;
      }

      // handle error response
      const err = await res.json();
      console.error("Register failed:", err);
      setRegisterWarning(err.message || "Registration failed");
    } catch (networkErr) {
      console.error("Register network error:", networkErr);
      setRegisterWarning(networkErr.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  /* ======================
     OTP SEND / VERIFY
  ====================== */
  const handleOtpButtonClick = async () => {
    setOtpError("");

    // Need an email to send OTP
    if (!registerData.email) {
      setOtpError("Please enter an email first.");
      return;
    }

    // Block sending OTP if email already exists
    if (emailExists) {
      setOtpError("Email already exists");
      return;
    }

    // SEND OTP
    if (!otpSent) {
      try {
        setLoading(true);
        const res = await fetch(`${API}/send-otp`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: registerData.email })
        });

        const data = await res.json();
        setLoading(false);

        if (!res.ok) {
          setOtpError(data.message || "Failed to send OTP");
          return;
        }

        setOtpSent(true);
      } catch (err) {
        setLoading(false);
        setOtpError(err.message || "Failed to send OTP");
      }

      return;
    }

    // VERIFY OTP
    if (otpSent) {
      if (!pasteOTP) {
        setOtpError("Please paste the OTP to verify.");
        return;
      }

      try {
        setLoading(true);
        const res = await fetch(`${API}/verify-otp`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: registerData.email, otp: pasteOTP })
        });

        const data = await res.json();
        setLoading(false);

        if (!res.ok) {
          setOtpError(data.message || "OTP verification failed");
          setOtpVerified(false);
          return;
        }

        setOtpVerified(true);
        setOtpError("");
      } catch (err) {
        setLoading(false);
        setOtpError(err.message || "OTP verification failed");
        setOtpVerified(false);
      }
    }
  };

  /* ======================
     LOGIN SUBMIT
  ====================== */
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError("");
 
    try {
      setLoading(true);
      const res = await fetch(`${API}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(loginData)
      });

      const data = await res.json();

      if (!res.ok) {
        setLoginError(data.message || "Invalid credentials");
      } else {
        if (data.user) setUser(data.user);
        navigate("/home");
      }
    } catch (err) {
      setLoginError(err.message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="register-container">
        <div className="register-left">
          <div className="register-logo">
            <lord-icon
            src="https://cdn.lordicon.com/zruuduya.json"
            trigger="hover"
            colors="primary:#121331,secondary:#ffffff"
            style={{ width: "50px", height: "50px" }}
          ></lord-icon>
            <span> WasteZero</span>
          </div>

          <h1 className="register-heading">Join the Recycling Revolution</h1>

          <p className="register-description">
            WasteZero connects volunteers, NGOs, and administrators to schedule
            pickups, manage recycling opportunities, and make a positive impact
            on our environment.
          </p>

          <div className="register-features">
        <div>
          <h4>Schedule Pickups</h4>
          <p>Easily arrange waste collection</p>
        </div>

        <div>
          <h4>Track Impact</h4>
          <p>Monitor your environmental contribution</p>
        </div>

        <div>
          <h4>Volunteer</h4>
          <p>Join recycling initiatives</p>
        </div>
      </div>
        </div>

        <div className="register-right page-center">
          <div className="auth-card">

        {/* Tabs */}
        <div className="tab-header">
          <button
            className={mode === "login" ? "active" : ""}
            onClick={() => setMode("login")}
          >
            Login
          </button>
          <button
            className={mode === "register" ? "active" : ""}
            onClick={() => setMode("register")}
          >
            Register
          </button>
        </div>

        {/* Forms */}
        <div className="form-wrapper">
          <div className={`form-slider ${mode}`}>

            {/* LOGIN */}
            <form className="form-panel" onSubmit={handleLogin}>
              <h2>Welcome Back</h2>
              <p>Login to continue WasteZero</p>

              <div className="input-container">
                <input
                  type="text"
                  name="username"
                  placeholder="Enter username"
                  className="input-field"
                  onChange={handleLoginChange}
                />
                <label className="input-label">Username</label>
                <span className="input-highlight"></span>
              </div>

              <div className="input-container">
                <input
                  type="password"
                  name="password"
                  placeholder="Enter password"
                  className="input-field"
                  onChange={handleLoginChange}
                />
                <label className="input-label">Password</label>
                <span className="input-highlight"></span>
              </div>

              {loginError && (
                <p style={{ color: "red", fontSize: "0.85rem" }}>
                  {loginError}
                </p>
              )}

              <button className="primary-btn">Login</button>
            </form>

            {/* REGISTER */}
            <form className="form-panel" onSubmit={handleRegister} noValidate>
              <h2>Create a new account</h2>
              <p>Fill in your details to join WasteZero</p>

              {/* Full Name */}
              <div className="input-container">
                <input
                  type="text"
                  name="fullName"
                  placeholder="Your full name"
                  className="input-field"
                  onChange={handleRegisterChange}
                />
                <label className="input-label">Full Name</label>
                <span className="input-highlight"></span>
              </div>

              {/* Email */}
              <div className="input-container">
                <input
                  type="email"
                  name="email"
                  placeholder="Your email"
                  className="input-field"
                  onChange={handleRegisterChange}
                />
                <label className="input-label">Email</label>
                <span className="input-highlight"></span>
              </div>
              {emailExists && (
                <p style={{ color: "red", fontSize: "0.85rem" }}>
                  Email already exists
                </p>
              )}

              {/* Username */}
              <div className="input-container">
                <input
                  type="text"
                  name="username"
                  placeholder="Choose a username"
                  className="input-field"
                  onChange={handleRegisterChange}
                />
                <label className="input-label">Username</label>
                <span className="input-highlight"></span>
              </div>
              {usernameExists && (
                <p style={{ color: "red", fontSize: "0.85rem" }}>
                  Username already exists
                </p>
              )}

              {/* Passwords */}
              <div className="row">
                <div className="input-container">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    placeholder="Create password"
                    className="input-field"
                    onChange={handleRegisterChange}
                  />
                  <label className="input-label">Password</label>
                  <span className="input-highlight"></span>
                </div>

                <div className="input-container">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="confirmPassword"
                    placeholder="Confirm password"
                    className="input-field"
                    onChange={handleRegisterChange}
                  />
                  <label className="input-label">Confirm Password</label>
                  <span className="input-highlight"></span>
                </div>
              </div>

              {!passwordsMatch && registerData.confirmPassword && (
                <p style={{ color: "red", fontSize: "0.85rem", marginTop: 6 }}>
                  Passwords do not match
                </p>
              )}

              {/* SHOW PASSWORD */}
              <div className="show-password">
                <input
                  type="checkbox"
                  id="showPwd"
                  onChange={() => setShowPassword(!showPassword)}
                />
                <label htmlFor="showPwd">Show Password</label>
              </div>

              {/* Role */}
              <div className="input-container">
                <select
                  name="role"
                  className="input-field"
                  onChange={handleRegisterChange}
                >
                  <option value="">Select role</option>
                  <option>Volunteer</option>
                  <option>NGO</option>
                  <option>Admin</option>
                </select>
              </div>

              {/* OTP: Get / Verify */}
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
                <div className="input-container" style={{ flex: 7, minWidth: 0 }}>
                  <input
                    type="tel"
                    inputMode="numeric"
                    name="pasteOTP"
                    placeholder="Paste OTP"
                    className="input-field"
                    value={pasteOTP}
                    onChange={(e) => {
                      setPasteOTP(e.target.value.replace(/[^0-9]/g, ""));
                      setOtpError("");
                    }}
                    autoComplete="one-time-code"
                  />
                  <label className="input-label">Paste OTP</label>
                  <span className="input-highlight"></span>
                </div>

                <button
                  type="button"
                  className="primary-btn"
                  onClick={handleOtpButtonClick}
                  style={{
                    flex: 3,
                    padding: "10px 12px",
                    fontSize: "0.95rem",
                    cursor: emailExists ? "not-allowed" : undefined,
                    opacity: emailExists ? 0.6 : 1
                  }}
                  disabled={emailExists || isLoading}
                  title={emailExists ? "Email already exists" : undefined}
                >
                  {otpSent ? "Verify OTP" : "Get OTP"}
                </button>
              </div>

              {(otpError || emailExists) && (
                <p style={{ color: "red", fontSize: "0.85rem", marginTop: 6 }}>
                  {otpError || (emailExists ? "Email already exists" : "")}
                </p>
              )}

              {otpVerified && (
                <p style={{ color: "green", fontSize: "0.85rem", marginTop: 6 }}>
                  OTP verified ✓
                </p>
              )}

              {registerWarning && (
                <p style={{ color: "red", fontSize: "0.95rem", marginTop: 8 }}>
                  {registerWarning}
                </p>
              )}

              <button
                className="primary-btn"
                type="submit"
                disabled={
                  !otpVerified ||
                  !registerData.fullName ||
                  !registerData.email ||
                  !registerData.username ||
                  !registerData.password ||
                  !registerData.confirmPassword ||
                  !registerData.role ||
                  emailExists ||
                  usernameExists ||
                  isLoading
                }
                title={
                  otpVerified ? undefined : "Please verify OTP to create account"
                }
                style={{ cursor: otpVerified ? "pointer" : "not-allowed" }}
              >
                Create Account
              </button>
            </form>

          </div>
        </div>
          </div>
        </div>
      </div>
    </>
  );
}
