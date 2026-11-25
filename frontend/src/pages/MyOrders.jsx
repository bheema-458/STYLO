
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import Navbar from "../components/Navbar";
import "./MyOrders.css";

function MyOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [actionLoading, setActionLoading] = useState(null);
  const [trackingLoading, setTrackingLoading] = useState(null);

  const [expandedOrder, setExpandedOrder] = useState(null);
  const [trackingData, setTrackingData] = useState({});

  // Modal state: cancel or return
  const [activeModal, setActiveModal] = useState(null);
  const [reason, setReason] = useState("");

  // ========================================
  // FETCH ORDERS
  // ========================================

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get("orders/my-orders/");
      const data = response.data;

      const orderList = Array.isArray(data)
        ? data
        : data.results || data.orders || [];

      setOrders(orderList);
    } catch (err) {
      console.error("MY ORDERS ERROR:", err);

      setError(
        err.response?.data?.detail ||
        err.response?.data?.error ||
        "Unable to load your orders. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // ========================================
  // FORMAT HELPERS
  // ========================================

  const formatDate = (date) => {
    if (!date) return "Date unavailable";

    return new Date(date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatDateTime = (date) => {
    if (!date) return "Date unavailable";

    return new Date(date).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatPrice = (price) => {
    return `₹${Number(price || 0).toFixed(2)}`;
  };

  const formatStatus = (value) => {
    return (value || "pending").replaceAll("_", " ");
  };

  const getStatusClass = (value) => {
    return (value || "pending")
      .toLowerCase()
      .replaceAll("_", "-");
  };

  const canCancel = (order) => {
    return ["pending", "confirmed"].includes(order.status);
  };

  const canReturn = (order) => {
    return order.status === "delivered";
  };

  const hasExistingReturn = (order) => {
    return (
      Array.isArray(order.return_requests) &&
      order.return_requests.length > 0
    );
  };

  const canDownloadInvoice = (order) => {
    return order.payment_status === "paid";
  };

  // ========================================
  // MODAL HELPERS
  // ========================================

  const openActionModal = (type, order) => {
    setError("");
    setSuccess("");
    setReason("");

    setActiveModal({
      type,
      order,
    });
  };

  const closeActionModal = () => {
    if (actionLoading) return;

    setActiveModal(null);
    setReason("");
  };

  // ========================================
  // CANCEL ORDER
  // ========================================

  const handleCancelOrder = async () => {
    if (!activeModal?.order) return;

    const order = activeModal.order;

    if (!reason.trim() || reason.trim().length < 5) {
      setError("Please enter a cancellation reason with at least 5 characters.");
      return;
    }

    try {
      setActionLoading(`cancel-${order.id}`);
      setError("");
      setSuccess("");

      await api.post(`orders/cancel/${order.id}/`, {
        reason: reason.trim(),
      });

      setActiveModal(null);
      setReason("");

      setSuccess(
        `Order ${order.order_number} has been cancelled successfully.`
      );

      await fetchOrders();
    } catch (err) {
      console.error("CANCEL ORDER ERROR:", err);

      setError(
        err.response?.data?.detail ||
        err.response?.data?.error ||
        "Unable to cancel this order."
      );
    } finally {
      setActionLoading(null);
    }
  };

  // ========================================
  // DOWNLOAD INVOICE
  // ========================================

  const handleDownloadInvoice = async (order) => {
    try {
      setActionLoading(`invoice-${order.id}`);
      setError("");
      setSuccess("");

      const response = await api.get(
        `orders/detail/${order.id}/invoice/`,
        {
          responseType: "blob",
        }
      );

      const fileBlob = new Blob([response.data], {
        type: "application/pdf",
      });

      const fileURL = window.URL.createObjectURL(fileBlob);
      const link = document.createElement("a");

      link.href = fileURL;
      link.download = `STYLO-Invoice-${order.order_number}.pdf`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.setTimeout(() => {
        window.URL.revokeObjectURL(fileURL);
      }, 1000);

      setSuccess("Your invoice has been downloaded.");
    } catch (err) {
      console.error("INVOICE ERROR:", err);

      setError(
        "Unable to download invoice. Please check the payment status and try again."
      );
    } finally {
      setActionLoading(null);
    }
  };

  // ========================================
  // ORDER TRACKING
  // ========================================

  const handleTracking = async (order) => {
    if (trackingData[order.id]) {
      setTrackingData((previous) => {
        const updated = { ...previous };
        delete updated[order.id];
        return updated;
      });
      return;
    }

    try {
      setTrackingLoading(order.id);
      setError("");

      const response = await api.get(
        `orders/detail/${order.id}/tracking/`
      );

      const data = response.data;

      const history = Array.isArray(data)
        ? data
        : data.tracking_history ||
          data.results ||
          data.history ||
          data.status_history ||
          [];

      setTrackingData((previous) => ({
        ...previous,
        [order.id]: history,
      }));
    } catch (err) {
      console.error("TRACKING ERROR:", err);

      setError(
        err.response?.data?.detail ||
        err.response?.data?.error ||
        "Unable to load tracking information."
      );
    } finally {
      setTrackingLoading(null);
    }
  };

  // ========================================
  // RETURN REQUEST
  // ========================================

  const handleReturnRequest = async () => {
    if (!activeModal?.order) return;

    const order = activeModal.order;

    if (!reason.trim() || reason.trim().length < 5) {
      setError("Please enter a return reason with at least 5 characters.");
      return;
    }

    try {
      setActionLoading(`return-${order.id}`);
      setError("");
      setSuccess("");

      await api.post(`orders/return/${order.id}/`, {
        reason: reason.trim(),
      });

      setActiveModal(null);
      setReason("");

      setSuccess("Your return request has been submitted successfully.");

      await fetchOrders();
    } catch (err) {
      console.error("RETURN REQUEST ERROR:", err);

      const reasonError = err.response?.data?.reason;
      const reasonMessage = Array.isArray(reasonError)
        ? reasonError[0]
        : reasonError;

      setError(
        err.response?.data?.detail ||
        err.response?.data?.error ||
        reasonMessage ||
        "Unable to submit your return request."
      );
    } finally {
      setActionLoading(null);
    }
  };

  // ========================================
  // LOADING SCREEN
  // ========================================

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="my-orders-loading">
          <div className="orders-spinner"></div>
          <p>Loading your orders...</p>
        </div>
      </>
    );
  }

  // ========================================
  // MAIN UI
  // ========================================

  return (
    <>
      <Navbar />

      <main className="my-orders-page">
        <div className="my-orders-container">

          {/* PAGE HEADER */}

          <section className="orders-header">
            <div>
              <p className="orders-eyebrow">YOUR STYLO ACCOUNT</p>
              <h1>My Orders</h1>
              <p className="orders-subtitle">
                Every order, every detail, all in one place.
              </p>
            </div>

            <Link to="/home" className="continue-shopping-btn">
              <span>←</span> Continue Shopping
            </Link>
          </section>

          {/* ALERTS */}

          {error && (
            <div className="orders-alert orders-error" role="alert">
              <span>{error}</span>
              <button
                type="button"
                onClick={() => setError("")}
                aria-label="Close error"
              >
                ×
              </button>
            </div>
          )}

          {success && (
            <div className="orders-alert orders-success" role="status">
              <span>✓ {success}</span>
              <button
                type="button"
                onClick={() => setSuccess("")}
                aria-label="Close success message"
              >
                ×
              </button>
            </div>
          )}

          {/* EMPTY ORDERS */}

          {orders.length === 0 ? (
            <section className="empty-orders">
              <div className="empty-orders-icon">♡</div>
              <h2>Your shopping story starts here</h2>
              <p>
                You haven't placed any orders yet. Explore our collection
                and find something you love.
              </p>

              <Link to="/products" className="shop-now-btn">
                Explore Collection
              </Link>
            </section>
          ) : (
            <>
              <div className="orders-summary">
                <div>
                  <span className="summary-label">YOUR PURCHASES</span>
                  <h2>
                    {orders.length}{" "}
                    {orders.length === 1 ? "Order" : "Orders"}
                  </h2>
                </div>
                <span className="orders-summary-icon">▤</span>
              </div>

              <div className="orders-list">
                {orders.map((order) => {
                  const items = order.items || [];
                  const isExpanded = expandedOrder === order.id;
                  const history = trackingData[order.id];
                  const returnRequests = order.return_requests || [];

                  return (
                    <article className="order-card" key={order.id}>

                      {/* ORDER HEADER */}

                      <div className="order-card-header">
                        <div className="order-main-info">

                          <div className="order-info-block">
                            <span className="order-label">
                              ORDER NUMBER
                            </span>
                            <h3>{order.order_number}</h3>
                          </div>

                          <div className="order-info-block">
                            <span className="order-label">
                              ORDER DATE
                            </span>
                            <p>{formatDate(order.created_at)}</p>
                          </div>

                          <div className="order-info-block">
                            <span className="order-label">
                              TOTAL AMOUNT
                            </span>
                            <p className="order-total">
                              {formatPrice(order.total_amount)}
                            </p>
                          </div>

                        </div>

                        <span
                          className={`order-status ${getStatusClass(order.status)}`}
                        >
                          {formatStatus(order.status)}
                        </span>
                      </div>

                      {/* ORDER BODY */}

                      <div className="order-card-body">

                        <div className="order-items-preview">
                          {items.slice(0, 3).map((item) => (
                            <div className="order-item-row" key={item.id}>
                              <div className="order-item-placeholder">
                                <span>S</span>
                              </div>

                              <div className="order-item-info">
                                <h4>{item.product_name}</h4>
                                <p>
                                  Size: {item.size || "N/A"} ·
                                  Color: {item.color || "N/A"} ·
                                  Qty: {item.quantity}
                                </p>
                              </div>

                              <strong>
                                {formatPrice(item.total_price)}
                              </strong>
                            </div>
                          ))}

                          {items.length > 3 && (
                            <p className="more-items">
                              + {items.length - 3} more item(s)
                            </p>
                          )}
                        </div>

                        {/* ACTION BUTTONS */}

                        <div className="order-card-footer">

                          <button
                            type="button"
                            className="order-action-btn details-btn"
                            onClick={() =>
                              setExpandedOrder(
                                isExpanded ? null : order.id
                              )
                            }
                          >
                            {isExpanded ? "Hide Details" : "View Details"}
                          </button>

                          <button
                            type="button"
                            className="order-action-btn tracking-btn"
                            onClick={() => handleTracking(order)}
                            disabled={trackingLoading === order.id}
                          >
                            {trackingLoading === order.id
                              ? "Loading..."
                              : history
                                ? "Hide Tracking"
                                : "Track Order"}
                          </button>

                          {canDownloadInvoice(order) && (
                            <button
                              type="button"
                              className="order-action-btn invoice-btn"
                              disabled={
                                actionLoading === `invoice-${order.id}`
                              }
                              onClick={() => handleDownloadInvoice(order)}
                            >
                              {actionLoading === `invoice-${order.id}`
                                ? "Downloading..."
                                : "↓ Download Invoice"}
                            </button>
                          )}

                          {canCancel(order) && (
                            <button
                              type="button"
                              className="order-action-btn cancel-order-btn"
                              disabled={
                                actionLoading === `cancel-${order.id}`
                              }
                              onClick={() =>
                                openActionModal("cancel", order)
                              }
                            >
                              {actionLoading === `cancel-${order.id}`
                                ? "Cancelling..."
                                : "Cancel Order"}
                            </button>
                          )}

                          {canReturn(order) && !hasExistingReturn(order) && (
                            <button
                              type="button"
                              className="order-action-btn return-order-btn"
                              disabled={
                                actionLoading === `return-${order.id}`
                              }
                              onClick={() =>
                                openActionModal("return", order)
                              }
                            >
                              {actionLoading === `return-${order.id}`
                                ? "Submitting..."
                                : "↶ Request Return"}
                            </button>
                          )}

                        </div>

                        {/* TRACKING HISTORY */}

                        {history && (
                          <section className="order-tracking-section">
                            <h4>Order Tracking History</h4>

                            {history.length === 0 ? (
                              <p className="tracking-empty">
                                No tracking updates available yet.
                              </p>
                            ) : (
                              <div className="tracking-timeline">
                                {history.map((event, index) => (
                                  <div
                                    className="tracking-event"
                                    key={event.id || index}
                                  >
                                    <div className="tracking-dot"></div>

                                    <div className="tracking-event-content">
                                      <strong>
                                        {formatStatus(event.status)}
                                      </strong>

                                      <p>
                                        {event.description ||
                                          "Order status updated."}
                                      </p>

                                      <span>
                                        {formatDateTime(event.created_at)}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </section>
                        )}

                        {/* EXPANDED DETAILS */}

                        {isExpanded && (
                          <section className="order-expanded-details">

                            <div className="details-section-heading">
                              <div>
                                <span className="section-kicker">
                                  ORDER INFORMATION
                                </span>
                                <h4>Order Details</h4>
                              </div>
                            </div>

                            {/* ALL ITEMS */}

                            <div className="expanded-items">
                              {items.map((item) => (
                                <div className="expanded-item" key={item.id}>
                                  <div>
                                    <strong>{item.product_name}</strong>
                                    <p>
                                      Size: {item.size || "N/A"} ·
                                      Color: {item.color || "N/A"}
                                    </p>
                                    <p>Quantity: {item.quantity}</p>
                                  </div>

                                  <strong>
                                    {formatPrice(item.total_price)}
                                  </strong>
                                </div>
                              ))}
                            </div>

                            {/* DELIVERY ADDRESS */}

                            <div className="order-address">
                              <h4>Delivery Address</h4>
                              <p className="address-name">
                                {order.full_name}
                              </p>
                              <p>{order.phone_number}</p>
                              <p>{order.address}</p>
                              <p>
                                {order.city}, {order.state} - {order.pincode}
                              </p>
                            </div>

                            {/* PRICE BREAKDOWN */}

                            <div className="order-price-breakdown">
                              <div>
                                <span>Subtotal</span>
                                <span>{formatPrice(order.subtotal)}</span>
                              </div>

                              <div>
                                <span>Shipping</span>
                                <span>
                                  {formatPrice(order.shipping_charge)}
                                </span>
                              </div>

                              <div>
                                <span>Tax</span>
                                <span>{formatPrice(order.tax_amount)}</span>
                              </div>

                              <div className="expanded-grand-total">
                                <strong>Grand Total</strong>
                                <strong>
                                  {formatPrice(order.total_amount)}
                                </strong>
                              </div>
                            </div>

                            {/* PAYMENT INFORMATION */}

                            <div className="order-payment-grid">
                              <div className="order-payment-info">
                                <span>Payment Method</span>
                                <strong>
                                  {formatStatus(order.payment_method)}
                                </strong>
                              </div>

                              <div className="order-payment-info">
                                <span>Payment Status</span>
                                <strong
                                  className={`payment-${getStatusClass(order.payment_status)}`}
                                >
                                  {formatStatus(order.payment_status)}
                                </strong>
                              </div>
                            </div>

                            {/* RETURN STATUS */}

                            {returnRequests.length > 0 && (
                              <div className="return-status-section">
                                <div className="return-section-heading">
                                  <div>
                                    <span className="section-kicker">
                                      AFTER-SALES SUPPORT
                                    </span>
                                    <h4>Return Request</h4>
                                  </div>

                                  <span
                                    className={`return-status-badge ${getStatusClass(returnRequests[0].status)}`}
                                  >
                                    {formatStatus(returnRequests[0].status)}
                                  </span>
                                </div>

                                {returnRequests.map((item) => (
                                  <div
                                    className="return-request-details"
                                    key={item.id}
                                  >
                                    <p>
                                      <strong>Your reason:</strong>{" "}
                                      {item.reason}
                                    </p>

                                    {item.admin_note && (
                                      <p>
                                        <strong>Admin response:</strong>{" "}
                                        {item.admin_note}
                                      </p>
                                    )}

                                    {item.reviewed_at && (
                                      <p>
                                        <strong>Reviewed on:</strong>{" "}
                                        {formatDate(item.reviewed_at)}
                                      </p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* CANCELLATION REASON */}

                            {order.status === "cancelled" &&
                              order.cancellation_reason && (
                                <div className="cancelled-info">
                                  <h4>Cancellation Information</h4>
                                  <p>
                                    <strong>Reason:</strong>{" "}
                                    {order.cancellation_reason}
                                  </p>
                                </div>
                              )}

                          </section>
                        )}

                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </main>

      {/* CANCEL / RETURN MODAL */}

      {activeModal && (
        <div
          className="order-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeActionModal();
            }
          }}
        >
          <section
            className="order-action-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="order-modal-title"
          >
            <button
              type="button"
              className="modal-close-btn"
              onClick={closeActionModal}
              disabled={Boolean(actionLoading)}
              aria-label="Close dialog"
            >
              ×
            </button>

            <div
              className={`modal-icon ${
                activeModal.type === "cancel"
                  ? "modal-icon-cancel"
                  : "modal-icon-return"
              }`}
            >
              {activeModal.type === "cancel" ? "!" : "↶"}
            </div>

            <span className="section-kicker">
              {activeModal.type === "cancel"
                ? "ORDER CANCELLATION"
                : "RETURN REQUEST"}
            </span>

            <h2 id="order-modal-title">
              {activeModal.type === "cancel"
                ? "Cancel this order?"
                : "Request a return"}
            </h2>

            <p className="modal-description">
              Order{" "}
              <strong>{activeModal.order.order_number}</strong>
            </p>

            <label htmlFor="order-action-reason">
              {activeModal.type === "cancel"
                ? "Why do you want to cancel this order?"
                : "Please tell us why you want to return this order."}
            </label>

            <textarea
              id="order-action-reason"
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                setError("");
              }}
              placeholder={
                activeModal.type === "cancel"
                  ? "Enter your cancellation reason..."
                  : "Enter your return reason..."
              }
              rows={4}
              maxLength={500}
              disabled={Boolean(actionLoading)}
            />

            <div className="modal-input-footer">
              <span>Minimum 5 characters</span>
              <span>{reason.length}/500</span>
            </div>

            {error && (
              <p className="modal-error-message">{error}</p>
            )}

            <div className="modal-actions">
              <button
                type="button"
                className="modal-secondary-btn"
                onClick={closeActionModal}
                disabled={Boolean(actionLoading)}
              >
                Go Back
              </button>

              <button
                type="button"
                className={
                  activeModal.type === "cancel"
                    ? "modal-confirm-cancel-btn"
                    : "modal-confirm-return-btn"
                }
                onClick={
                  activeModal.type === "cancel"
                    ? handleCancelOrder
                    : handleReturnRequest
                }
                disabled={
                  Boolean(actionLoading) || reason.trim().length < 5
                }
              >
                {actionLoading
                  ? "Please wait..."
                  : activeModal.type === "cancel"
                    ? "Confirm Cancellation"
                    : "Submit Return Request"}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

export default MyOrders;
