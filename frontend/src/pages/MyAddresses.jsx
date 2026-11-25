
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { userApi } from "../api";
import Navbar from "../components/Navbar";
import "./MyAddresses.css";

function MyAddresses() {
  const navigate = useNavigate();

  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const initialForm = {
    full_name: "",
    phone_number: "",
    address_line: "",
    city: "",
    state: "",
    pincode: "",
    is_default: false,
  };

  const [formData, setFormData] = useState(initialForm);

  // Check customer login
  useEffect(() => {
    const token = localStorage.getItem("user_access");

    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    fetchAddresses();
  }, [navigate]);

  // Fetch all addresses
  const fetchAddresses = async () => {
    try {
      setLoading(true);

      const response = await userApi.get("auth/addresses/");

      const data = response.data;

      setAddresses(
        Array.isArray(data) ? data : data.results || []
      );
    } catch (error) {
      console.error("ADDRESS FETCH ERROR:", error);

      setErrorMessage(
        error.response?.data?.detail ||
        "Unable to load addresses."
      );
    } finally {
      setLoading(false);
    }
  };

  // Form input change
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));

    setErrors((prev) => ({
      ...prev,
      [name]: "",
    }));

    setMessage("");
    setErrorMessage("");
  };

  // Form validation
  const validateForm = () => {
    const newErrors = {};

    // Letters and spaces only
    const nameRegex = /^[\p{L}]+(?: [\p{L}]+)*$/u;

    if (!formData.full_name.trim()) {
      newErrors.full_name = "Full name is required";
    } else if (!nameRegex.test(formData.full_name.trim())) {
      newErrors.full_name =
        "Name must contain letters and spaces only";
    }

    // Phone number: 10 to 15 digits
    const phoneRegex = /^[0-9]{10,15}$/;

    if (!formData.phone_number.trim()) {
      newErrors.phone_number = "Phone number is required";
    } else if (!phoneRegex.test(formData.phone_number.trim())) {
      newErrors.phone_number =
        "Enter a valid phone number (10-15 digits)";
    }

    if (!formData.address_line.trim()) {
      newErrors.address_line = "Address is required";
    } else if (formData.address_line.trim().length < 5) {
      newErrors.address_line =
        "Address must contain at least 5 characters";
    }

    if (!formData.city.trim()) {
      newErrors.city = "City is required";
    }

    if (!formData.state.trim()) {
      newErrors.state = "State is required";
    }

    const pincodeRegex = /^[0-9]{6}$/;

    if (!formData.pincode.trim()) {
      newErrors.pincode = "Pincode is required";
    } else if (!pincodeRegex.test(formData.pincode.trim())) {
      newErrors.pincode = "Pincode must contain exactly 6 digits";
    }

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  };

  // Reset form
  const resetForm = () => {
    setFormData(initialForm);
    setErrors({});
    setEditingId(null);
    setShowForm(false);
  };

  // Add new address button
  const handleAddAddress = () => {
    resetForm();
    setShowForm(true);
  };

  // Edit address
  const handleEdit = (address) => {
    setFormData({
      full_name: address.full_name || "",
      phone_number: address.phone_number || "",
      address_line: address.address_line || "",
      city: address.city || "",
      state: address.state || "",
      pincode: address.pincode || "",
      is_default: address.is_default || false,
    });

    setEditingId(address.id);
    setShowForm(true);
    setErrors({});
    setMessage("");
    setErrorMessage("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // Save address
  const handleSubmit = async (e) => {
    e.preventDefault();

    setMessage("");
    setErrorMessage("");

    if (!validateForm()) {
      return;
    }

    try {
      setSaving(true);

      const payload = {
        full_name: formData.full_name.trim(),
        phone_number: formData.phone_number.trim(),
        address_line: formData.address_line.trim(),
        city: formData.city.trim(),
        state: formData.state.trim(),
        pincode: formData.pincode.trim(),
        is_default: formData.is_default,
      };

      if (editingId) {
        await userApi.patch(
          `auth/addresses/${editingId}/`,
          payload
        );

        setMessage("Address updated successfully!");
      } else {
        await userApi.post("auth/addresses/", payload);

        setMessage("Address added successfully!");
      }

      resetForm();
      await fetchAddresses();
    } catch (error) {
      console.error("ADDRESS SAVE ERROR:", error);

      const serverErrors = error.response?.data;

      if (serverErrors && typeof serverErrors === "object") {
        const formattedErrors = {};

        Object.keys(serverErrors).forEach((key) => {
          formattedErrors[key] = Array.isArray(serverErrors[key])
            ? serverErrors[key][0]
            : serverErrors[key];
        });

        setErrors(formattedErrors);
      }

      setErrorMessage(
        serverErrors?.detail ||
        "Unable to save address. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  // Delete address
  const handleDelete = async (id) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this address?"
    );

    if (!confirmDelete) return;

    try {
      await userApi.delete(`auth/addresses/${id}/`);

      setMessage("Address deleted successfully!");

      if (editingId === id) {
        resetForm();
      }

      await fetchAddresses();
    } catch (error) {
      console.error("ADDRESS DELETE ERROR:", error);

      setErrorMessage(
        error.response?.data?.detail ||
        "Unable to delete address."
      );
    }
  };

  // Set default address
  const handleSetDefault = async (id) => {
    try {
      await userApi.patch(`auth/addresses/${id}/`, {
        is_default: true,
      });

      setMessage("Default address updated successfully!");

      await fetchAddresses();
    } catch (error) {
      console.error("SET DEFAULT ERROR:", error);

      setErrorMessage(
        error.response?.data?.detail ||
        "Unable to update default address."
      );
    }
  };

  return (
    <>
      <Navbar />

      <div className="addresses-page">
        <div className="addresses-container">

          <div className="addresses-header">
            <div>
              <h1>My Addresses</h1>
              <p>Manage your delivery addresses</p>
            </div>

            {!showForm && (
              <button
                className="add-address-btn"
                onClick={handleAddAddress}
              >
                + Add New Address
              </button>
            )}
          </div>

          {message && (
            <div className="address-success">
              {message}
            </div>
          )}

          {errorMessage && (
            <div className="address-error">
              {errorMessage}
            </div>
          )}

          {showForm && (
            <div className="address-form-card">

              <h2>
                {editingId ? "Edit Address" : "Add New Address"}
              </h2>

              <form onSubmit={handleSubmit} noValidate>

                <div className="address-form-grid">

                  <div className="form-group">
                    <label>Full Name *</label>

                    <input
                      type="text"
                      name="full_name"
                      value={formData.full_name}
                      onChange={handleChange}
                      placeholder="Enter full name"
                      maxLength={100}
                    />

                    {errors.full_name && (
                      <small className="field-error">
                        {errors.full_name}
                      </small>
                    )}
                  </div>

                  <div className="form-group">
                    <label>Phone Number *</label>

                    <input
                      type="tel"
                      name="phone_number"
                      value={formData.phone_number}
                      onChange={handleChange}
                      placeholder="Enter phone number"
                      maxLength={15}
                    />

                    {errors.phone_number && (
                      <small className="field-error">
                        {errors.phone_number}
                      </small>
                    )}
                  </div>

                  <div className="form-group full-width">
                    <label>Address *</label>

                    <textarea
                      name="address_line"
                      value={formData.address_line}
                      onChange={handleChange}
                      placeholder="House name, street, locality"
                      rows="3"
                    />

                    {errors.address_line && (
                      <small className="field-error">
                        {errors.address_line}
                      </small>
                    )}
                  </div>

                  <div className="form-group">
                    <label>City *</label>

                    <input
                      type="text"
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                      placeholder="Enter city"
                    />

                    {errors.city && (
                      <small className="field-error">
                        {errors.city}
                      </small>
                    )}
                  </div>

                  <div className="form-group">
                    <label>State *</label>

                    <input
                      type="text"
                      name="state"
                      value={formData.state}
                      onChange={handleChange}
                      placeholder="Enter state"
                    />

                    {errors.state && (
                      <small className="field-error">
                        {errors.state}
                      </small>
                    )}
                  </div>

                  <div className="form-group">
                    <label>Pincode *</label>

                    <input
                      type="text"
                      name="pincode"
                      value={formData.pincode}
                      onChange={handleChange}
                      placeholder="6 digit pincode"
                      maxLength={6}
                    />

                    {errors.pincode && (
                      <small className="field-error">
                        {errors.pincode}
                      </small>
                    )}
                  </div>

                </div>

                <label className="default-address-checkbox">
                  <input
                    type="checkbox"
                    name="is_default"
                    checked={formData.is_default}
                    onChange={handleChange}
                  />

                  Set as default address
                </label>

                <div className="address-form-actions">

                  <button
                    type="submit"
                    className="save-address-btn"
                    disabled={saving}
                  >
                    {saving
                      ? "Saving..."
                      : editingId
                      ? "Update Address"
                      : "Save Address"}
                  </button>

                  <button
                    type="button"
                    className="cancel-address-btn"
                    onClick={resetForm}
                    disabled={saving}
                  >
                    Cancel
                  </button>

                </div>

              </form>
            </div>
          )}

          <div className="saved-addresses">

            <h2>Saved Addresses</h2>

            {loading ? (
              <p className="address-loading">
                Loading addresses...
              </p>
            ) : addresses.length === 0 ? (
              <div className="empty-address">
                <h3>No addresses found</h3>
                <p>Add your first delivery address.</p>

                {!showForm && (
                  <button
                    className="add-address-btn"
                    onClick={handleAddAddress}
                  >
                    + Add Address
                  </button>
                )}
              </div>
            ) : (
              <div className="address-list">

                {addresses.map((address) => (
                  <div
                    className="address-card"
                    key={address.id}
                  >

                    <div className="address-card-header">

                      <h3>{address.full_name}</h3>

                      {address.is_default && (
                        <span className="default-address-badge">
                          Default
                        </span>
                      )}

                    </div>

                    <p>{address.phone_number}</p>
                    <p>{address.address_line}</p>

                    <p>
                      {address.city}, {address.state} -{" "}
                      {address.pincode}
                    </p>

                    <div className="address-actions">

                      <button
                        className="edit-address-btn"
                        onClick={() => handleEdit(address)}
                      >
                        Edit
                      </button>

                      <button
                        className="delete-address-btn"
                        onClick={() => handleDelete(address.id)}
                      >
                        Delete
                      </button>

                      {!address.is_default && (
                        <button
                          className="set-default-btn"
                          onClick={() =>
                            handleSetDefault(address.id)
                          }
                        >
                          Set as Default
                        </button>
                      )}

                    </div>

                  </div>
                ))}

              </div>
            )}

          </div>

        </div>
      </div>
    </>
  );
}

export default MyAddresses;
