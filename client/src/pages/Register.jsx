import { useEffect, useState} from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Register.css";

const API = "http://localhost:3000/auth";

export default function Register() {
  const navigate = useNavigate();


    /* ======================
     SESSION CHECK ON LOAD
  ====================== */
  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await fetch(`${API}/dashboard`, {
          credentials: "include",
        });

        if (res.ok) {
          navigate("/dashboard");
        }
      } catch (err) {
        // stay on login page
      }
    };

    checkSession();
  }, [navigate]);

  const [mode, setMode] = useState("login");
  const [showPassword, setShowPassword] = useState(false);

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
  };

  const handleLoginChange = (e) => {
    setLoginData({ ...loginData, [e.target.name]: e.target.value });
  };

  /* ======================
     CHECK EMAIL (3s)
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

  /* ======================
     REGISTER SUBMIT
  ====================== */
  const handleRegister = async (e) => {
    e.preventDefault();

    if (emailExists || usernameExists) return;
    if (registerData.password !== registerData.confirmPassword) return;

    const res = await fetch(`${API}/register`, {
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
      navigate("/dashboard");
    }
  };

  /* ======================
     LOGIN SUBMIT
  ====================== */
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError("");

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
      navigate("/dashboard");
    }
  };

  return (
    <div className="page-center">
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
            <form className="form-panel" onSubmit={handleRegister}>
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

              <button className="primary-btn" type="submit">
                Create Account
              </button>
            </form>

          </div>
        </div>
      </div>
    </div>
  );
}
