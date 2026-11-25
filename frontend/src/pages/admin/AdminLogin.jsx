
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { adminApi } from "../../api";
import "./AdminLogin.css";

function AdminLogin() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();

    setError("");

    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setLoading(true);

    try {
      // STEP 1: Authenticate admin credentials
      const loginResponse = await adminApi.post(
        "auth/login/",
        {
          email: email.trim().toLowerCase(),
          password,
        }
      );

      const { access, refresh } = loginResponse.data || {};

      // STEP 2: Validate tokens
      if (!access || !refresh) {
        throw new Error(
          "Login response does not contain valid tokens."
        );
      }

      // STEP 3: Save ADMIN tokens separately
      localStorage.setItem("admin_access", access);
      localStorage.setItem("admin_refresh", refresh);

      // STEP 4: Verify admin permission
      // adminApi automatically sends admin_access
      await adminApi.get("auth/admin/users/");

      // STEP 5: Notify components
      window.dispatchEvent(new Event("authChanged"));

      // STEP 6: Navigate to Admin Dashboard
      navigate("/admin/dashboard", { replace: true });

    } catch (err) {
      console.error(
        "ADMIN LOGIN ERROR:",
        err.response?.data || err.message
      );

      const status = err.response?.status;

      // Remove ONLY admin tokens
      // Never remove customer tokens here
      localStorage.removeItem("admin_access");
      localStorage.removeItem("admin_refresh");

      if (status === 403) {
        setError(
          "This account does not have administrator permission."
        );
      } else if (status === 401) {
        setError(
          "Authentication failed. Please check your credentials."
        );
      } else if (!err.response) {
        setError(
          "Unable to connect to the server. Please check your backend."
        );
      } else {
        setError(
          err.response?.data?.detail ||
          err.response?.data?.message ||
          err.message ||
          "Admin login failed. Please try again."
        );
      }

    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-page">
      <div className="admin-login-card">

        <div className="admin-login-brand">STYLO</div>

        <div className="admin-login-line" />

        <p className="admin-login-label">
          ADMINISTRATION
        </p>

        <h1>Welcome Back</h1>

        <p className="admin-login-subtitle">
          Sign in to access your admin dashboard.
        </p>

        <form onSubmit={handleLogin} noValidate>

          {/* EMAIL */}
          <div className="admin-input-group">
            <label htmlFor="admin-email">
              Email Address
            </label>

            <input
              id="admin-email"
              type="email"
              placeholder="admin@stylo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              autoComplete="username"
            />
          </div>

          {/* PASSWORD */}
          <div className="admin-input-group">
            <label htmlFor="admin-password">
              Password
            </label>

            <div className="admin-password-wrapper">
              <input
                id="admin-password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                autoComplete="current-password"
              />

              <button
                type="button"
                className="admin-password-toggle"
                onClick={() =>
                  setShowPassword((previous) => !previous)
                }
                disabled={loading}
                tabIndex={-1}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {/* FORGOT PASSWORD */}
          <div className="admin-forgot-password">
            <button
              type="button"
              className="admin-forgot-btn"
              onClick={() =>
                navigate("/admin/forgot-password")
              }
              disabled={loading}
            >
              Forgot Password?
            </button>
          </div>

          {/* ERROR */}
          {error && (
            <div
              className="admin-login-error"
              role="alert"
            >
              {error}
            </div>
          )}

          {/* SUBMIT */}
          <button
            type="submit"
            className="admin-login-button"
            disabled={loading}
          >
            {loading
              ? "VERIFYING..."
              : "SIGN IN TO DASHBOARD"}
          </button>

        </form>

        <p className="admin-login-footer">
          STYLO © 2026. All rights reserved.
        </p>

      </div>
    </div>
  );
}

export default AdminLogin;
