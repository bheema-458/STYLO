
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api";
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
    setLoading(true);

    try {
      const response = await api.post("auth/login/", {
        email: email.trim(),
        password,
      });

      const { access, refresh } = response.data;

      localStorage.setItem("access", access);
      localStorage.setItem("refresh", refresh);

      await api.get("auth/admin/users/", {
        headers: {
          Authorization: `Bearer ${access}`,
        },
      });

      navigate("/admin/dashboard", { replace: true });

    } catch (err) {
      console.log(
        "ADMIN LOGIN ERROR:",
        err.response?.data
      );

      console.log(
        "STATUS:",
        err.response?.status
      );

      localStorage.removeItem("access");
      localStorage.removeItem("refresh");

      setError(
        err.response?.data?.detail ||
        JSON.stringify(err.response?.data) ||
        err.message ||
        "Login failed. Please try again."
      );

    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-page">

      <div className="admin-login-card">

        <div className="admin-login-brand">
          STYLO
        </div>

        <div className="admin-login-line"></div>

        <p className="admin-login-label">
          ADMINISTRATION
        </p>

        <h1>Welcome Back</h1>

        <p className="admin-login-subtitle">
          Sign in to manage your store.
        </p>

        <form onSubmit={handleLogin}>

          <label>Email Address</label>

          <input
            type="email"
            placeholder="Enter admin email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <label>Password</label>

          <div className="admin-password-wrapper">

            <input
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? "Hide" : "Show"}
            </button>

          </div>

          <div className="admin-forgot-password">

            <button
              type="button"
              onClick={() => navigate("/admin/forgot-password")}
            >
              Forgot Password?
            </button>

          </div>

          {error && (
            <p className="admin-login-error">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="admin-login-button"
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign In"}
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
