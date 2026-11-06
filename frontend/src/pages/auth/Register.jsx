import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
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

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleRegister = async (e) => {
    e.preventDefault();

    setError("");
    setSuccess("");

    if (formData.password !== formData.confirm_password) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await api.post("auth/register/", {
        username: formData.username,
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email.trim(),
        phone_number: formData.phone_number,
        password: formData.password,
      });

      setSuccess("Registration successful! Please verify your email.");

setTimeout(() => {
  navigate("/verify-email", {
    state: { email: formData.email.trim() },
  });
}, 1000);

    } catch (err) {
  console.error("REGISTER ERROR:", err);

  if (err.response) {
    console.log("STATUS:", err.response.status);
    console.log("RESPONSE DATA:", err.response.data);

    const data = err.response.data;

    const errorMessage =
      typeof data === "string"
        ? data
        : Object.entries(data || {})
            .map(([field, messages]) => {
              const message = Array.isArray(messages)
                ? messages.join(", ")
                : typeof messages === "object"
                  ? JSON.stringify(messages)
                  : messages;

              return `${field}: ${message}`;
            })
            .join(" | ");

    setError(errorMessage || "Registration failed.");
  } else {
    setError(err.message || "Unable to connect to the server.");
  }
} finally {
  setLoading(false);
}
  };

  return (
    <AuthLayout>
      <div className="register-container">
        <h1>Create Account</h1>

        <p className="register-subtitle">
          Join STYLO and discover your style.
        </p>

        <form onSubmit={handleRegister}>
          <label>Username</label>
          <input
            type="text"
            name="username"
            placeholder="Enter username"
            value={formData.username}
            onChange={handleChange}
            required
          />

          <label>First Name</label>
          <input
            type="text"
            name="first_name"
            placeholder="Enter first name"
            value={formData.first_name}
            onChange={handleChange}
            required
          />

          <label>Last Name</label>
          <input
            type="text"
            name="last_name"
            placeholder="Enter last name"
            value={formData.last_name}
            onChange={handleChange}
          />

          <label>Email Address</label>
          <input
            type="email"
            name="email"
            placeholder="Enter email address"
            value={formData.email}
            onChange={handleChange}
            required
          />

          <label>Phone Number</label>
          <input
            type="tel"
            name="phone_number"
            placeholder="Enter phone number"
            value={formData.phone_number}
            onChange={handleChange}
          />

          <label>Password</label>
          <input
            type="password"
            name="password"
            placeholder="Create password"
            value={formData.password}
            onChange={handleChange}
            required
          />

          <label>Confirm Password</label>
          <input
            type="password"
            name="confirm_password"
            placeholder="Confirm password"
            value={formData.confirm_password}
            onChange={handleChange}
            required
          />

          {error && <p className="register-error">{error}</p>}
          {success && <p className="register-success">{success}</p>}

          <button
            type="submit"
            className="register-submit"
            disabled={loading}
          >
            {loading ? "Creating Account..." : "Create Account"}
          </button>
        </form>

        <p className="register-login-text">
          Already have an account?{" "}
          <Link to="/login">Sign In</Link>
        </p>
      </div>
    </AuthLayout>
  );
}

export default Register;