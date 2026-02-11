import { useEffect, useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Register.css";
import { UserContext } from "../Services/UserContext";
import Loading from "../components/Loading";

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
  const [isLoading, setIsLoading] = useState(false);


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

  /* ======================
     REGISTER SUBMIT
  ====================== */
  const handleRegister = async (e) => {
    e.preventDefault();
    setLoginError("");
  

    // validate required fields (exclude the show-password checkbox)
    const { fullName, email, username, password, confirmPassword, role } = registerData;
    if (!fullName || !email || !username || !password || !confirmPassword || !role) {
      setRegisterWarning("Please fill in all required fields.");
      return;
    }

    if (emailExists || usernameExists) return;
    if (registerData.password !== registerData.confirmPassword) {
      setRegisterWarning("Passwords do not match.");
      return;
    }

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
      const data = await res.json();
      if (data.user) setUser(data.user);
      navigate("/home");
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
      if (data.user) setUser(data.user);;
      navigate("/home");
    }
  };

  return (
    <>
    <Loading isLoading={isLoading} />
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

              {registerWarning && (
                <p style={{ color: "red", fontSize: "0.95rem", marginTop: 8 }}>
                  {registerWarning}
                </p>
              )}

              <button className="primary-btn" type="submit">
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
