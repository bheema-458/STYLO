
import { useLocation, useNavigate } from "react-router-dom";
import "./OrderSuccess.css";

function OrderSuccess() {
  const navigate = useNavigate();
  const location = useLocation();

  const order = location.state?.order;

  if (!order) {
    return (
      <div className="order-success-empty">
        <h2>Order details not found</h2>
        <p>Please check your orders to view your recent purchase.</p>
        <button onClick={() => navigate("/home")}>
          Continue Shopping
        </button>
      </div>
    );
  }

  const formatPrice = (value) =>
    `₹${Number(value || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  return (
    <main className="order-success-page">
      <div className="order-success-container">

        <div className="success-icon">
          <span>✓</span>
        </div>

        <span className="success-eyebrow">
          THANK YOU FOR SHOPPING WITH STYLO
        </span>

        <h1>Your Order is Placed!</h1>

        <p className="success-description">
          Thank you for choosing STYLO. Your order has been
          successfully received. We can't wait for you to
          experience your new style.
        </p>

        <div className="success-order-number">
          <span>ORDER NUMBER</span>
          <strong>{order.order_number}</strong>
        </div>

        <section className="success-details-card">
          <div className="success-card-heading">
            <h2>Order Details</h2>
            <span className="order-status">
              {order.status}
            </span>
          </div>

          <div className="success-info-grid">
            <div>
              <span>Order Number</span>
              <strong>{order.order_number}</strong>
            </div>

            <div>
              <span>Payment Method</span>
              <strong>Cash on Delivery</strong>
            </div>

            <div>
              <span>Payment Status</span>
              <strong>{order.payment_status}</strong>
            </div>

            <div>
              <span>Order Date</span>
              <strong>
                {order.created_at
                  ? new Date(order.created_at).toLocaleDateString(
                      "en-IN",
                      {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      }
                    )
                  : "-"}
              </strong>
            </div>
          </div>

          <div className="success-divider" />

          <h3 className="success-subheading">
            Delivery Address
          </h3>

          <div className="success-address">
            <strong>{order.full_name}</strong>
            <p>{order.address}</p>
            <p>
              {order.city}, {order.state} - {order.pincode}
            </p>
            <p>Phone: {order.phone_number}</p>
          </div>

          <div className="success-divider" />

          <h3 className="success-subheading">
            Ordered Products
          </h3>

          <div className="success-products">
            {order.items?.map((item) => (
              <div className="success-product" key={item.id}>
                <div className="success-product-info">
                  <strong>{item.product_name}</strong>

                  <p>
                    Size: {item.size} | Color: {item.color}
                  </p>

                  <p>Quantity: {item.quantity}</p>
                </div>

                <strong>
                  {formatPrice(item.total_price)}
                </strong>
              </div>
            ))}
          </div>

          <div className="success-divider" />

          <div className="success-price-row">
            <span>Subtotal</span>
            <strong>{formatPrice(order.subtotal)}</strong>
          </div>

          <div className="success-price-row">
            <span>Shipping Charge</span>
            <strong>
              {Number(order.shipping_charge) === 0
                ? "FREE"
                : formatPrice(order.shipping_charge)}
            </strong>
          </div>

          <div className="success-total">
            <span>Total Amount</span>
            <strong>{formatPrice(order.total_amount)}</strong>
          </div>
        </section>

        <div className="success-message">
          <span>♡</span>
          <p>
            Every outfit tells a story. Thank you for making
            STYLO a part of yours.
          </p>
        </div>

        <div className="success-actions">
          <button
            className="success-primary-btn"
            onClick={() => navigate("/my-orders")}
          >
            View My Orders
          </button>

          <button
            className="success-secondary-btn"
            onClick={() => navigate("/home")}
          >
            Continue Shopping
          </button>
        </div>

      </div>
    </main>
  );
}

export default OrderSuccess;
