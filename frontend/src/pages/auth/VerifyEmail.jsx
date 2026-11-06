import { useState } from "react";
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

  const handleVerify = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (otp.length !== 6) {
      setError("Please enter the 6-digit OTP.");
      return;
    }

    setLoading(true);

    try {
      const response = await api.post("auth/verify-email/", {
        email: email,
        otp: otp,
      });

      setSuccess(
        response.data.message || "Email verified successfully!"
      );

      setTimeout(() => navigate("/login"), 1500);
    } catch (err) {
      const data = err.response?.data;

      setError(
        data?.detail ||
        data?.message ||
        "OTP verification failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setError("");
    setSuccess("");

    try {
      const response = await api.post("auth/resend-otp/", {
        email: email,
      });

      setSuccess(response.data.message || "A new OTP has been sent.");
    } catch (err) {
      const data = err.response?.data;
      setError(data?.detail || data?.message || "Unable to resend OTP.");
    }
  };

  return (
    <AuthLayout>
      <div className="verify-container">
        <h1>Verify Your Email</h1>

        <p className="verify-subtitle">
          We've sent a verification code to
        </p>

        <p className="verify-email">{email}</p>

        <form onSubmit={handleVerify}>
          <label>Enter 6-digit OTP</label>

          <input
            type="text"
            inputMode="numeric"
            maxLength="6"
            placeholder="Enter OTP"
            value={otp}
            onChange={(e) =>
              setOtp(e.target.value.replace(/\D/g, ""))
            }
            required
          />

          {error && <p className="verify-error">{error}</p>}
          {success && <p className="verify-success">{success}</p>}

          <button type="submit" disabled={loading}>
            {loading ? "Verifying..." : "Verify Email"}
          </button>
        </form>

        <p className="resend-text">
          Didn't receive the code?{" "}
          <button type="button" onClick={handleResendOTP}>
            Resend OTP
          </button>
        </p>

        <Link to="/register">Back to Register</Link>
      </div>
    </AuthLayout>
  );
}

export default VerifyEmail;