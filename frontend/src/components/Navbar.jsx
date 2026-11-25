
import { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  Search,
  Heart,
  ShoppingBag,
  Menu,
  X,
  User,
  Package,
  MapPin,
  LogOut,
  ChevronDown,
} from "lucide-react";

import api from "../api";
import "./Navbar.css";

function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // FETCH CUSTOMER PROFILE
  useEffect(() => {
    let isMounted = true;

    const fetchProfile = async () => {
      const token = localStorage.getItem("user_access");

      if (!token) {
        if (isMounted) {
          setUser(null);
          setLoading(false);
        }
        return;
      }

      try {
        const response = await api.get("auth/profile/");

        if (isMounted) {
          setUser(response.data);
        }
      } catch (error) {
        console.error(
          "NAVBAR PROFILE ERROR:",
          error.response?.data || error.message
        );

        if (isMounted) {
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    setLoading(true);
    fetchProfile();

    window.addEventListener("authChanged", fetchProfile);
    window.addEventListener("profileUpdated", fetchProfile);

    return () => {
      isMounted = false;
      window.removeEventListener("authChanged", fetchProfile);
      window.removeEventListener("profileUpdated", fetchProfile);
    };
  }, [location.pathname]);

  // CLOSE MENUS WHEN ROUTE CHANGES
  useEffect(() => {
    setMenuOpen(false);
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // LOGOUT
  const handleLogout = () => {
    localStorage.removeItem("user_access");
    localStorage.removeItem("user_refresh");

    setUser(null);
    setMenuOpen(false);
    setMobileMenuOpen(false);

    window.dispatchEvent(new Event("authChanged"));
    navigate("/login", { replace: true });
  };

  // PROFILE DETAILS
  const profileName =
    user?.first_name?.trim() ||
    user?.username ||
    "My Account";

  const imageValue =
    user?.profile_image_url ||
    user?.profile_image;

  const profileImage = imageValue
    ? imageValue.startsWith("http")
      ? imageValue
      : new URL(
          imageValue,
          new URL(api.defaults.baseURL).origin
        ).toString()
    : null;

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  return (
    <header className="navbar">

      {/* LOGO */}
      <Link
        to="/"
        className="navbar-logo"
        onClick={closeMobileMenu}
      >
        STYLO<span>.</span>
      </Link>

      {/* NAVIGATION LINKS */}
      <nav
        className={`navbar-links ${
          mobileMenuOpen ? "mobile-open" : ""
        }`}
      >
        <Link to="/" onClick={closeMobileMenu}>
          Home
        </Link>

        <a href="/#categories" onClick={closeMobileMenu}>
          Categories
        </a>

        <a href="/#smart-outfit" onClick={closeMobileMenu}>
          Smart Outfit
        </a>

        {/* MOBILE ACCOUNT LINKS */}
        <div className="mobile-extra-links">
          {user ? (
            <>
              <Link to="/profile" onClick={closeMobileMenu}>
                <User size={17} />
                My Profile
              </Link>

              <Link to="/orders" onClick={closeMobileMenu}>
                <Package size={17} />
                My Orders
              </Link>

              <Link to="/addresses" onClick={closeMobileMenu}>
                <MapPin size={17} />
                My Addresses
              </Link>

              <button type="button" onClick={handleLogout}>
                <LogOut size={17} />
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" onClick={closeMobileMenu}>
                Login
              </Link>

              <Link to="/register" onClick={closeMobileMenu}>
                Sign Up
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* RIGHT SIDE ACTIONS */}
      <div className="navbar-actions">

        {/* SEARCH */}
        <button
          type="button"
          className="icon-button search-button"
          aria-label="Search products"
          onClick={() => navigate("/products")}
        >
          <Search size={21} />
        </button>

        {/* WISHLIST */}
        <Link
          to="/wishlist"
          className="icon-button"
          aria-label="Wishlist"
        >
          <Heart size={21} />
        </Link>

        {/* CART */}
        <Link
          to="/cart"
          className="icon-button"
          aria-label="Shopping Cart"
        >
          <ShoppingBag size={21} />
        </Link>

        {/* CUSTOMER PROFILE */}
        {loading ? null : user ? (
          <div className="profile-menu">

            <button
              className="profile-trigger"
              type="button"
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-expanded={menuOpen}
            >
              {profileImage ? (
                <img
                  src={profileImage}
                  alt="Profile"
                  className="profile-avatar"
                  onError={(event) => {
                    event.currentTarget.style.display = "none";
                  }}
                />
              ) : (
                <span className="profile-avatar profile-initial">
                  {profileName.charAt(0).toUpperCase()}
                </span>
              )}

              <span className="profile-name">
                Hi, {profileName}
              </span>

              <ChevronDown
                size={16}
                className="profile-arrow"
              />
            </button>

            {menuOpen && (
              <div className="profile-dropdown">

                <div className="dropdown-user">
                  <p className="dropdown-heading">
                    My Account
                  </p>

                  <span>{user.email}</span>
                </div>

                <Link
                  to="/profile"
                  onClick={() => setMenuOpen(false)}
                >
                  <User size={16} />
                  My Profile
                </Link>

                <Link
                  to="/orders"
                  onClick={() => setMenuOpen(false)}
                >
                  <Package size={16} />
                  My Orders
                </Link>

                <Link
                  to="/addresses"
                  onClick={() => setMenuOpen(false)}
                >
                  <MapPin size={16} />
                  My Addresses
                </Link>

                <button
                  type="button"
                  className="logout-button"
                  onClick={handleLogout}
                >
                  <LogOut size={16} />
                  Logout
                </button>

              </div>
            )}
          </div>
        ) : (
          <div className="navbar-auth-links">
            <Link to="/login" className="navbar-login">
              Login
            </Link>

            <Link to="/register" className="navbar-register">
              Sign Up
            </Link>
          </div>
        )}

        {/* MOBILE MENU BUTTON */}
        <button
          className="mobile-menu-button"
          type="button"
          aria-label="Toggle navigation menu"
          aria-expanded={mobileMenuOpen}
          onClick={() => setMobileMenuOpen((prev) => !prev)}
        >
          {mobileMenuOpen ? (
            <X size={23} />
          ) : (
            <Menu size={23} />
          )}
        </button>

      </div>
    </header>
  );
}

export default Navbar;
