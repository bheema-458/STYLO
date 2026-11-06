import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "../../components/auth/AuthLayout";
import api from "../../api";
import "./Login.css";

function Login() {
  const navigate = useNavigate();
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
    setLoading(true);

    try {
      const response = await api.post("auth/login/", {
        email: email.trim(),
        password: password,
      });

      localStorage.setItem("access", response.data.access);
      localStorage.setItem("refresh", response.data.refresh);

      setSuccess("Login successful! Welcome to STYLO.");

     navigate("/");
    } catch (err) {
  console.log("LOGIN ERROR:", err.response?.data || err.message);

  const errorMessage =
    err.response?.data?.detail ||
    JSON.stringify(err.response?.data) ||
    "Login failed. Please check your email and password.";

  setError(errorMessage);
} finally {
  setLoading(false);
}

   
  };

  return (
    <AuthLayout>
      <div className="login-container">
        <h1>Welcome Back</h1>

        <p className="login-subtitle">
          Sign in to continue your style journey.
        </p>

        <form onSubmit={handleLogin}>
          <label>Email Address</label>
          <input
            type="email"
            placeholder="Enter your email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <label>Password</label>

<div className="password-field">
  <input
    type={showPassword ? "text" : "password"}
    placeholder="Enter your password"
    value={password}
    onChange={(e) => setPassword(e.target.value)}
    required
  />

  <button
    type="button"
    className="password-toggle"
    onClick={() => setShowPassword(!showPassword)}
  >
    {showPassword ? "Hide" : "Show"}
  </button>
</div>
          <div className="login-options">
            <label className="remember-label">
              <input type="checkbox" />
              Remember me
            </label>

            <Link to="/forgot-password">
              Forgot Password?
            </Link>
          </div>

          {error && <p className="login-error">{error}</p>}
          {success && <p className="login-success">{success}</p>}

          <button
            type="submit"
            className="login-submit"
            disabled={loading}
          >
            {loading ? "Signing In..." : "Sign In"}
          </button>
        </form>

        <p className="register-text">
          New to STYLO?{" "}
          <Link to="/register">Create an account</Link>
        </p>
      </div>
    </AuthLayout>
  );
}

export default Login;