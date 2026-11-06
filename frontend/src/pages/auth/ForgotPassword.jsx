
import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import AuthLayout from "../../components/auth/AuthLayout";
import api from "../../api";
import "./AuthFlow.css";

function ForgotPassword() {
  const navigate = useNavigate();
  const location = useLocation();

  const isAdmin = location.pathname.startsWith("/admin/");
  const loginPath = isAdmin ? "/admin/login" : "/login";

  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const response = await api.post("auth/forgot-password/", {
        email: email.trim(),
      });

      setSuccess(
        response.data.message || "Reset OTP request processed."
      );

      setTimeout(() => {
        navigate(
          isAdmin ? "/admin/reset-password" : "/reset-password",
          {
            state: {
              email: email.trim(),
              isAdmin,
            },
          }
        );
      }, 1500);
    } catch (err) {
      const data = err.response?.data;

      setError(
        data?.detail ||
        data?.email?.[0] ||
        "Unable to process your request. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="auth-flow-container">
        <h1>Forgot Password?</h1>

        <p className="auth-flow-subtitle">
          Enter your registered email address. We'll send you a
          password reset OTP.
        </p>

        <form onSubmit={handleSubmit}>
          <label>Email Address</label>

          <input
            type="email"
            placeholder="Enter your registered email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          {error && (
            <p className="auth-flow-error">{error}</p>
          )}

          {success && (
            <p className="auth-flow-success">{success}</p>
          )}

          <button type="submit" disabled={loading}>
            {loading ? "Sending..." : "Send Reset OTP"}
          </button>
        </form>

        <p className="auth-flow-link">
          Remember your password?{" "}
          <Link to={loginPath}>Sign In</Link>
        </p>
      </div>
    </AuthLayout>
  );
}

export default ForgotPassword;
