
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api";
import "./OrderConfirmation.css";

// Order fulfillment stages
const ORDER_STAGES = [
  {
    key: "confirmed",
    title: "Order Confirmed",
    description: "Your order has been successfully placed.",
  },
  {
    key: "processing",
    title: "Preparing Your Order",
    description: "Your items are being prepared for dispatch.",
  },
  {
    key: "shipped",
    title: "On Its Way",
    description: "Your order has been handed over to the delivery partner.",
  },
  {
    key: "delivered",
    title: "Delivered",
    description: "Your order has reached its destination.",
  },
];

const STATUS_INDEX = {
  confirmed: 0,
  processing: 1,
  shipped: 2,
  delivered: 3,
};

const formatPrice = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatDate = (value) => {
  if (!value) return "Not available";

  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

function OrderConfirmation() {
  const { orderId } = useParams();
  const navigate = useNavigate();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  // Fetch actual order details from Django API
  useEffect(() => {
    let isMounted = true;

    const fetchOrder = async () => {
      try {
        setLoading(true);
        setError("");

        if (!orderId) {
          throw new Error("Order reference is missing.");
        }

        const response = await api.get(
          `orders/${orderId}/`
        );

        if (isMounted) {
          setOrder(response.data);
        }
      } catch (err) {
        if (isMounted) {
          setError(
            err.response?.data?.detail ||
              err.response?.data?.error ||
              err.message ||
              "Unable to load order details."
          );
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchOrder();

    return () => {
      isMounted = false;
    };
  }, [orderId]);

  // Copy order reference
  const handleCopyOrderId = async () => {
    const reference = order?.order_number;

    if (!reference) return;

    try {
      await navigator.clipboard.writeText(reference);
      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      setError("Unable to copy order reference.");
    }
  };

  if (loading) {
    return (
      <div className="order-state">
        <div className="order-loader" />
        <p>Loading your order details...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="order-state">
        <div className="order-error-icon">!</div>

        <h2>Order Details Unavailable</h2>

        <p>{error || "Order not found."}</p>

        <button
          className="oc-primary-btn"
          onClick={() => navigate("/orders")}
        >
          View My Orders
        </button>
      </div>
    );
  }

  const currentStatus = String(
    order.status || "confirmed"
  ).toLowerCase();

  const currentStage = STATUS_INDEX[currentStatus] ?? -1;

  const items = order.items || [];

  const address = order.delivery_address || {};

  const subtotal = Number(order.subtotal || 0);
  const discount = Number(order.discount || 0);
  const shipping = Number(order.shipping_charge || 0);
  const total = Number(order.total_amount || 0);

  const isCancelled = currentStatus === "cancelled";

  return (
    <main className="order-confirmation-page">

      {/* Checkout Progress */}
      <section className="oc-progress">
        {["Bag", "Delivery", "Payment", "Confirmation"].map(
          (step, index) => (
            <div
              className={`oc-progress-step ${
                index === 3 ? "active" : "completed"
              }`}
              key={step}
            >
              <span className="oc-progress-number">
                {index === 3 ? "4" : "✓"}
              </span>

              <span>{step}</span>

              {index !== 3 && (
                <span className="oc-progress-line" />
              )}
            </div>
          )
        )}
      </section>

      {/* Success Header */}
      <section className="oc-hero">
        <div className="oc-success-icon">
          {isCancelled ? "!" : "✓"}
        </div>

        <p className="oc-eyebrow">
          STYLO ORDER RECEIPT
        </p>

        <h1>
          {isCancelled
            ? "Order Cancelled"
            : "Your Order Is Confirmed"}
        </h1>

        <p className="oc-intro">
          Thank you for choosing STYLO.
          {order.customer_name
            ? ` ${order.customer_name},`
            : ""}{" "}
          {isCancelled
            ? "Your order has been cancelled."
            : "Your order is now being prepared with care."}
        </p>
      </section>

      {/* Order Reference Information */}
      <section className="oc-reference-card">

        <div className="oc-reference-item">
          <span>ORDER REFERENCE</span>

          <div className="oc-reference-value">
            <strong>
              {order.order_number}
            </strong>

            <button
              type="button"
              onClick={handleCopyOrderId}
              aria-label="Copy order reference"
              title="Copy order reference"
            >
              {copied ? "Copied ✓" : "▢"}
            </button>
          </div>
        </div>

        <div className="oc-reference-item">
          <span>ORDER PLACED</span>

          <strong>
            {formatDate(order.created_at)}
          </strong>

          <small>
            {order.payment_method || "Payment pending"}
          </small>
        </div>

        <div className="oc-reference-item">
          <span>ESTIMATED DELIVERY</span>

          <strong>
            {formatDate(order.estimated_delivery)}
          </strong>

          <small>
            {order.delivery_method || "Standard Delivery"}
          </small>
        </div>

      </section>

      {/* Fulfillment Roadmap */}
      {!isCancelled && (
        <section className="oc-roadmap-section">
          <div className="oc-section-heading">
            <div>
              <p className="oc-eyebrow">
                ORDER TRACKING
              </p>

              <h2>Fulfillment Roadmap</h2>
            </div>

            <span className="oc-current-status">
              {currentStage >= 0
                ? `CURRENTLY: ${ORDER_STAGES[currentStage].title}`
                : "ORDER STATUS PENDING"}
            </span>
          </div>

          <div className="oc-roadmap">
            {ORDER_STAGES.map((stage, index) => {
              const completed = index < currentStage;
              const active = index === currentStage;

              return (
                <article
                  className={`oc-stage ${
                    completed ? "completed" : ""
                  } ${active ? "active" : ""}`}
                  key={stage.key}
                >
                  <div className="oc-stage-top">
                    <span className="oc-stage-icon">
                      {completed
                        ? "✓"
                        : active
                        ? "●"
                        : index + 1}
                    </span>

                    <span>
                      {completed
                        ? "COMPLETED"
                        : active
                        ? "IN PROGRESS"
                        : `STEP 0${index + 1}`}
                    </span>
                  </div>

                  <h3>{stage.title}</h3>

                  <p>{stage.description}</p>

                  {active && (
                    <small>
                      {formatDate(order.updated_at)}
                    </small>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* Main Order Information */}
      <section className="oc-details-layout">

        {/* Ordered Products */}
        <div className="oc-products-card">

          <div className="oc-card-heading">
            <h2>
              Ordered Creations
              <small> ({items.length} Items)</small>
            </h2>

            {order.invoice_url && (
              <a
                href={order.invoice_url}
                target="_blank"
                rel="noopener noreferrer"
                className="oc-invoice-link"
              >
                Download Receipt
              </a>
            )}
          </div>

          {items.length === 0 ? (
            <p>No order items found.</p>
          ) : (
            items.map((item) => (
              <article
                className="oc-product-item"
                key={item.id}
              >
                <div className="oc-product-image">
                  {item.product_image ? (
                    <img
                      src={item.product_image}
                      alt={item.product_name}
                    />
                  ) : (
                    <span>STYLO</span>
                  )}
                </div>

                <div className="oc-product-info">
                  <h3>{item.product_name}</h3>

                  <p>
                    {item.category || "Fashion"}
                    {item.size && ` • Size ${item.size}`}
                    {item.color && ` • ${item.color}`}
                  </p>

                  <div className="oc-product-meta">
                    <span>Qty: {item.quantity}</span>

                    {item.sku && (
                      <span>SKU: {item.sku}</span>
                    )}
                  </div>
                </div>

                <div className="oc-product-price">
                  <strong>
                    {formatPrice(
                      item.line_total ??
                      Number(item.unit_price || 0) *
                        Number(item.quantity || 0)
                    )}
                  </strong>

                  {item.mrp && (
                    <del>{formatPrice(item.mrp)}</del>
                  )}
                </div>
              </article>
            ))
          )}

        </div>

        {/* Payment Breakdown */}
        <aside className="oc-sidebar">

          <section className="oc-payment-card">
            <h2>Payment Breakdown</h2>

            <div className="oc-price-row">
              <span>Subtotal</span>
              <strong>{formatPrice(subtotal)}</strong>
            </div>

            {discount > 0 && (
              <div className="oc-price-row savings">
                <span>Product Savings</span>
                <strong>-{formatPrice(discount)}</strong>
              </div>
            )}

            {order.coupon_code && (
              <div className="oc-price-row savings">
                <span>
                  Coupon ({order.coupon_code})
                </span>

                <strong>
                  {formatPrice(order.coupon_discount || 0)}
                </strong>
              </div>
            )}

            <div className="oc-price-row">
              <span>Shipping</span>

              <strong>
                {shipping === 0
                  ? "FREE"
                  : formatPrice(shipping)}
              </strong>
            </div>

            <div className="oc-price-row">
              <span>Payment Method</span>

              <strong>
                {order.payment_method || "COD"}
              </strong>
            </div>

            <div className="oc-total-row">
              <strong>Total Amount</strong>
              <strong>{formatPrice(total)}</strong>
            </div>

            {order.payment_status && (
              <p className="oc-payment-status">
                Payment: {order.payment_status}
              </p>
            )}

            {order.total_savings > 0 && (
              <div className="oc-savings-banner">
                YOU SAVED {formatPrice(order.total_savings)}
              </div>
            )}
          </section>

          {/* Delivery Address */}
          <section className="oc-address-card">
            <h2>Delivery Address</h2>

            <strong>{address.full_name}</strong>

            <p>{address.phone}</p>

            <p>
              {[
                address.address_line,
                address.city,
                address.state,
                address.pincode,
              ]
                .filter(Boolean)
                .join(", ")}
            </p>
          </section>

          {/* Customer Actions */}
          <section className="oc-actions-card">
            <h3>What's Next?</h3>

            <button
              className="oc-primary-btn"
              onClick={() => navigate("/orders")}
            >
              View My Orders
            </button>

            <button
              className="oc-secondary-btn"
              onClick={() => navigate("/home")}
            >
              Continue Shopping
            </button>
          </section>

        </aside>
      </section>
    </main>
  );
}

export default OrderConfirmation;
