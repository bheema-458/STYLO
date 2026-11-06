
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import Navbar from "../components/Navbar";
import "./MyAddresses.css";

function MyAddresses() {
  const navigate = useNavigate();
  const token = localStorage.getItem("access");

  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState(null);

  const initialForm = {
    full_name: "",
    phone_number: "",
    address_line: "",
    city: "",
    state: "",
    pincode: "",
    is_default: false,
  };

  const [form, setForm] = useState(initialForm);

  // Fetch saved addresses
  const fetchAddresses = useCallback(async () => {
    try {
      const response = await api.get("auth/addresses/", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setAddresses(
        Array.isArray(response.data)
          ? response.data
          : response.data.results || []
      );
    } catch (error) {
      console.error(
        "ADDRESS ERROR:",
        error.response?.data || error.message
      );
      setMessage("Unable to load addresses.");
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      navigate("/login");
      return;
    }

    const loadAddresses = async () => {
      await fetchAddresses();
      setLoading(false);
    };

    loadAddresses();
  }, [token, navigate, fetchAddresses]);

  // Input changes
  const handleChange = (e) => {
    const { name, value, checked, type } = e.target;

    setForm((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  // Reset form
  const resetForm = () => {
    setForm(initialForm);
    setEditingId(null);
  };

  // Add or Update address
  const handleSubmit = async (e) => {
    e.preventDefault();

    setSaving(true);
    setMessage("");

    try {
      if (editingId) {
        await api.patch(
          `auth/addresses/${editingId}/`,
          form,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        setMessage("Address updated successfully!");
      } else {
        await api.post("auth/addresses/", form, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        setMessage("Address added successfully!");
      }

      resetForm();
      await fetchAddresses();
    } catch (error) {
      console.error(
        "ADDRESS SAVE ERROR:",
        error.response?.data || error.message
      );

      setMessage(
        JSON.stringify(
          error.response?.data || "Unable to save address."
        )
      );
    } finally {
      setSaving(false);
    }
  };

  // Edit address
  const handleEdit = (address) => {
    setEditingId(address.id);

    setForm({
      full_name: address.full_name || "",
      phone_number: address.phone_number || "",
      address_line: address.address_line || "",
      city: address.city || "",
      state: address.state || "",
      pincode: address.pincode || "",
      is_default: address.is_default || false,
    });

    setMessage("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // Delete address
  const handleDelete = async (id) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this address?"
    );

    if (!confirmed) return;

    try {
      await api.delete(`auth/addresses/${id}/`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (editingId === id) {
        resetForm();
      }

      setMessage("Address deleted successfully!");
      await fetchAddresses();
    } catch (error) {
      console.error(
        "ADDRESS DELETE ERROR:",
        error.response?.data || error.message
      );

      setMessage("Unable to delete address.");
    }
  };

  // Set default address
  const handleSetDefault = async (id) => {
    try {
      await api.patch(
        `auth/addresses/${id}/`,
        { is_default: true },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setMessage("Default address updated successfully!");
      await fetchAddresses();
    } catch (error) {
      console.error(
        "DEFAULT ADDRESS ERROR:",
        error.response?.data || error.message
      );

      setMessage("Unable to set default address.");
    }
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <p>Loading addresses...</p>
      </>
    );
  }

  return (
    <>
      <Navbar />

      <main className="addresses-page">

        <div className="addresses-header">
          <p>MY ACCOUNT</p>
          <h1>My Addresses</h1>
          <span>
            Manage your saved delivery addresses.
          </span>
        </div>

        <div className="addresses-layout">

          {/* Address Form */}
          <section className="address-form-card">

            <h2>
              {editingId ? "Edit Address" : "Add New Address"}
            </h2>

            <form onSubmit={handleSubmit}>

              <label>Full Name</label>
              <input
                name="full_name"
                value={form.full_name}
                onChange={handleChange}
                placeholder="Enter full name"
                required
              />

              <label>Phone Number</label>
              <input
                name="phone_number"
                value={form.phone_number}
                onChange={handleChange}
                placeholder="Enter phone number"
                maxLength={15}
                required
              />

              <label>Address</label>
              <textarea
                name="address_line"
                value={form.address_line}
                onChange={handleChange}
                placeholder="Enter your full address"
                required
              />

              <label>City</label>
              <input
                name="city"
                value={form.city}
                onChange={handleChange}
                placeholder="Enter city"
                required
              />

              <label>State</label>
              <input
                name="state"
                value={form.state}
                onChange={handleChange}
                placeholder="Enter state"
                required
              />

              <label>PIN Code</label>
              <input
                name="pincode"
                value={form.pincode}
                onChange={handleChange}
                placeholder="6 digit PIN code"
                maxLength={6}
                required
              />

              <label className="default-address-label">
                <input
                  type="checkbox"
                  name="is_default"
                  checked={form.is_default}
                  onChange={handleChange}
                />
                Set as default address
              </label>

              <button type="submit" disabled={saving}>
                {saving
                  ? "Saving..."
                  : editingId
                  ? "Update Address"
                  : "Save Address"}
              </button>

              {editingId && (
                <button
                  type="button"
                  className="cancel-edit-btn"
                  onClick={resetForm}
                >
                  Cancel Edit
                </button>
              )}

            </form>
          </section>

          {/* Saved Addresses */}
          <section className="saved-addresses">

            <h2>Saved Addresses</h2>

            {addresses.length === 0 ? (
              <p>No saved addresses yet.</p>
            ) : (
              addresses.map((address) => (
                <article
                  className="address-card"
                  key={address.id}
                >

                  <h3>{address.full_name}</h3>

                  <p>{address.phone_number}</p>

                  <p>{address.address_line}</p>

                  <p>
                    {address.city}, {address.state} - {address.pincode}
                  </p>

                  {address.is_default && (
                    <span className="default-badge">
                      Default Address
                    </span>
                  )}

                  <div className="address-card-actions">

                    <button
                      type="button"
                      className="edit-address-btn"
                      onClick={() => handleEdit(address)}
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      className="delete-address-btn"
                      onClick={() => handleDelete(address.id)}
                    >
                      Delete
                    </button>

                    {!address.is_default && (
                      <button
                        type="button"
                        className="set-default-btn"
                        onClick={() => handleSetDefault(address.id)}
                      >
                        Set as Default
                      </button>
                    )}

                  </div>

                </article>
              ))
            )}

          </section>
        </div>

        {message && (
          <p className="address-message">
            {message}
          </p>
        )}

      </main>
    </>
  );
}

export default MyAddresses;
