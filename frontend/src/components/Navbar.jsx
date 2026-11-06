
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api";
import "./Navbar.css";

function Navbar() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("access");

    if (!token) {
      setUser(null);
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
      } catch (error) {
        console.error("PROFILE ERROR:", error.response?.data || error.message);
        setUser(null);
      }
    };

    fetchProfile();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    setUser(null);
    setMenuOpen(false);
    navigate("/login");
  };

  const profileName = user?.first_name || user?.username || "My Account";
  const profileImage = user?.profile_image_url || user?.profile_image;

  return (
    <header className="navbar">
      <Link to="/" className="navbar-logo">
        STYLO<span>.</span>
      </Link>

      <nav className="navbar-links">
        <Link to="/">Home</Link>
        <a href="/#categories">Categories</a>
        <a href="/#smart-outfit">Smart Outfit</a>
      </nav>

      <div className="navbar-actions">
        <button className="icon-button" aria-label="Search">
          ⌕
        </button>

        <Link to="/wishlist" className="icon-button" aria-label="Wishlist">
          ♡
        </Link>

        <Link to="/cart" className="icon-button" aria-label="Shopping Cart">
          🛍
        </Link>

        {user ? (
          <div className="profile-menu">
            <button
              className="profile-trigger"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {profileImage ? (
                <img src={profileImage} alt="Profile" className="profile-avatar" />
              ) : (
                <span className="profile-avatar profile-initial">
                  {profileName.charAt(0).toUpperCase()}
                </span>
              )}

              <span className="profile-name">{profileName}</span>
              <span>⌄</span>
            </button>

            {menuOpen && (
              <div className="profile-dropdown">
                <p className="dropdown-heading">My Account</p>
                <Link to="/profile" onClick={() => setMenuOpen(false)}>
                  My Profile
                </Link>
                <Link to="/orders" onClick={() => setMenuOpen(false)}>
                  My Orders
                </Link>
                <Link to="/addresses" onClick={() => setMenuOpen(false)}>
                  My Addresses
                </Link>
                <button onClick={handleLogout}>Logout</button>
              </div>
            )}
          </div>
        ) : (
          <>
            <Link to="/login" className="navbar-login">
              Login
            </Link>
            <Link to="/register" className="navbar-register">
              Sign Up
            </Link>
          </>
        )}
      </div>
    </header>
  );
}

export default Navbar;
