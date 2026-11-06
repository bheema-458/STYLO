
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import Navbar from "../components/Navbar";
import "./MyProfile.css";

function MyProfile() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    phone_number: "",
  });

  const token = localStorage.getItem("access");

  // Fetch user profile
  useEffect(() => {
    if (!token) {
      navigate("/login");
      return;
    }

    const fetchProfile = async () => {
      try {
        const response = await api.get("auth/profile/", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        setUser(response.data);

        setForm({
          first_name: response.data.first_name || "",
          last_name: response.data.last_name || "",
          phone_number: response.data.phone_number || "",
        });
      } catch (error) {
        console.error(
          "PROFILE ERROR:",
          error.response?.data || error.message
        );

        setMessage("Unable to load profile.");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [navigate, token]);

  // Handle input changes
  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  // Update profile
  const handleSave = async (e) => {
    e.preventDefault();

    setSaving(true);
    setMessage("");

    try {
      const response = await api.patch(
        "auth/profile/update/",
        form,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setUser({
        ...user,
        ...response.data,
      });

      setMessage("Profile updated successfully!");
    } catch (error) {
      console.error(
        "PROFILE UPDATE ERROR:",
        error.response?.data || error.message
      );

      setMessage(
        error.response?.data?.detail ||
        "Profile update failed."
      );
    } finally {
      setSaving(false);
    }
  };

  // Handle image upload
  const handleImageUpload = async () => {
    if (!selectedImage) {
      setMessage("Please select an image first.");
      return;
    }

    setUploading(true);
    setMessage("");

    const formData = new FormData();
    formData.append("profile_image", selectedImage);

    try {
      const response = await api.post(
        "auth/profile/image/",
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setUser({
        ...user,
        profile_image: response.data.profile_image,
      });

      setSelectedImage(null);
      setMessage("Profile photo updated successfully!");
    } catch (error) {
      console.error(
        "IMAGE UPLOAD ERROR:",
        error.response?.data || error.message
      );

      const errorData = error.response?.data;

      setMessage(
        errorData
          ? JSON.stringify(errorData)
          : error.message
      );
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return <p className="profile-loading">Loading profile...</p>;
  }

  return (
    <>
      <Navbar />

      <main className="profile-page">

        <div className="profile-header">
          <p>MY ACCOUNT</p>
          <h1>My Profile</h1>
          <span>
            Manage your personal information and profile photo.
          </span>
        </div>

        <section className="profile-card">

          {/* Profile Photo Section */}
          <div className="profile-photo-section">

            {user?.profile_image ? (
              <img
                src={user.profile_image}
                alt="Profile"
                className="profile-photo"
              />
            ) : (
              <div className="profile-photo-placeholder">
                {user?.username?.charAt(0)?.toUpperCase() || "U"}
              </div>
            )}

            <h3>Your Profile Photo</h3>

            <p>
              Upload a photo to personalise your STYLO account.
            </p>

            <input
              type="file"
              accept="image/*"
              onChange={(e) =>
                setSelectedImage(e.target.files[0] || null)
              }
            />

            {selectedImage && (
              <p className="selected-image-name">
                Selected: {selectedImage.name}
              </p>
            )}

            <button
              type="button"
              onClick={handleImageUpload}
              disabled={uploading}
            >
              {uploading ? "Uploading..." : "Upload Photo"}
            </button>

          </div>

          {/* Profile Form */}
          <form onSubmit={handleSave}>

            <label>Username</label>
            <input
              type="text"
              value={user?.username || ""}
              disabled
            />

            <label>Email Address</label>
            <input
              type="email"
              value={user?.email || ""}
              disabled
            />

            <label>First Name</label>
            <input
              type="text"
              name="first_name"
              value={form.first_name}
              onChange={handleChange}
              placeholder="Enter your first name"
            />

            <label>Last Name</label>
            <input
              type="text"
              name="last_name"
              value={form.last_name}
              onChange={handleChange}
              placeholder="Enter your last name"
            />

            <label>Phone Number</label>
            <input
              type="tel"
              name="phone_number"
              value={form.phone_number}
              onChange={handleChange}
              placeholder="Enter your phone number"
            />

            <button
              type="submit"
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>

          </form>

          {message && (
            <p className="profile-message">
              {message}
            </p>
          )}

        </section>
      </main>
    </>
  );
}

export default MyProfile;
