
import { useCallback, useEffect, useMemo, useState } from "react";
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
  LogOut,
  Menu,
  X,
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
} from "lucide-react";

import { adminApi } from "../../api";
import "./AdminOrders.css";

const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
];

function AdminOrders() {
  const navigate = useNavigate();
  const location = useLocation();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [updatingOrderId, setUpdatingOrderId] = useState(null);

  // Admin authentication check
  useEffect(() => {
    if (!localStorage.getItem("admin_access")) {
      navigate("/admin/login", { replace: true });
    }
  }, [navigate]);

  const handleUnauthorized = () => {
    localStorage.removeItem("admin_access");
    localStorage.removeItem("admin_refresh");

    window.dispatchEvent(new Event("authChanged"));
    navigate("/admin/login", { replace: true });
  };

  // Fetch orders from backend
  const fetchOrders = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      setError("");

      const response = await adminApi.get("orders/admin/all/", {
        params: { page },
      });

      const data = response.data;

      if (Array.isArray(data.results)) {
        setOrders(data.results);
        setTotalOrders(data.count || 0);
        setTotalPages(
          Math.max(1, Math.ceil((data.count || 0) / 10))
        );
      } else if (Array.isArray(data)) {
        setOrders(data);
        setTotalOrders(data.length);
        setTotalPages(1);
      } else {
        setOrders([]);
        setTotalOrders(0);
        setTotalPages(1);
      }

      setCurrentPage(page);
    } catch (err) {
      console.error("ADMIN ORDERS FETCH ERROR:", err);

      if (
        err.response?.status === 401 ||
        err.response?.status === 403
      ) {
        handleUnauthorized();
        return;
      }

      setError(
        err.response?.data?.detail ||
        "Unable to load orders. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders(1);
  }, [fetchOrders]);

  // Search current loaded orders
  const filteredOrders = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) return orders;

    return orders.filter((order) => {
      return (
        String(order.order_number || "").toLowerCase().includes(keyword) ||
        String(order.full_name || "").toLowerCase().includes(keyword) ||
        String(order.phone_number || "").toLowerCase().includes(keyword) ||
        String(order.status || "").toLowerCase().includes(keyword)
      );
    });
  }, [orders, search]);

  // Update order status
  const handleStatusChange = async (order, newStatus) => {
    if (!newStatus || newStatus === order.status) return;

    const confirmed = window.confirm(
      `Change order ${order.order_number} to "${newStatus}"?`
    );

    if (!confirmed) return;

    try {
      setUpdatingOrderId(order.id);
      setError("");

      await adminApi.patch(
        `orders/admin/update-status/${order.id}/`,
        { status: newStatus }
      );

      await fetchOrders(currentPage);

      window.alert("Order status updated successfully.");
    } catch (err) {
      console.error("ORDER STATUS UPDATE ERROR:", err);

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
        "Unable to update order status."
      );
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handlePrevious = () => {
    if (currentPage > 1) {
      fetchOrders(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      fetchOrders(currentPage + 1);
    }
  };

  const handleLogout = () => {
    if (!window.confirm("Are you sure you want to logout?")) return;

    localStorage.removeItem("admin_access");
    localStorage.removeItem("admin_refresh");

    window.dispatchEvent(new Event("authChanged"));
    navigate("/admin/login", { replace: true });
  };

  const formatPrice = (value) =>
    `₹${Number(value || 0).toFixed(2)}`;

  const formatDate = (value) => {
    if (!value) return "-";

    return new Date(value).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const navigationItems = [
    { name: "Dashboard", path: "/admin/dashboard", icon: LayoutDashboard },
    { name: "Customers", path: "/admin/customers", icon: Users },
    { name: "Categories", path: "/admin/categories", icon: Tags },
    { name: "Colors", path: "/admin/colors", icon: Palette },
    { name: "Sizes", path: "/admin/sizes", icon: Ruler },
    { name: "Product Management", path: "/admin/products", icon: Package },
    { name: "Product Variants", path: "/admin/product-variants", icon: Layers },
    { name: "Order Management", path: "/admin/orders", icon: ShoppingBag },
  ];

  return (
    <div className="admin-dashboard admin-orders-layout">
      <button
        type="button"
        className="admin-mobile-menu"
        onClick={() => setSidebarOpen(!sidebarOpen)}
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
            <h2>Order Management</h2>
            <p>View and manage customer orders</p>
          </div>

          <div className="admin-profile">
            <span className="admin-profile-icon">A</span>
            <span>Administrator</span>
          </div>
        </header>

        <section className="admin-orders-content">
          <div className="admin-orders-heading">
            <div>
              <h2>All Orders</h2>
              <p>Monitor purchases and update order status.</p>
            </div>

            <button
              type="button"
              className="admin-refresh-button"
              onClick={() => fetchOrders(currentPage)}
              disabled={loading}
            >
              Refresh Orders
            </button>
          </div>

          <div className="admin-order-stats">
            <div className="admin-order-stat">
              <span>Total Orders</span>
              <strong>{totalOrders}</strong>
            </div>

            <div className="admin-order-stat">
              <span>Orders on This Page</span>
              <strong>{orders.length}</strong>
            </div>

            <div className="admin-order-stat">
              <span>Current Page</span>
              <strong>{currentPage} / {totalPages}</strong>
            </div>
          </div>

          <div className="admin-orders-panel">
            <div className="admin-orders-panel-heading">
              <div>
                <h3>Customer Orders</h3>
                <p>Search by order number, customer, phone or status.</p>
              </div>
            </div>

            <form
              className="admin-orders-search"
              onSubmit={(e) => e.preventDefault()}
            >
              <Search size={18} />

              <input
                type="text"
                placeholder="Search orders..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
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

            {error && (
              <div className="admin-orders-error">{error}</div>
            )}

            <div className="admin-orders-table-wrapper">
              {loading ? (
                <div className="admin-orders-message">
                  Loading orders...
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="admin-orders-message">
                  {search ? "No matching orders found." : "No orders found."}
                </div>
              ) : (
                <table className="admin-orders-table">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Customer</th>
                      <th>Date</th>
                      <th>Amount</th>
                      <th>Payment</th>
                      <th>Status</th>
                      <th>Details</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredOrders.map((order) => (
                      <tr key={order.id}>
                        <td>
                          <strong className="admin-order-number">
                            {order.order_number}
                          </strong>
                        </td>

                        <td>
                          <div className="admin-order-customer">
                            <strong>{order.full_name}</strong>
                            <span>{order.phone_number}</span>
                          </div>
                        </td>

                        <td>{formatDate(order.created_at)}</td>

                        <td className="admin-order-amount">
                          {formatPrice(order.total_amount)}
                        </td>

                        <td>
                          <span
                            className={`admin-payment-badge ${
                              (order.payment_status || "pending").toLowerCase()
                            }`}
                          >
                            {order.payment_status || "pending"}
                          </span>
                        </td>

                        <td>
                          <select
                            className={`admin-order-status-select ${
                              order.status
                            }`}
                            value={order.status}
                            disabled={
                              updatingOrderId === order.id ||
                              order.status === "cancelled" ||
                              order.status === "delivered"
                            }
                            onChange={(e) =>
                              handleStatusChange(order, e.target.value)
                            }
                          >
                            {ORDER_STATUSES.map((status) => (
                              <option key={status} value={status}>
                                {status.charAt(0).toUpperCase() +
                                  status.slice(1)}
                              </option>
                            ))}
                          </select>

                          {updatingOrderId === order.id && (
                            <small className="admin-updating-text">
                              Updating...
                            </small>
                          )}
                        </td>

                        <td>
                          <button
                            type="button"
                            className="admin-view-order-button"
                            onClick={() =>
                              setExpandedOrder(
                                expandedOrder === order.id ? null : order.id
                              )
                            }
                          >
                            <Eye size={15} />
                            {expandedOrder === order.id ? "Hide" : "View"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {!loading && orders.length > 0 && (
              <div className="admin-orders-pagination">
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

            {expandedOrder !== null &&
              orders
                .filter((order) => order.id === expandedOrder)
                .map((order) => (
                  <div className="admin-order-detail" key={order.id}>
                    <div className="admin-order-detail-heading">
                      <div>
                        <span>ORDER DETAILS</span>
                        <h3>{order.order_number}</h3>
                      </div>

                      <button
                        type="button"
                        onClick={() => setExpandedOrder(null)}
                      >
                        Close
                      </button>
                    </div>

                    <div className="admin-order-detail-grid">
                      <div>
                        <h4>Delivery Address</h4>
                        <p>{order.full_name}</p>
                        <p>{order.phone_number}</p>
                        <p>{order.address}</p>
                        <p>
                          {order.city}, {order.state} - {order.pincode}
                        </p>
                      </div>

                      <div>
                        <h4>Order Summary</h4>
                        <p>Subtotal: {formatPrice(order.subtotal)}</p>
                        <p>Shipping: {formatPrice(order.shipping_charge)}</p>
                        <p>
                          Payment: {order.payment_status || "pending"}
                        </p>
                        <strong>
                          Total: {formatPrice(order.total_amount)}
                        </strong>
                      </div>
                    </div>

                    <h4 className="admin-order-products-title">
                      Ordered Products
                    </h4>

                    <div className="admin-order-products">
                      {(order.items || []).map((item) => (
                        <div className="admin-order-product" key={item.id}>
                          <div>
                            <strong>{item.product_name}</strong>
                            <p>
                              Size: {item.size || "-"} | Color:{" "}
                              {item.color || "-"} | Quantity: {item.quantity}
                            </p>
                          </div>

                          <strong>{formatPrice(item.total_price)}</strong>
                        </div>
                      ))}

                      {(!order.items || order.items.length === 0) && (
                        <p>No product details available.</p>
                      )}
                    </div>
                  </div>
                ))}
          </div>
        </section>
      </main>
    </div>
  );
}

export default AdminOrders;
