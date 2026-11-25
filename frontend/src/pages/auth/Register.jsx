
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import AuthLayout from "../../components/auth/AuthLayout";
import api from "../../api";
import "./Register.css";

function Register() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    username: "",
    first_name: "",
    last_name: "",
    email: "",
    phone_number: "",
    password: "",
    confirm_password: "",
  });

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  // Handle input changes
  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    setError("");
  };

  // Frontend validation
  const validateForm = () => {
    const {
      username,
      first_name,
      last_name,
      email,
      phone_number,
      password,
      confirm_password,
    } = formData;

    // Username validation
    const cleanUsername = username.trim();

    if (!cleanUsername) {
      return "Username is required.";
    }

    if (cleanUsername.length < 3 || cleanUsername.length > 20) {
      return "Username must contain 3 to 20 characters.";
    }

    if (!/^[a-zA-Z0-9_.-]+$/.test(cleanUsername)) {
      return "Username can contain letters, numbers, dots, hyphens and underscores only.";
    }

    // First name validation
    const nameRegex = /^[\p{L}][\p{L}\s'-]*$/u;

    if (!first_name.trim()) {
      return "First name is required.";
    }

    if (!nameRegex.test(first_name.trim())) {
      return "Please enter a valid first name.";
    }

    // Last name validation (optional)
    if (last_name.trim() && !nameRegex.test(last_name.trim())) {
      return "Please enter a valid last name.";
    }

    // Email validation
    const cleanEmail = email.trim();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!cleanEmail) {
      return "Email address is required.";
    }

    if (!emailRegex.test(cleanEmail)) {
      return "Please enter a valid email address.";
    }

    // Phone number validation (optional)
    if (phone_number.trim()) {
      const cleanPhone = phone_number.replace(/[\s-]/g, "");

      if (!/^(\+91)?[6-9]\d{9}$/.test(cleanPhone)) {
        return "Please enter a valid 10-digit Indian phone number.";
      }
    }

    // Password validation
    if (password.length < 8) {
      return "Password must contain at least 8 characters.";
    }

    if (!/[A-Z]/.test(password)) {
      return "Password must contain at least one uppercase letter.";
    }

    if (!/[a-z]/.test(password)) {
      return "Password must contain at least one lowercase letter.";
    }

    if (!/[0-9]/.test(password)) {
      return "Password must contain at least one number.";
    }

    // Confirm password validation
    if (!confirm_password) {
      return "Please confirm your password.";
    }

    if (password !== confirm_password) {
      return "Passwords do not match.";
    }

    return null;
  };

  // Format backend errors
  const getBackendError = (data) => {
    if (!data) {
      return "Registration failed. Please try again.";
    }

    if (typeof data === "string") {
      return data;
    }

    const messages = Object.entries(data).map(
      ([field, value]) => {
        const readableField = field
          .replaceAll("_", " ")
          .replace(/\b\w/g, (char) => char.toUpperCase());

        const message = Array.isArray(value)
          ? value.join(", ")
          : typeof value === "object" && value !== null
          ? JSON.stringify(value)
          : String(value);

        return `${readableField}: ${message}`;
      }
    );

    return messages.join(" | ") || "Registration failed.";
  };

  // Register user
  const handleRegister = async (e) => {
    e.preventDefault();

    if (loading) return;

    setError("");
    setSuccess("");

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    const cleanEmail = formData.email.trim().toLowerCase();

    try {
      await api.post("auth/register/", {
        username: formData.username.trim(),
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        email: cleanEmail,
        phone_number: formData.phone_number.trim(),
        password: formData.password,
      });

      setSuccess(
        "Registration successful! Please verify your email."
      );

      setTimeout(() => {
        navigate("/verify-email", {
          state: { email: cleanEmail },
        });
      }, 1000);

    } catch (err) {
      console.error("REGISTER ERROR:", err);

      if (err.response) {
        if (err.response.status === 429) {
          setError(
            "Too many registration attempts. Please try again later."
          );
        } else {
          setError(getBackendError(err.response.data));
        }
      } else {
        setError(
          "Unable to connect to the server. Please try again."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      heroImageUrl="https://img1.cdn.dorrisbridal.com/image/1200x0/90/1/b7c408c9d850c704/4186d3858a6dac80f852b3a1cb1e55cf.jpg?format=webp"
      title="Create Account"
      subtitle="Join STYLO and discover your style."
      badgeText="NEW MEMBER"
    >
      <div className="register-container">
        <form onSubmit={handleRegister}>

          <div className="auth-input-group">
            <label htmlFor="username">Username</label>
            <div className="auth-input-wrapper">
              <input
                id="username"
                type="text"
                name="username"
                placeholder="Enter username"
                value={formData.username}
                onChange={handleChange}
                autoComplete="username"
                required
              />
            </div>
          </div>

          <div className="auth-input-group">
            <label htmlFor="first_name">First Name</label>
            <div className="auth-input-wrapper">
              <input
                id="first_name"
                type="text"
                name="first_name"
                placeholder="Enter first name"
                value={formData.first_name}
                onChange={handleChange}
                autoComplete="given-name"
                required
              />
            </div>
          </div>

          <div className="auth-input-group">
            <label htmlFor="last_name">Last Name (Optional)</label>
            <div className="auth-input-wrapper">
              <input
                id="last_name"
                type="text"
                name="last_name"
                placeholder="Enter last name"
                value={formData.last_name}
                onChange={handleChange}
                autoComplete="family-name"
              />
            </div>
          </div>

          <div className="auth-input-group">
            <label htmlFor="email">Email Address</label>
            <div className="auth-input-wrapper">
              <input
                id="email"
                type="email"
                name="email"
                placeholder="Enter email address"
                value={formData.email}
                onChange={handleChange}
                autoComplete="email"
                required
              />
            </div>
          </div>

          <div className="auth-input-group">
            <label htmlFor="phone_number">
              Phone Number (Optional)
            </label>
            <div className="auth-input-wrapper">
              <input
                id="phone_number"
                type="tel"
                name="phone_number"
                placeholder="Enter 10-digit phone number"
                value={formData.phone_number}
                onChange={handleChange}
                autoComplete="tel"
              />
            </div>
          </div>

          <div className="auth-input-group">
            <label htmlFor="password">Password</label>
            <div className="auth-input-wrapper">
              <input
                id="password"
                type="password"
                name="password"
                placeholder="Create password"
                value={formData.password}
                onChange={handleChange}
                autoComplete="new-password"
                required
              />
            </div>
          </div>

          <div className="auth-input-group">
            <label htmlFor="confirm_password">
              Confirm Password
            </label>
            <div className="auth-input-wrapper">
              <input
                id="confirm_password"
                type="password"
                name="confirm_password"
                placeholder="Confirm password"
                value={formData.confirm_password}
                onChange={handleChange}
                autoComplete="new-password"
                required
              />
            </div>
          </div>

          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}

          {success && (
            <p className="login-success" role="status">
              {success}
            </p>
          )}

          <button
            type="submit"
            className="btn-dark-green"
            disabled={loading}
          >
            {loading ? "Creating Account..." : "Create Account →"}
          </button>

        </form>

        <p className="auth-bottom-text">
          Already have an account?{" "}
          <Link to="/login">Sign In</Link>
        </p>
      </div>
    </AuthLayout>
  );
}

export default Register;
