
import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";

import AuthLayout from "../../components/auth/AuthLayout";
import { userApi } from "../../api";
import "./Login.css";

function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();

    setError("");
    setSuccess("");

    // STEP 1: Validate input
    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setLoading(true);

    try {
      // STEP 2: Authenticate Customer
      const response = await userApi.post(
        "auth/login/",
        {
          email: email.trim().toLowerCase(),
          password,
        }
      );

      const { access, refresh } = response.data || {};

      // STEP 3: Validate JWT tokens
      if (!access || !refresh) {
        throw new Error(
          "Login response does not contain valid tokens."
        );
      }

      // STEP 4: Save CUSTOMER tokens separately
      localStorage.setItem("user_access", access);
      localStorage.setItem("user_refresh", refresh);

      // STEP 5: Notify Navbar and other components
      window.dispatchEvent(new Event("authChanged"));

      // STEP 6: Show success message
      setSuccess("Login successful! Welcome to STYLO.");

      // STEP 7: Redirect to requested page
      const redirectTo =
        location.state?.from?.pathname || "/home";

      navigate(redirectTo, { replace: true });

    } catch (err) {
      console.error(
        "USER LOGIN ERROR:",
        err.response?.data || err.message
      );

      const responseData = err.response?.data;

      let errorMessage =
        responseData?.detail ||
        responseData?.message ||
        responseData?.non_field_errors?.[0] ||
        err.message;

      if (!err.response) {
        errorMessage =
          "Unable to connect to the server. Please try again.";
      }

      setError(
        errorMessage ||
        "Login failed. Please check your credentials."
      );

    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      heroImageUrl="https://img.dorriswedding.com/image/1200x0/90/1/67826963fd15e936/3404b03b3c5ff60cbf3fe1c820823b10.jpg?format=webp"
      title="Sign in to STYLO"
      subtitle="Your next favourite look is just a step away."
      badgeText="WELCOME BACK"
    >
      <div className="login-container">

        <form onSubmit={handleLogin} noValidate>

          {/* EMAIL */}
          <div className="auth-input-group">
            <label htmlFor="login-email">
              Email Address
            </label>

            <div className="auth-input-wrapper">
              <input
                id="login-email"
                type="email"
                placeholder="Enter your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                autoComplete="username"
              />
            </div>
          </div>

          {/* PASSWORD */}
          <div className="auth-input-group">
            <label htmlFor="login-password">
              Password
            </label>

            <div className="auth-input-wrapper password-field">
              <input
                id="login-password"
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
                className="password-toggle"
                onClick={() =>
                  setShowPassword((previous) => !previous)
                }
                disabled={loading}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {/* LOGIN OPTIONS */}
          <div className="login-options">

            <label className="remember-label">
              <input type="checkbox" />
              <span>Remember me</span>
            </label>

            <Link to="/forgot-password">
              Forgot Password?
            </Link>

          </div>

          {/* ERROR */}
          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}

          {/* SUCCESS */}
          {success && (
            <p className="login-success" role="status">
              {success}
            </p>
          )}

          {/* LOGIN BUTTON */}
          <button
            type="submit"
            className="btn-dark-green"
            disabled={loading}
          >
            {loading ? "Signing In..." : "Sign In →"}
          </button>

        </form>

        {/* REGISTER LINK */}
        <p className="auth-bottom-text">
          New to STYLO?{" "}
          <Link to="/register">
            Create an account
          </Link>
        </p>

      </div>
    </AuthLayout>
  );
}

export default Login;
