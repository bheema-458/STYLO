
import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
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
  Check,
  XCircle,
  RefreshCw,
} from "lucide-react";

import { adminApi } from "../../api";
import "./AdminReturns.css";

const RETURN_STATUSES = [
  "requested",
  "approved",
  "rejected",
  "completed",
];

function AdminReturns() {
  const navigate = useNavigate();
  const location = useLocation();

  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalReturns, setTotalReturns] = useState(0);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    if (!localStorage.getItem("admin_access")) {
      navigate("/admin/login", { replace: true });
    }
  }, [navigate]);

  const handleUnauthorized = useCallback(() => {
    localStorage.removeItem("admin_access");
    localStorage.removeItem("admin_refresh");
    window.dispatchEvent(new Event("authChanged"));
    navigate("/admin/login", { replace: true });
  }, [navigate]);

  const fetchReturns = useCallback(
    async (page = 1, selectedStatus = statusFilter) => {
      try {
        setLoading(true);
        setError("");
        setSuccess("");

        const params = { page };

        if (selectedStatus !== "all") {
          params.status = selectedStatus;
        }

        const response = await adminApi.get("orders/admin/returns/", {
          params,
        });

        const data = response.data;

        if (Array.isArray(data.results)) {
          setReturns(data.results);
          setTotalReturns(data.count || 0);
          setTotalPages(
            Math.max(1, Math.ceil((data.count || 0) / 10))
          );
        } else if (Array.isArray(data)) {
          setReturns(data);
          setTotalReturns(data.length);
          setTotalPages(1);
        } else {
          setReturns([]);
          setTotalReturns(0);
          setTotalPages(1);
        }

        setCurrentPage(page);
      } catch (err) {
        console.error("ADMIN RETURNS FETCH ERROR:", err);

        if (
          err.response?.status === 401 ||
          err.response?.status === 403
        ) {
          handleUnauthorized();
          return;
        }

        setError(
          err.response?.data?.detail ||
            err.response?.data?.error ||
            "Unable to load return requests."
        );
      } finally {
        setLoading(false);
      }
    },
    [statusFilter, handleUnauthorized]
  );

  useEffect(() => {
    fetchReturns(1, statusFilter);
  }, [fetchReturns, statusFilter]);

  const handleReview = async (returnRequest, newStatus) => {
    if (returnRequest.status !== "requested") {
      window.alert("This return request has already been reviewed.");
      return;
    }

    let adminNote = "";

    if (newStatus === "rejected") {
      adminNote = window.prompt(
        "Enter the reason for rejecting this return request:"
      );

      if (adminNote === null) return;

      adminNote = adminNote.trim();

      if (!adminNote) {
        window.alert("Admin note is required when rejecting a return.");
        return;
      }
    } else {
      const confirmed = window.confirm(
        `Approve return request #${returnRequest.id}?`
      );

      if (!confirmed) return;
    }

    try {
      setUpdatingId(returnRequest.id);
      setError("");
      setSuccess("");

      const payload = {
        status: newStatus,
        admin_note: adminNote,
      };

      const response = await adminApi.patch(
        `orders/admin/returns/${returnRequest.id}/`,
        payload
      );

      setSuccess(
        response.data?.message ||
          `Return request ${newStatus} successfully.`
      );

      await fetchReturns(currentPage, statusFilter);
    } catch (err) {
      console.error("RETURN REQUEST UPDATE ERROR:", err);

      if (
        err.response?.status === 401 ||
        err.response?.status === 403
      ) {
        handleUnauthorized();
        return;
      }

      setError(
        err.response?.data?.error ||
          err.response?.data?.detail ||
          "Unable to update this return request."
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const handleFilterChange = (value) => {
    setStatusFilter(value);
    setCurrentPage(1);
    setExpandedId(null);
  };

  const handlePrevious = () => {
    if (currentPage > 1) {
      fetchReturns(currentPage - 1, statusFilter);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      fetchReturns(currentPage + 1, statusFilter);
    }
  };

  const handleLogout = () => {
    if (!window.confirm("Are you sure you want to logout?")) return;

    localStorage.removeItem("admin_access");
    localStorage.removeItem("admin_refresh");
    window.dispatchEvent(new Event("authChanged"));
    navigate("/admin/login", { replace: true });
  };

  const formatDate = (value) => {
    if (!value) return "-";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "-";

    return date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusClass = (value) =>
    String(value || "requested").toLowerCase();

  const getOrderId = (item) => {
    if (item.order && typeof item.order === "object") {
      return item.order.id ?? item.order.order_number ?? "-";
    }

    return item.order ?? "-";
  };

  const getUserId = (item) => {
    if (item.user && typeof item.user === "object") {
      return item.user.id ?? item.user.email ?? "-";
    }

    return item.user ?? "-";
  };

  const keyword = search.trim().toLowerCase();

  const filteredReturns = returns.filter((item) => {
    if (!keyword) return true;

    return (
      String(item.id || "").toLowerCase().includes(keyword) ||
      String(getOrderId(item)).toLowerCase().includes(keyword) ||
      String(getUserId(item)).toLowerCase().includes(keyword) ||
      String(item.reason || "").toLowerCase().includes(keyword) ||
      String(item.status || "").toLowerCase().includes(keyword)
    );
  });

  const navigationItems = [
    { name: "Dashboard", path: "/admin/dashboard", icon: LayoutDashboard },
    { name: "Customers", path: "/admin/customers", icon: Users },
    { name: "Categories", path: "/admin/categories", icon: Tags },
    { name: "Colors", path: "/admin/colors", icon: Palette },
    { name: "Sizes", path: "/admin/sizes", icon: Ruler },
    { name: "Product Management", path: "/admin/products", icon: Package },
    { name: "Product Variants", path: "/admin/product-variants", icon: Layers },
    { name: "Order Management", path: "/admin/orders", icon: ShoppingBag },
    { name: "Return Requests", path: "/admin/returns", icon: RotateCcw },
  ];

  return (
    <div className="admin-dashboard admin-returns-layout">
      <button
        type="button"
        className="admin-mobile-menu"
        onClick={() => setSidebarOpen((previous) => !previous)}
        aria-label="Toggle navigation"
      >
        {sidebarOpen ? <X /> : <Menu />}
      </button>

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

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`admin-nav-link ${
                  location.pathname === item.path ? "active" : ""
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
          type="button"
          className="admin-logout-button"
          onClick={handleLogout}
        >
          <LogOut size={19} />
          <span>Logout</span>
        </button>
      </aside>

      <main className="admin-main-content">
        <header className="admin-topbar">
          <div>
            <h2>Return Requests</h2>
            <p>Review and manage customer return requests</p>
          </div>

          <div className="admin-profile">
            <span className="admin-profile-icon">A</span>
            <span>Administrator</span>
          </div>
        </header>

        <section className="admin-returns-content">
          <div className="admin-returns-heading">
            <div>
              <h2>Customer Returns</h2>
              <p>Approve or reject return requests submitted by customers.</p>
            </div>

            <button
              type="button"
              className="admin-returns-refresh"
              onClick={() => fetchReturns(currentPage, statusFilter)}
              disabled={loading}
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>

          <div className="admin-returns-stats">
            <div className="admin-return-stat">
              <span>Total Requests</span>
              <strong>{totalReturns}</strong>
            </div>

            <div className="admin-return-stat">
              <span>Requests on This Page</span>
              <strong>{returns.length}</strong>
            </div>

            <div className="admin-return-stat">
              <span>Current Page</span>
              <strong>{currentPage} / {totalPages}</strong>
            </div>
          </div>

          <div className="admin-returns-panel">
            <div className="admin-returns-panel-heading">
              <div>
                <h3>Return Request List</h3>
                <p>Search and filter customer return requests.</p>
              </div>
            </div>

            <div className="admin-returns-toolbar">
              <form
                className="admin-returns-search"
                onSubmit={(event) => event.preventDefault()}
              >
                <Search size={18} />

                <input
                  type="text"
                  placeholder="Search by request, order, user or reason..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />

                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                  >
                    Clear
                  </button>
                )}
              </form>

              <select
                className="admin-returns-filter"
                value={statusFilter}
                onChange={(event) => handleFilterChange(event.target.value)}
              >
                <option value="all">All Requests</option>
                {RETURN_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {error && (
              <div className="admin-returns-alert error">{error}</div>
            )}

            {success && (
              <div className="admin-returns-alert success">{success}</div>
            )}

            <div className="admin-returns-table-wrapper">
              {loading ? (
                <div className="admin-returns-message">
                  Loading return requests...
                </div>
              ) : filteredReturns.length === 0 ? (
                <div className="admin-returns-message">
                  {search
                    ? "No matching return requests found."
                    : "No return requests found."}
                </div>
              ) : (
                <table className="admin-returns-table">
                  <thead>
                    <tr>
                      <th>Request</th>
                      <th>Order ID</th>
                      <th>User ID</th>
                      <th>Requested Date</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredReturns.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <strong className="admin-return-id">
                            #{item.id}
                          </strong>
                        </td>

                        <td>{getOrderId(item)}</td>
                        <td>{getUserId(item)}</td>
                        <td>{formatDate(item.requested_at)}</td>

                        <td>
                          <span
                            className={`admin-return-status ${getStatusClass(
                              item.status
                            )}`}
                          >
                            {item.status || "requested"}
                          </span>
                        </td>

                        <td>
                          <div className="admin-return-actions">
                            <button
                              type="button"
                              className="admin-return-view"
                              onClick={() =>
                                setExpandedId(
                                  expandedId === item.id ? null : item.id
                                )
                              }
                            >
                              {expandedId === item.id ? "Hide" : "View"}
                            </button>

                            {item.status === "requested" && (
                              <>
                                <button
                                  type="button"
                                  className="admin-return-approve"
                                  disabled={updatingId === item.id}
                                  onClick={() =>
                                    handleReview(item, "approved")
                                  }
                                  title="Approve return"
                                >
                                  <Check size={15} />
                                  Approve
                                </button>

                                <button
                                  type="button"
                                  className="admin-return-reject"
                                  disabled={updatingId === item.id}
                                  onClick={() =>
                                    handleReview(item, "rejected")
                                  }
                                  title="Reject return"
                                >
                                  <XCircle size={15} />
                                  Reject
                                </button>
                              </>
                            )}

                            {updatingId === item.id && (
                              <span className="admin-return-updating">
                                Updating...
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {!loading && totalPages > 1 && (
              <div className="admin-returns-pagination">
                <button
                  type="button"
                  onClick={handlePrevious}
                  disabled={currentPage <= 1}
                >
                  <ChevronLeft size={17} />
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
                  <ChevronRight size={17} />
                </button>
              </div>
            )}

            {expandedId !== null &&
              returns
                .filter((item) => item.id === expandedId)
                .map((item) => (
                  <div className="admin-return-detail" key={item.id}>
                    <div className="admin-return-detail-heading">
                      <div>
                        <span>RETURN REQUEST DETAILS</span>
                        <h3>Request #{item.id}</h3>
                      </div>

                      <button
                        type="button"
                        onClick={() => setExpandedId(null)}
                      >
                        Close
                      </button>
                    </div>

                    <div className="admin-return-detail-grid">
                      <div>
                        <h4>Request Information</h4>
                        <p><strong>Order ID:</strong> {getOrderId(item)}</p>
                        <p><strong>User ID:</strong> {getUserId(item)}</p>
                        <p><strong>Status:</strong> {item.status}</p>
                        <p>
                          <strong>Requested:</strong>{" "}
                          {formatDate(item.requested_at)}
                        </p>
                      </div>

                      <div>
                        <h4>Review Information</h4>
                        <p>
                          <strong>Reviewed by:</strong>{" "}
                          {item.reviewed_by_email || "-"}
                        </p>
                        <p>
                          <strong>Reviewed at:</strong>{" "}
                          {formatDate(item.reviewed_at)}
                        </p>
                        <p>
                          <strong>Admin note:</strong>{" "}
                          {item.admin_note || "No admin note"}
                        </p>
                      </div>
                    </div>

                    <div className="admin-return-reason">
                      <h4>Customer Return Reason</h4>
                      <p>{item.reason || "No reason provided."}</p>
                    </div>
                  </div>
                ))}
          </div>
        </section>
      </main>
    </div>
  );
}

export default AdminReturns;
