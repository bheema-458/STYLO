
import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import AuthLayout from "../../components/auth/AuthLayout";
import api from "../../api";
import "./AuthFlow.css";

function ResetPassword() {
  const navigate = useNavigate();
  const location = useLocation();

  const email = location.state?.email || "";
  const isAdmin = location.state?.isAdmin === true;

  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const forgotPasswordPath = isAdmin
    ? "/admin/forgot-password"
    : "/forgot-password";

  const loginPath = isAdmin
    ? "/admin/login"
    : "/login";

  const handleReset = async (e) => {
    e.preventDefault();

    setError("");
    setSuccess("");

    if (otp.length !== 6) {
      setError("Please enter the 6-digit OTP.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await api.post("auth/reset-password/", {
  email: email.trim(),
  otp,
  new_password: newPassword,
  confirm_password: confirmPassword,
});

      setSuccess(
        response.data.message || "Password reset successfully."
      );

      setTimeout(() => {
        navigate(loginPath);
      }, 1500);
    } catch (err) {
  const data = err.response?.data;

  console.log("Reset Password Error:", data);

  setError(
    data?.detail ||
      data?.email?.[0] ||
      data?.otp?.[0] ||
      data?.new_password?.[0] ||
      data?.confirm_password?.[0] ||
      data?.non_field_errors?.[0] ||
      "Password reset failed. Please try again."
  );

    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="auth-flow-container">
        <h1>Reset Password</h1>

        <p className="auth-flow-subtitle">
          Enter the OTP sent to your email and create a new password.
        </p>

        <p className="auth-flow-email">{email}</p>

        {!email && (
          <p className="auth-flow-error">
            Email address is missing. Please start from Forgot Password.
          </p>
        )}

        <form onSubmit={handleReset}>
          <label>6-digit OTP</label>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="Enter OTP"
            value={otp}
            onChange={(e) =>
              setOtp(e.target.value.replace(/\D/g, ""))
            }
            required
          />

          <label>New Password</label>
          <input
            type="password"
            autoComplete="new-password"
            placeholder="Enter new password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />

          <label>Confirm New Password</label>
          <input
            type="password"
            autoComplete="new-password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />

          {error && (
            <p className="auth-flow-error">{error}</p>
          )}

          {success && (
            <p className="auth-flow-success">{success}</p>
          )}

          <button
            type="submit"
            disabled={loading || !email}
          >
            {loading ? "Resetting..." : "Reset Password"}
          </button>
        </form>

        <p className="auth-flow-link">
          <Link to={forgotPasswordPath}>
            Back to Forgot Password
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}

export default ResetPassword;
