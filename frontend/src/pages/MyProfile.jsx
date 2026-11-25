
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { userApi } from "../api";
import Navbar from "../components/Navbar";
import "./MyProfile.css";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

function MyProfile() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const previewRef = useRef(null);

  const [user, setUser] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);

  const [selectedImage, setSelectedImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    phone_number: "",
  });

  const showMessage = (text, type = "success") => {
    setMessage(text);
    setMessageType(type);
  };

  // FETCH CUSTOMER PROFILE
  useEffect(() => {
    const token = localStorage.getItem("user_access");

    if (!token) {
      setLoading(false);
      navigate("/login", { replace: true });
      return;
    }

    const fetchProfile = async () => {
      try {
        const response = await userApi.get("auth/profile/");

        setUser(response.data);

        setForm({
          first_name: response.data.first_name || "",
          last_name: response.data.last_name || "",
          phone_number: response.data.phone_number || "",
        });
      } catch (error) {
        console.error(
          "PROFILE FETCH ERROR:",
          error.response?.data || error.message
        );

        showMessage("Unable to load profile.", "error");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [navigate]);

  // CLEANUP PREVIEW URL
  useEffect(() => {
    return () => {
      if (previewRef.current) {
        URL.revokeObjectURL(previewRef.current);
      }
    };
  }, []);

  // INPUT CHANGE
  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // SAVE PROFILE
  const handleSave = async (e) => {
    e.preventDefault();

    const phone = form.phone_number.trim();

    if (phone && !/^\+?[0-9]{10,15}$/.test(phone.replace(/[\s-]/g, ""))) {
      showMessage(
        "Enter a valid phone number with 10 to 15 digits.",
        "error"
      );
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const response = await userApi.patch(
        "auth/profile/update/",
        {
          ...form,
          phone_number: phone,
        }
      );

      setUser((prev) => ({
        ...prev,
        ...response.data,
      }));

      window.dispatchEvent(new Event("profileUpdated"));

      showMessage(
        "Your profile details have been updated successfully!",
        "success"
      );
    } catch (error) {
      console.error(
        "PROFILE UPDATE ERROR:",
        error.response?.data || error.message
      );

      const errorData = error.response?.data;

      const errorMessage =
        typeof errorData === "object" && errorData !== null
          ? Object.values(errorData).flat().join(" ")
          : errorData || "Profile update failed.";

      showMessage(errorMessage, "error");
    } finally {
      setSaving(false);
    }
  };

  // SELECT IMAGE
  const handleImageChange = (e) => {
    const file = e.target.files?.[0];

    setMessage("");

    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      showMessage(
        "Invalid image format. Please select JPG, PNG or WEBP.",
        "error"
      );

      e.target.value = "";
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      showMessage(
        "Image size must not exceed 5 MB.",
        "error"
      );

      e.target.value = "";
      return;
    }

    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current);
    }

    const newPreview = URL.createObjectURL(file);

    previewRef.current = newPreview;

    setSelectedImage(file);
    setPreviewUrl(newPreview);

    showMessage(
      "Image selected successfully. Click Upload Photo to continue.",
      "success"
    );
  };

  // OPEN FILE SELECTOR
  const handleChoosePhoto = () => {
    fileInputRef.current?.click();
  };

  // UPLOAD PHOTO
  const handleImageUpload = async () => {
    if (!selectedImage) {
      showMessage("Please choose a photo first.", "error");
      return;
    }

    setUploading(true);
    setMessage("");

    const formData = new FormData();
    formData.append("profile_image", selectedImage);

    try {
      const response = await userApi.post(
        "auth/profile/image/",
        formData
      );

      setUser((prev) => ({
        ...prev,
        profile_image: response.data.profile_image,
      }));

      setSelectedImage(null);
      setPreviewUrl("");

      if (previewRef.current) {
        URL.revokeObjectURL(previewRef.current);
        previewRef.current = null;
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      window.dispatchEvent(new Event("profileUpdated"));

      showMessage(
        "Your profile photo has been uploaded successfully!",
        "success"
      );
    } catch (error) {
      console.error(
        "IMAGE UPLOAD ERROR:",
        error.response?.data || error.message
      );

      const data = error.response?.data;

      const errorMessage =
        data?.profile_image?.[0] ||
        data?.detail ||
        data?.message ||
        "Photo upload failed. Please try again.";

      showMessage(errorMessage, "error");
    } finally {
      setUploading(false);
    }
  };

  // REMOVE PHOTO
  const handleRemoveImage = async () => {
    if (!user?.profile_image) {
      showMessage("No profile photo available.", "error");
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to remove your profile photo?"
    );

    if (!confirmed) return;

    setRemoving(true);
    setMessage("");

    try {
      await userApi.delete("auth/profile/image/");

      setUser((prev) => ({
        ...prev,
        profile_image: null,
      }));

      setSelectedImage(null);
      setPreviewUrl("");

      if (previewRef.current) {
        URL.revokeObjectURL(previewRef.current);
        previewRef.current = null;
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      window.dispatchEvent(new Event("profileUpdated"));

      showMessage(
        "Your profile photo has been removed successfully.",
        "success"
      );
    } catch (error) {
      console.error(
        "IMAGE REMOVE ERROR:",
        error.response?.data || error.message
      );

      showMessage(
        error.response?.data?.detail ||
          "Unable to remove profile photo.",
        "error"
      );
    } finally {
      setRemoving(false);
    }
  };

  // LOADING
  if (loading) {
    return (
      <>
        <Navbar />

        <div className="profile-loading">
          <div className="profile-spinner"></div>
          <p>Loading your profile...</p>
        </div>
      </>
    );
  }

  // ERROR
  if (!user) {
    return (
      <>
        <Navbar />

        <div className="profile-error">
          <h2>Unable to load profile</h2>
          <p>{message || "Please try again later."}</p>

          <button onClick={() => window.location.reload()}>
            Try Again
          </button>
        </div>
      </>
    );
  }

  const currentImage = previewUrl || user.profile_image;

  const profileInitial =
    user.first_name?.charAt(0)?.toUpperCase() ||
    user.username?.charAt(0)?.toUpperCase() ||
    "U";

  return (
    <>
      <Navbar />

      <main className="profile-page">
        <div className="profile-header">
          <p className="profile-eyebrow">MY ACCOUNT</p>

          <h1>My Profile</h1>

          <span>
            Manage your personal information and profile photo.
          </span>
        </div>

        <section className="profile-card">
          <div className="profile-photo-section">
            <div className="profile-photo-wrapper">
              {currentImage ? (
                <img
                  src={currentImage}
                  alt="Profile"
                  className="profile-photo"
                />
              ) : (
                <div className="profile-photo-placeholder">
                  {profileInitial}
                </div>
              )}

              <span className="profile-photo-status">
                <span></span>
                Account Photo
              </span>
            </div>

            <div className="profile-photo-content">
              <h3>Your Profile Photo</h3>

              <p>
                Add a personal touch to your STYLO account
                with your favourite photo.
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleImageChange}
                className="profile-file-input"
                disabled={uploading || removing}
              />

              <button
                type="button"
                className="choose-photo-button"
                onClick={handleChoosePhoto}
                disabled={uploading || removing}
              >
                Choose Photo
              </button>

              {selectedImage && (
                <div className="selected-image-info">
                  <span className="selected-file-icon">✓</span>

                  <div>
                    <strong>{selectedImage.name}</strong>

                    <small>
                      {(selectedImage.size / (1024 * 1024)).toFixed(2)}
                      {" "}MB
                    </small>
                  </div>
                </div>
              )}

              <button
                type="button"
                className="upload-photo-button"
                onClick={handleImageUpload}
                disabled={!selectedImage || uploading || removing}
              >
                {uploading ? "Uploading..." : "Upload Photo"}
              </button>

              {user.profile_image && (
                <button
                  type="button"
                  className="remove-photo-button"
                  onClick={handleRemoveImage}
                  disabled={removing || uploading}
                >
                  {removing ? "Removing..." : "Remove Photo"}
                </button>
              )}

              <div className="photo-guidelines">
                <p>Supported formats: JPG, PNG, WEBP</p>
                <p>Maximum image size: 5 MB</p>
              </div>
            </div>
          </div>

          <div className="profile-details-section">
            <div className="profile-details-heading">
              <div>
                <p>PERSONAL INFORMATION</p>
                <h2>Account Details</h2>
              </div>
            </div>

            <form className="profile-form" onSubmit={handleSave}>
              <div className="profile-form-group">
                <label htmlFor="username">Username</label>

                <input
                  id="username"
                  type="text"
                  value={user.username || ""}
                  disabled
                />

                <small>Username cannot be changed.</small>
              </div>

              <div className="profile-form-group">
                <label htmlFor="email">Email Address</label>

                <input
                  id="email"
                  type="email"
                  value={user.email || ""}
                  disabled
                />

                <small>Your registered email address.</small>
              </div>

              <div className="profile-form-group">
                <label htmlFor="first_name">First Name</label>

                <input
                  id="first_name"
                  type="text"
                  name="first_name"
                  value={form.first_name}
                  onChange={handleChange}
                  placeholder="Enter your first name"
                  maxLength={150}
                />
              </div>

              <div className="profile-form-group">
                <label htmlFor="last_name">Last Name</label>

                <input
                  id="last_name"
                  type="text"
                  name="last_name"
                  value={form.last_name}
                  onChange={handleChange}
                  placeholder="Enter your last name"
                  maxLength={150}
                />
              </div>

              <div className="profile-form-group">
                <label htmlFor="phone_number">Phone Number</label>

                <input
                  id="phone_number"
                  type="tel"
                  name="phone_number"
                  value={form.phone_number}
                  onChange={handleChange}
                  placeholder="Enter your phone number"
                  maxLength={15}
                />
              </div>

              <button
                type="submit"
                className="save-profile-button"
                disabled={saving}
              >
                {saving ? "Saving Changes..." : "Save Changes"}
              </button>
            </form>
          </div>

          {message && (
            <div
              className={`profile-message ${messageType}`}
              role="status"
              aria-live="polite"
            >
              <span>
                {messageType === "success" ? "✓" : "!"}
              </span>

              {message}
            </div>
          )}
        </section>

        <div className="profile-footer-note">
          <span>STYLO</span>

          <p>
            Your style, your identity. Keep your account information up to date.
          </p>
        </div>
      </main>
    </>
  );
}

export default MyProfile;
