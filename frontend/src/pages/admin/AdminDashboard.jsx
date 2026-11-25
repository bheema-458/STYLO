
import { useEffect, useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Tags,
  Palette,
  Ruler,
  Package,
  Layers,
  ShoppingBag,
  RotateCcw,
  LogOut,
  Menu,
  X,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { adminApi } from "../../api";
import "./AdminDashboard.css";

function AdminDashboard() {
  const navigate = useNavigate();
  const location = useLocation();

  const [users, setUsers] = useState([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Admin token ഉണ്ടോ എന്ന് പരിശോധിക്കുക
  useEffect(() => {
    const adminToken = localStorage.getItem("admin_access");

    if (!adminToken) {
      navigate("/admin/login", { replace: true });
    }
  }, [navigate]);

  // Admin customer list fetch ചെയ്യുക
  const fetchUsers = async (page = 1, searchValue = search) => {
    try {
      setLoading(true);
      setError("");

      const response = await adminApi.get("auth/admin/users/", {
        params: {
          page,
          search: searchValue,
        },
      });

      const data = response.data;

      // Django REST Framework pagination response
      if (Array.isArray(data.results)) {
        setUsers(data.results);
        setTotalUsers(data.count || 0);

        const calculatedPages = Math.ceil(
          (data.count || 0) / 10
        );

        setTotalPages(Math.max(1, calculatedPages));
      } else if (Array.isArray(data)) {
        // Pagination ഇല്ലാത്ത response ആണെങ്കിൽ
        setUsers(data);
        setTotalUsers(data.length);
        setTotalPages(1);
      } else {
        setUsers([]);
        setTotalUsers(0);
        setTotalPages(1);
      }

      setCurrentPage(page);
    } catch (err) {
      console.error("ADMIN USERS FETCH ERROR:", err);

      if (
        err.response?.status === 401 ||
        err.response?.status === 403
      ) {
        localStorage.removeItem("admin_access");
        localStorage.removeItem("admin_refresh");

        window.dispatchEvent(new Event("authChanged"));

        navigate("/admin/login", { replace: true });
        return;
      }

      setError(
        err.response?.data?.detail ||
        "Unable to load customers. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers(1, "");
  }, []);

  // Search
  const handleSearch = (e) => {
    e.preventDefault();
    fetchUsers(1, search);
  };

  // Search clear
  const handleClearSearch = () => {
    setSearch("");
    fetchUsers(1, "");
  };

  // Block / Unblock customer
  const handleToggleStatus = async (user) => {
    const action = user.is_blocked ? "unblock" : "block";

    const confirmed = window.confirm(
      `Are you sure you want to ${action} this customer?`
    );

    if (!confirmed) return;

    try {
      await adminApi.patch(
        `auth/admin/users/${user.id}/status/`,
        {
          is_blocked: !user.is_blocked,
        }
      );

      // Update the customer list after successful request
      await fetchUsers(currentPage, search);
    } catch (err) {
      console.error("CUSTOMER STATUS UPDATE ERROR:", err);

      if (
        err.response?.status === 401 ||
        err.response?.status === 403
      ) {
        localStorage.removeItem("admin_access");
        localStorage.removeItem("admin_refresh");

        window.dispatchEvent(new Event("authChanged"));

        navigate("/admin/login", { replace: true });
        return;
      }

      alert(
        err.response?.data?.detail ||
        "Unable to update customer status."
      );
    }
  };

  // Pagination
  const handlePrevious = () => {
    if (currentPage > 1) {
      fetchUsers(currentPage - 1, search);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      fetchUsers(currentPage + 1, search);
    }
  };

  // Admin logout
  const handleLogout = () => {
    const confirmed = window.confirm(
      "Are you sure you want to logout?"
    );

    if (!confirmed) return;

    // Remove only admin tokens
    localStorage.removeItem("admin_access");
    localStorage.removeItem("admin_refresh");

    window.dispatchEvent(new Event("authChanged"));

    navigate("/admin/login", { replace: true });
  };

  const navigationItems = [
    {
      name: "Dashboard",
      path: "/admin/dashboard",
      icon: LayoutDashboard,
    },
    {
      name: "Customers",
      path: "/admin/customers",
      icon: Users,
    },
    {
      name: "Categories",
      path: "/admin/categories",
      icon: Tags,
    },
    {
      name: "Colors",
      path: "/admin/colors",
      icon: Palette,
    },
    {
      name: "Sizes",
      path: "/admin/sizes",
      icon: Ruler,
    },
    {
      name: "Product Management",
      path: "/admin/products",
      icon: Package,
    },
    {
      name: "Product Variants",
      path: "/admin/product-variants",
      icon: Layers,
    },
    {
      name: "Order Management",
      path: "/admin/orders",
      icon: ShoppingBag,
    },
    {
      name: "Return Requests",
      path: "/admin/returns",
      icon: RotateCcw,
    },
  ];

  return (
    <div className="admin-dashboard">

      {/* Mobile menu button */}
      <button
        className="admin-mobile-menu"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        type="button"
      >
        {sidebarOpen ? <X /> : <Menu />}
      </button>

      {/* Sidebar */}
      <aside
        className={`admin-sidebar ${
          sidebarOpen ? "sidebar-open" : ""
        }`}
      >
        <div className="admin-logo">
          <h2>STYLO</h2>
          <span>ADMIN PANEL</span>
        </div>

        <nav className="admin-navigation">
          {navigationItems.map((item) => {
            const Icon = item.icon;

            const isActive =
              location.pathname === item.path;

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`admin-nav-link ${
                  isActive ? "active" : ""
                }`}
                onClick={() => setSidebarOpen(false)}
              >
                <Icon size={19} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <button
          className="admin-logout-button"
          onClick={handleLogout}
          type="button"
        >
          <LogOut size={19} />
          <span>Logout</span>
        </button>
      </aside>

      {/* Main content */}
      <main className="admin-main-content">

        <header className="admin-topbar">
          <div>
            <h2>Admin Dashboard</h2>
            <p>Welcome back to STYLO administration</p>
          </div>

          <div className="admin-profile">
            <span className="admin-profile-icon">
              A
            </span>
            <span>Administrator</span>
          </div>
        </header>

        {/* Dashboard overview */}
        <section className="admin-dashboard-content">

          <div className="admin-welcome-section">
            <div>
              <h2>Dashboard Overview</h2>
              <p>
                Manage your customers and store activities.
              </p>
            </div>
          </div>

          {/* Statistics */}
          <div className="admin-stats-container">

            <div className="admin-stat-card">
              <div className="admin-stat-icon">
                <Users size={24} />
              </div>

              <div>
                <p>Total Customers</p>
                <h2>{totalUsers}</h2>
              </div>
            </div>

            <div className="admin-stat-card">
              <div className="admin-stat-icon">
                <Package size={24} />
              </div>

              <div>
                <p>Current Page</p>
                <h2>{currentPage}</h2>
              </div>
            </div>

            <div className="admin-stat-card">
              <div className="admin-stat-icon">
                <Layers size={24} />
              </div>

              <div>
                <p>Total Pages</p>
                <h2>{totalPages}</h2>
              </div>
            </div>

          </div>

          {/* Customer management */}
          <section className="admin-customers-section">

            <div className="admin-section-header">
              <div>
                <h2>Customer Management</h2>
                <p>
                  View, search, and manage registered customers.
                </p>
              </div>

              <span className="admin-customer-count">
                {totalUsers} Customers
              </span>
            </div>

            {/* Search */}
            <form
              className="admin-search-form"
              onSubmit={handleSearch}
            >
              <div className="admin-search-box">
                <Search size={18} />

                <input
                  type="text"
                  placeholder="Search by name, email or phone..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <button type="submit">
                Search
              </button>

              <button
                type="button"
                className="admin-clear-button"
                onClick={handleClearSearch}
              >
                Clear
              </button>
            </form>

            {/* Error */}
            {error && (
              <div className="admin-error-message">
                {error}
              </div>
            )}

            {/* Customer table */}
            <div className="admin-table-container">

              {loading ? (
                <div className="admin-loading">
                  Loading customers...
                </div>
              ) : users.length === 0 ? (
                <div className="admin-empty-state">
                  No customers found.
                </div>
              ) : (
                <table className="admin-customers-table">

                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Status</th>
                      <th>Joined Date</th>
                      <th>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id}>

                        <td>
                          <div className="admin-customer-info">
                            {user.profile_image ? (
                              <img
                                src={user.profile_image}
                                alt={user.username || "Customer"}
                                className="admin-customer-image"
                              />
                            ) : (
                              <div className="admin-customer-avatar">
                                {(user.username || user.email || "U")
                                  .charAt(0)
                                  .toUpperCase()}
                              </div>
                            )}

                            <span>
                              {user.username ||
                                user.first_name ||
                                "Customer"}
                            </span>
                          </div>
                        </td>

                        <td>{user.email || "-"}</td>

                        <td>{user.phone_number || "-"}</td>

                        <td>
                          <span
                            className={`admin-status-badge ${
                              user.is_blocked
                                ? "blocked"
                                : "active"
                            }`}
                          >
                            {user.is_blocked
                              ? "Blocked"
                              : "Active"}
                          </span>
                        </td>

                        <td>
                          {user.created_at
                            ? new Date(
                                user.created_at
                              ).toLocaleDateString()
                            : "-"}
                        </td>

                        <td>
                          <button
                            type="button"
                            className={`admin-status-button ${
                              user.is_blocked
                                ? "unblock-button"
                                : "block-button"
                            }`}
                            onClick={() =>
                              handleToggleStatus(user)
                            }
                          >
                            {user.is_blocked
                              ? "Unblock"
                              : "Block"}
                          </button>
                        </td>

                      </tr>
                    ))}
                  </tbody>

                </table>
              )}

            </div>

            {/* Pagination */}
            {!loading && users.length > 0 && (
              <div className="admin-pagination">

                <button
                  type="button"
                  onClick={handlePrevious}
                  disabled={currentPage <= 1}
                >
                  <ChevronLeft size={18} />
                  Previous
                </button>

                <span>
                  Page {currentPage} of {totalPages}
                </span>

                <button
                  type="button"
                  onClick={handleNext}
                  disabled={currentPage >= totalPages}
                >
                  Next
                  <ChevronRight size={18} />
                </button>

              </div>
            )}

          </section>
        </section>
      </main>
    </div>
  );
}

export default AdminDashboard;
