
import { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import AuthLayout from "../../components/auth/AuthLayout";
import api from "../../api";
import "./AuthFlow.css";

function VerifyEmail() {
  const navigate = useNavigate();
  const location = useLocation();

  const email = location.state?.email || "";

  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);

  // Countdown timer
  useEffect(() => {
    if (resendCountdown <= 0) return;

    const timer = setTimeout(() => {
      setResendCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [resendCountdown]);

  // Extract backend error messages
  const getErrorMessage = (err, fallback) => {
    const data = err.response?.data;

    if (!data) {
      return "Network error. Please check your connection.";
    }

    if (data.detail) return data.detail;
    if (data.message) return data.message;
    if (data.error) return data.error;

    if (data.otp) {
      return Array.isArray(data.otp)
        ? data.otp[0]
        : data.otp;
    }

    if (data.non_field_errors) {
      return Array.isArray(data.non_field_errors)
        ? data.non_field_errors[0]
        : data.non_field_errors;
    }

    if (err.response?.status === 429) {
      return "Too many requests. Please wait before trying again.";
    }

    return fallback;
  };

  // Verify OTP
  const handleVerify = async (e) => {
    e.preventDefault();

    setError("");
    setSuccess("");

    if (!email) {
      setError("Email address is missing. Please register again.");
      return;
    }

    if (!/^\d{6}$/.test(otp)) {
      setError("Please enter a valid 6-digit OTP.");
      return;
    }

    setLoading(true);

    try {
      const response = await api.post("auth/verify-email/", {
        email,
        otp,
      });

      setSuccess(
        response.data.message ||
        "Email verified successfully!"
      );

      setTimeout(() => {
        navigate("/login", { replace: true });
      }, 1500);

    } catch (err) {
      setError(
        getErrorMessage(
          err,
          "OTP verification failed. Please try again."
        )
      );
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOTP = async () => {
    if (!email || resendLoading || resendCountdown > 0) {
      return;
    }

    setError("");
    setSuccess("");
    setResendLoading(true);

    try {
      const response = await api.post("auth/resend-otp/", {
        email,
      });

      setSuccess(
        response.data.message ||
        "If your account needs verification, an OTP can be requested."
      );

      setOtp("");
      setResendCountdown(60);

    } catch (err) {
      setError(
        getErrorMessage(
          err,
          "Unable to resend OTP. Please try again."
        )
      );
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="verify-container">

        <div className="verify-icon">
          <span>✉</span>
        </div>

        <h1>Verify Your Email</h1>

        <p className="verify-subtitle">
          We've sent a verification code to
        </p>

        <p className="verify-email">{email}</p>

        <form onSubmit={handleVerify}>

          <label htmlFor="otp">
            Enter 6-digit OTP
          </label>

          <input
            id="otp"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="000000"
            value={otp}
            onChange={(e) => {
              setOtp(e.target.value.replace(/\D/g, ""));
              setError("");
            }}
            required
            disabled={loading}
          />

          {error && (
            <p className="verify-error" role="alert">
              {error}
            </p>
          )}

          {success && (
            <p className="verify-success" role="status">
              {success}
            </p>
          )}

          <button
            type="submit"
            className="verify-submit-btn"
            disabled={loading || otp.length !== 6}
          >
            {loading ? "Verifying..." : "Verify Email"}
          </button>

        </form>

        <div className="resend-section">

          <p className="resend-text">
            Didn't receive the code?
          </p>

          <button
            type="button"
            className="resend-btn"
            onClick={handleResendOTP}
            disabled={resendLoading || resendCountdown > 0}
          >
            {resendLoading
              ? "Sending..."
              : resendCountdown > 0
              ? `Resend OTP in ${resendCountdown}s`
              : "Resend OTP"}
          </button>

        </div>

        <Link to="/register" className="verify-back-link">
          Back to Register
        </Link>

      </div>
    </AuthLayout>
  );
}

export default VerifyEmail;
