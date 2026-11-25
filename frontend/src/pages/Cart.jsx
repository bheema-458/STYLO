import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api";
import "./Cart.css";

const BACKEND_URL = "http://127.0.0.1:8000";

const FREE_SHIPPING_LIMIT = 2000;
const SHIPPING_CHARGE = 99;
const COUPON_CODE = "STYLO10";

// ========================================
// HELPERS
// ========================================

const getImageUrl = (image) => {
  if (!image) return "";
  if (image.startsWith("http")) return image;
  if (image.startsWith("/")) return `${BACKEND_URL}${image}`;
  return `${BACKEND_URL}/${image}`;
};

const formatPrice = (price) =>
  `₹${Number(price || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const getErrorMessage = (error) => {
  const data = error?.response?.data;

  if (typeof data === "string") return data;
  if (data?.detail) return data.detail;
  if (data?.message) return data.message;
  if (data?.error) return data.error;

  if (data && typeof data === "object") {
    const firstKey = Object.keys(data)[0];
    if (firstKey) {
      const value = data[firstKey];
      if (Array.isArray(value)) return String(value[0]);
      return String(value);
    }
  }

  return "Something went wrong. Please try again.";
};

const getCartItems = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.cart_items)) return data.cart_items;
  if (Array.isArray(data?.results)) return data.results;
  return [];
};

const isValidCartItem = (item) => {
  const details = item?.variant_details || {};
  const stock = Number(details.stock ?? 0);
  const quantity = Number(item.quantity ?? 0);
  const price = Number(details.current_price ?? 0);

  if (details.is_available === false) return false;
  if (details.is_in_stock === false) return false;
  if (stock <= 0) return false;
  if (quantity < 1 || quantity > stock) return false;
  if (price <= 0) return false;

  return true;
};

// ========================================
// MEMOIZED CART ITEM ROW
// ========================================

const CartItemRow = memo(function CartItemRow({
  item,
  isUpdating,
  isRemoving,
  onStepQuantity,
  onCommitQuantity,
  onRemove,
}) {
  const details = item.variant_details || {};
  const price = Number(details.current_price || 0);
  const regularPrice = Number(details.regular_price || 0);
  const stock = Math.max(0, Number(details.stock || 0));
  const serverQty = Number(item.quantity || 1);
  const image = getImageUrl(details.image);
  const itemValid = isValidCartItem(item);

  const [draftQty, setDraftQty] = useState(String(serverQty));

  useEffect(() => {
    setDraftQty(String(serverQty));
  }, [serverQty]);

  const commitDraft = () => {
    const parsed = parseInt(draftQty, 10);

    if (Number.isNaN(parsed)) {
      setDraftQty(String(serverQty));
      return;
    }

    const clamped = Math.max(1, stock > 0 ? Math.min(parsed, stock) : parsed);
    setDraftQty(String(clamped));

    if (clamped !== serverQty) {
      onCommitQuantity(item, clamped);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      event.currentTarget.blur();
    } else if (event.key === "Escape") {
      setDraftQty(String(serverQty));
      event.currentTarget.blur();
    }
  };

  const itemSubtotal = price * serverQty;
  const busy = isUpdating || isRemoving;

  return (
    <article className="cart-item">
      {image ? (
        <img
          src={image}
          alt={details.product_name || "Product"}
          className="cart-item-image"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
      ) : (
        <div className="cart-item-image">Image unavailable</div>
      )}

      <div className="cart-item-details">
        <span className="cart-item-category">
          {details.color_name || "Fashion"}
        </span>

        <h3>{details.product_name || "Product"}</h3>

        <p>
          Size: <strong>{details.size_name || "N/A"}</strong>
        </p>

        <p>
          Color: <strong>{details.color_name || "N/A"}</strong>
        </p>

        <p>
          SKU: <strong>{details.sku || "N/A"}</strong>
        </p>

        <div className="cart-item-price">
          <strong>{formatPrice(price)}</strong>
          {regularPrice > price && <del>{formatPrice(regularPrice)}</del>}
        </div>

        <div className="cart-item-actions">
          <div className="cart-quantity">
            <button
              type="button"
              aria-label="Decrease quantity"
              disabled={busy || serverQty <= 1}
              onClick={() => onStepQuantity(item, -1)}
            >
              −
            </button>

            <input
              type="number"
              min={1}
              max={stock > 0 ? stock : undefined}
              aria-label={`Quantity for ${details.product_name || "item"}`}
              className="cart-quantity-input"
              value={draftQty}
              disabled={busy || stock <= 0}
              onChange={(event) => setDraftQty(event.target.value)}
              onBlur={commitDraft}
              onKeyDown={handleKeyDown}
            />

            <button
              type="button"
              aria-label="Increase quantity"
              disabled={busy || (stock > 0 && serverQty >= stock)}
              onClick={() => onStepQuantity(item, 1)}
            >
              +
            </button>
          </div>

          <button
            type="button"
            className="cart-remove-btn"
            disabled={busy}
            onClick={() => onRemove(item.id)}
          >
            {isRemoving ? "Removing..." : "Remove"}
          </button>
        </div>

        <p>
          {itemValid ? (
            <span>{stock} available</span>
          ) : (
            <span style={{ color: "#b04444" }}>
              Unavailable / Insufficient stock
            </span>
          )}
        </p>
      </div>

      <div className="cart-item-total">{formatPrice(itemSubtotal)}</div>
    </article>
  );
});

// ========================================
// NAVBAR COMPONENT
// ========================================

function CartNavbar({ totalItemsCount, onBack }) {
  return (
    <header className="cart-navbar">
      <div className="cart-navbar-left">
        <button
          type="button"
          className="cart-back-btn"
          onClick={onBack}
          aria-label="Go back"
        >
          <span aria-hidden="true">←</span>
          <span>Back</span>
        </button>

        <Link to="/" className="stylo-brand-logo" aria-label="STYLO Home">
          <span className="stylo-brand-mark">STYLO</span>
          <span className="stylo-brand-tag">ATELIER</span>
        </Link>
      </div>

      <nav className="cart-navbar-right" aria-label="Cart navigation">
        <Link to="/products" className="cart-nav-link">
          Collection
        </Link>
        <Link to="/cart" className="cart-nav-pill">
          Bag ({totalItemsCount})
        </Link>
      </nav>
    </header>
  );
}

// ========================================
// MAIN COMPONENT
// ========================================

function Cart() {
  const navigate = useNavigate();

  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [updatingId, setUpdatingId] = useState(null);
  const [removingId, setRemovingId] = useState(null);

  const [couponInput, setCouponInput] = useState("");
  const [couponApplied, setCouponApplied] = useState(false);
  const [couponMessage, setCouponMessage] = useState("");

  const handleBack = useCallback(() => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/products");
    }
  }, [navigate]);

  const requireLogin = useCallback(() => {
    const token = localStorage.getItem("user_access");
    if (!token) {
      navigate("/login", {
        state: { from: "/cart" },
        replace: true,
      });
      return false;
    }
    return true;
  }, [navigate]);

  const fetchCart = useCallback(
    async ({ silent = false } = {}) => {
      if (!localStorage.getItem("user_access")) {
        setCartItems([]);
        setLoading(false);
        navigate("/login", {
          state: { from: "/cart" },
          replace: true,
        });
        return;
      }

      try {
        if (!silent) setLoading(true);
        setError("");

        const response = await api.get("cart/");
        const items = getCartItems(response.data);
        setCartItems(items);
      } catch (err) {
        console.error("CART FETCH ERROR:", err);

        if (err.response?.status === 401) {
          localStorage.removeItem("user_access");
          localStorage.removeItem("user_refresh");
          navigate("/login", {
            state: { from: "/cart" },
            replace: true,
          });
          return;
        }

        if (!silent) {
          setError(getErrorMessage(err));
        } else {
          alert(getErrorMessage(err));
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [navigate]
  );

  useEffect(() => {
    fetchCart({ silent: false });
  }, [fetchCart]);

  // ========================================
  // DERIVED TOTALS
  // ========================================

  const totalItemsCount = useMemo(
    () =>
      cartItems.reduce(
        (count, item) => count + Number(item.quantity || 0),
        0
      ),
    [cartItems]
  );

  const subtotal = useMemo(
    () =>
      cartItems.reduce((total, item) => {
        const details = item.variant_details || {};
        const price = Number(details.current_price || 0);
        const quantity = Number(item.quantity || 0);
        return total + price * quantity;
      }, 0),
    [cartItems]
  );

  const invalidItems = useMemo(
    () => cartItems.filter((item) => !isValidCartItem(item)),
    [cartItems]
  );

  const hasInvalidItems = invalidItems.length > 0;

  // Client-side offer display only.
  // Backend must independently validate the first-purchase offer.
  const isFirstPurchase =
    localStorage.getItem("stylo_has_purchased") !== "true";

  const discount =
    couponApplied && isFirstPurchase && !hasInvalidItems
      ? subtotal * 0.1
      : 0;

  const shipping =
    subtotal === 0 || subtotal >= FREE_SHIPPING_LIMIT
      ? 0
      : SHIPPING_CHARGE;

  const total = Math.max(0, subtotal - discount + shipping);

  const amountForFreeShipping = Math.max(
    0,
    FREE_SHIPPING_LIMIT - subtotal
  );

  const canCheckout =
    cartItems.length > 0 &&
    !hasInvalidItems &&
    !loading &&
    !updatingId &&
    !removingId;

  // ========================================
  // QUANTITY & ITEM MUTATIONS
  // ========================================

  const commitQuantity = useCallback(
    async (item, nextQuantity) => {
      if (!requireLogin()) return;

      const stock = Number(item.variant_details?.stock || 0);
      const currentQuantity = Number(item.quantity || 1);

      if (nextQuantity < 1 || nextQuantity === currentQuantity) return;

      if (stock > 0 && nextQuantity > stock) {
        alert(`Only ${stock} items are available.`);
        return;
      }

      try {
        setUpdatingId(item.id);
        setError("");

        await api.patch(`cart/items/${item.id}/`, {
          quantity: nextQuantity,
        });

        setCartItems((prev) =>
          prev.map((row) =>
            row.id === item.id ? { ...row, quantity: nextQuantity } : row
          )
        );
      } catch (err) {
        console.error("QUANTITY UPDATE ERROR:", err);
        alert(getErrorMessage(err));
        await fetchCart({ silent: true });
      } finally {
        setUpdatingId(null);
      }
    },
    [fetchCart, requireLogin]
  );

  const stepQuantity = useCallback(
    (item, delta) => {
      const nextQuantity = Number(item.quantity || 1) + delta;
      commitQuantity(item, nextQuantity);
    },
    [commitQuantity]
  );

  const removeItem = useCallback(
    async (itemId) => {
      if (!requireLogin()) return;

      try {
        setRemovingId(itemId);
        setError("");

        await api.delete(`cart/items/${itemId}/`);

        setCartItems((previous) =>
          previous.filter((item) => item.id !== itemId)
        );
      } catch (err) {
        console.error("REMOVE CART ITEM ERROR:", err);
        alert(getErrorMessage(err));
      } finally {
        setRemovingId(null);
      }
    },
    [requireLogin]
  );

  // ========================================
  // COUPON & CHECKOUT
  // ========================================

  const applyCoupon = () => {
    const enteredCode = couponInput.trim().toUpperCase();

    if (!enteredCode) {
      setCouponMessage("Please enter a coupon code.");
      return;
    }

    if (enteredCode !== COUPON_CODE) {
      setCouponApplied(false);
      setCouponMessage("Invalid coupon code.");
      return;
    }

    if (!isFirstPurchase) {
      setCouponApplied(false);
      setCouponMessage(
        "This coupon is available only on your first purchase."
      );
      return;
    }

    if (subtotal <= 0) {
      setCouponMessage("Your cart is empty.");
      return;
    }

    if (hasInvalidItems) {
      setCouponMessage("Please resolve unavailable products first.");
      return;
    }

    setCouponApplied(true);
    setCouponMessage("Congratulations! 10% discount applied.");
  };

  const removeCoupon = () => {
    setCouponApplied(false);
    setCouponInput("");
    setCouponMessage("");
  };

  const handleCheckout = () => {
    if (!requireLogin()) return;

    if (!canCheckout) {
      alert("Please resolve unavailable products before checkout.");
      return;
    }

    navigate("/checkout");
  };

  // ========================================
  // STATES: LOADING / ERROR / EMPTY
  // ========================================

  if (loading) {
    return (
      <main className="cart-page">
        <CartNavbar totalItemsCount={0} onBack={handleBack} />
        <div className="cart-empty">
          <h2>Loading your shopping bag...</h2>
          <p>Please wait while we fetch your cart.</p>
        </div>
      </main>
    );
  }

  if (error && cartItems.length === 0) {
    return (
      <main className="cart-page">
        <CartNavbar totalItemsCount={0} onBack={handleBack} />
        <div className="cart-empty">
          <h2>Unable to load your cart</h2>
          <p>{error}</p>
          <button
            type="button"
            className="cart-primary-btn"
            onClick={() => fetchCart({ silent: false })}
          >
            Try Again
          </button>
        </div>
      </main>
    );
  }

  if (cartItems.length === 0) {
    return (
      <main className="cart-page">
        <CartNavbar totalItemsCount={0} onBack={handleBack} />
        <div className="cart-empty">
          <div className="cart-empty-icon">♡</div>
          <span>YOUR STYLO BAG</span>
          <h1>Your cart is waiting for something beautiful</h1>
          <p>
            You haven&apos;t added anything to your shopping bag yet.
            Discover your favourite styles and make them yours.
          </p>
          <Link to="/products" className="cart-primary-btn">
            Continue Shopping
          </Link>
        </div>
      </main>
    );
  }

  // ========================================
  // MAIN CART VIEW
  // ========================================

  return (
    <main className="cart-page">
      <CartNavbar
        totalItemsCount={totalItemsCount}
        onBack={handleBack}
      />

      <div className="cart-heading">
        <span>YOUR STYLO BAG</span>
        <h1>Shopping Cart</h1>
        <p>{totalItemsCount} items in your bag</p>
      </div>

      {subtotal < FREE_SHIPPING_LIMIT ? (
        <div className="shipping-progress">
          <p>
            Add <strong>{formatPrice(amountForFreeShipping)}</strong> more to
            enjoy free shipping!
          </p>
          <div className="shipping-progress-track">
            <div
              className="shipping-progress-fill"
              style={{
                width: `${Math.min(
                  (subtotal / FREE_SHIPPING_LIMIT) * 100,
                  100
                )}%`,
              }}
            />
          </div>
        </div>
      ) : (
        <div className="free-shipping-message">
          ✓ Congratulations! Your order qualifies for free shipping.
        </div>
      )}

      {hasInvalidItems && (
        <div className="free-shipping-message">
          Some products are unavailable or have insufficient stock. Please remove
          or update those items before checkout.
        </div>
      )}

      {error && (
        <p role="alert" className="coupon-error">
          {error}
        </p>
      )}

      <div className="cart-layout">
        <section className="cart-items-section">
          <div className="cart-section-title">
            <h2>Your Items</h2>
            <span>{cartItems.length} products</span>
          </div>

          {cartItems.map((item) => (
            <CartItemRow
              key={item.id}
              item={item}
              isUpdating={updatingId === item.id}
              isRemoving={removingId === item.id}
              onStepQuantity={stepQuantity}
              onCommitQuantity={commitQuantity}
              onRemove={removeItem}
            />
          ))}

          <Link to="/products" className="cart-continue-link">
            ← Continue Shopping
          </Link>
        </section>

        <aside className="cart-summary">
          <h2>Order Summary</h2>

          <div className="coupon-box">
            <h3>Have a coupon?</h3>
            <p>Get 10% off on your first purchase with STYLO10.</p>

            {couponApplied ? (
              <div className="coupon-applied">
                <span>✓ STYLO10 applied</span>
                <button type="button" onClick={removeCoupon}>
                  Remove
                </button>
              </div>
            ) : (
              <div className="coupon-input-row">
                <input
                  type="text"
                  placeholder="Enter coupon code"
                  value={couponInput}
                  onChange={(event) => setCouponInput(event.target.value)}
                />
                <button type="button" onClick={applyCoupon}>
                  Apply
                </button>
              </div>
            )}

            {couponMessage && (
              <p
                className={
                  couponApplied ? "coupon-success" : "coupon-error"
                }
              >
                {couponMessage}
              </p>
            )}

            {!isFirstPurchase && (
              <p className="coupon-note">
                First-purchase offer has already been used.
              </p>
            )}
          </div>

          <div className="summary-line">
            <span>Subtotal</span>
            <span>{formatPrice(subtotal)}</span>
          </div>

          <div className="summary-line">
            <span>Discount</span>
            <span className="discount-value">−{formatPrice(discount)}</span>
          </div>

          <div className="summary-line">
            <span>Shipping</span>
            <span>{shipping === 0 ? "FREE" : formatPrice(shipping)}</span>
          </div>

          <div className="summary-divider" />

          <div className="summary-total">
            <strong>Total</strong>
            <strong>{formatPrice(total)}</strong>
          </div>

          <p className="tax-note">
            Shipping charges are included in the total.
          </p>

          <button
            type="button"
            className="checkout-btn"
            onClick={handleCheckout}
            disabled={!canCheckout}
          >
            {hasInvalidItems
              ? "Resolve Cart Items"
              : "Proceed to Checkout →"}
          </button>

          <div className="cart-trust">
            <p>✓ Secure checkout</p>
            <p>✓ Quality fashion collections</p>
            <p>✓ Customer support available</p>
          </div>
        </aside>
      </div>
    </main>
  );
}

export default Cart;