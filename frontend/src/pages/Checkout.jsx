
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  MapPin,
  Plus,
  Pencil,
  ShoppingBag,
  Truck,
  ShieldCheck,
  CreditCard,
  CheckCircle,
  Loader2,
  ArrowLeft,
  Smartphone,
  Trash2,
} from "lucide-react";

import userApi from "../api";
import Navbar from "../components/Navbar";
import "./Checkout.css";

const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";

    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);

    document.body.appendChild(script);
  });
};

const emptyAddress = {
  full_name: "",
  phone_number: "",
  address_line: "",
  city: "",
  state: "",
  pincode: "",
  is_default: false,
};

function Checkout() {
  const navigate = useNavigate();

  const [cartItems, setCartItems] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(null);

  // Address entered without saving to address book
  const [temporaryAddress, setTemporaryAddress] = useState(null);

  const [addressForm, setAddressForm] = useState(emptyAddress);
  const [editingAddressId, setEditingAddressId] = useState(null);
  const [showAddressForm, setShowAddressForm] = useState(false);

  const [paymentMethod, setPaymentMethod] = useState("cod");

  const [loading, setLoading] = useState(true);
  const [placingOrder, setPlacingOrder] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [failedOrderId, setFailedOrderId] = useState(null);
  const [retryingPayment, setRetryingPayment] = useState(false);

  // -----------------------------------------
  // AUTHENTICATION
  // -----------------------------------------

  useEffect(() => {
    const token = localStorage.getItem("user_access");

    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    loadCheckoutData();
  }, []);

  // -----------------------------------------
  // LOAD CART AND ADDRESSES
  // -----------------------------------------

  const loadCheckoutData = async () => {
    try {
      setLoading(true);
      setError("");

      const [cartResponse, addressResponse] = await Promise.all([
        userApi.get("cart/"),
        userApi.get("auth/addresses/"),
      ]);

      const cartData = cartResponse.data;
      const addressData = addressResponse.data;

      const items =
        Array.isArray(cartData)
          ? cartData
          : cartData.results || cartData.items || cartData.cart_items || [];

      const savedAddresses =
        Array.isArray(addressData)
          ? addressData
          : addressData.results || addressData.addresses || [];

      setCartItems(items);
      setAddresses(savedAddresses);

      const defaultAddress =
        savedAddresses.find((address) => address.is_default) ||
        savedAddresses[0];

      if (defaultAddress) {
        setSelectedAddressId(defaultAddress.id);
      }
    } catch (err) {
      console.error(
        "CHECKOUT LOAD ERROR:",
        err.response?.data || err.message
      );

      setError("Unable to load checkout details. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // -----------------------------------------
  // PRODUCT HELPERS
  // -----------------------------------------

  const getProductName = (item) => {
    return (
      item.product_name ||
      item.product?.name ||
      item.product?.title ||
      item.name ||
      "Product"
    );
  };

  const getProductImage = (item) => {
    const image =
      item.product_image ||
      item.product?.main_image ||
      item.product?.image ||
      item.image ||
      item.variant?.image;

    if (!image) return null;

    if (typeof image === "string") {
      return image.startsWith("http")
        ? image
        : `${userApi.defaults.baseURL.replace(/\/api\/?$/, "")}${image}`;
    }

    return image.image || image.url || null;
  };

  const getProductPrice = (item) => {
    return Number(
      item.price ??
      item.product?.price ??
      item.variant?.price ??
      0
    );
  };

  const getProductQuantity = (item) => {
    return Number(item.quantity || 1);
  };

  const getProductVariant = (item) => {
    return (
      item.variant_name ||
      item.variant?.name ||
      item.size ||
      item.color ||
      ""
    );
  };

  const getProductSubtotal = (item) => {
    if (item.subtotal !== undefined) {
      return Number(item.subtotal);
    }

    return getProductPrice(item) * getProductQuantity(item);
  };

  // -----------------------------------------
  // PRICE CALCULATION
  // -----------------------------------------

  const subtotal = useMemo(() => {
    return cartItems.reduce(
      (total, item) => total + getProductSubtotal(item),
      0
    );
  }, [cartItems]);

  const shippingCharge = subtotal >= 2000 ? 0 : 99;

  const totalAmount = subtotal + shippingCharge;

  // -----------------------------------------
  // SELECTED DELIVERY ADDRESS
  // -----------------------------------------

  const savedSelectedAddress = addresses.find(
    (address) => String(address.id) === String(selectedAddressId)
  );

  const selectedAddress = temporaryAddress || savedSelectedAddress;

  // -----------------------------------------
  // ADDRESS FORM
  // -----------------------------------------

  const handleAddressChange = (event) => {
    const { name, value, type, checked } = event.target;

    setAddressForm((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const openAddAddressForm = () => {
    setEditingAddressId(null);
    setAddressForm(emptyAddress);
    setShowAddressForm(true);
    setError("");
    setSuccess("");
  };

  const openEditAddressForm = (address) => {
    setEditingAddressId(address.id);
    setTemporaryAddress(null);

    setAddressForm({
      full_name: address.full_name || "",
      phone_number: address.phone_number || "",
      address_line: address.address_line || "",
      city: address.city || "",
      state: address.state || "",
      pincode: address.pincode || "",
      is_default: Boolean(address.is_default),
    });

    setSelectedAddressId(address.id);
    setShowAddressForm(true);
    setError("");
    setSuccess("");
  };

  const resetAddressForm = () => {
    setAddressForm(emptyAddress);
    setEditingAddressId(null);
    setShowAddressForm(false);
  };

  const validateAddressForm = () => {
    if (!addressForm.full_name.trim()) {
      setError("Please enter your full name.");
      return false;
    }

    if (!/^[0-9]{10}$/.test(addressForm.phone_number.trim())) {
      setError("Please enter a valid 10-digit phone number.");
      return false;
    }

    if (!addressForm.address_line.trim()) {
      setError("Please enter your delivery address.");
      return false;
    }

    if (!addressForm.city.trim() || !addressForm.state.trim()) {
      setError("Please enter your city and state.");
      return false;
    }

    if (!/^[0-9]{6}$/.test(addressForm.pincode.trim())) {
      setError("Please enter a valid 6-digit PIN code.");
      return false;
    }

    return true;
  };

  // -----------------------------------------
  // USE ADDRESS WITHOUT SAVING
  // -----------------------------------------

  const handleUseAddressForOrder = () => {
    setError("");
    setSuccess("");

    if (!validateAddressForm()) return;

    setTemporaryAddress({
      ...addressForm,
      id: null,
      is_temporary: true,
    });

    setSelectedAddressId(null);
    setShowAddressForm(false);

    setSuccess("Delivery address selected for this order.");
  };

  // -----------------------------------------
  // SAVE ADDRESS TO ADDRESS BOOK
  // -----------------------------------------

  const refreshAddresses = async () => {
    const response = await userApi.get("auth/addresses/");

    const data = response.data;

    const savedAddresses = Array.isArray(data)
      ? data
      : data.results || data.addresses || [];

    setAddresses(savedAddresses);

    return savedAddresses;
  };

  const handleSaveAddress = async () => {
    setError("");
    setSuccess("");

    if (!validateAddressForm()) return;

    try {
      if (editingAddressId) {
        await userApi.patch(
          `auth/addresses/${editingAddressId}/`,
          addressForm
        );
      } else {
        await userApi.post("auth/addresses/", addressForm);
      }

      const updatedAddresses = await refreshAddresses();

      const updatedAddress = editingAddressId
        ? updatedAddresses.find(
            (address) => String(address.id) === String(editingAddressId)
          )
        : updatedAddresses.find(
            (address) =>
              address.full_name === addressForm.full_name &&
              address.phone_number === addressForm.phone_number &&
              address.address_line === addressForm.address_line
          );

      if (updatedAddress) {
        setSelectedAddressId(updatedAddress.id);
      }

      setTemporaryAddress(null);
      resetAddressForm();

      setSuccess("Address saved successfully.");
    } catch (err) {
      console.error(
        "SAVE ADDRESS ERROR:",
        err.response?.data || err.message
      );

      setError(
        err.response?.data?.detail ||
        "Unable to save address. Please try again."
      );
    }
  };

  // -----------------------------------------
  // SELECT SAVED ADDRESS
  // -----------------------------------------

  const handleSelectAddress = (address) => {
    setSelectedAddressId(address.id);
    setTemporaryAddress(null);
    setShowAddressForm(false);
    setError("");
    setSuccess("");
  };

  // -----------------------------------------
  // VALIDATE ORDER
  // -----------------------------------------

  const validateOrder = () => {
    if (!selectedAddress) {
      setError("Please select or enter a delivery address.");
      return false;
    }

    if (!cartItems.length) {
      setError("Your cart is empty.");
      return false;
    }

    for (const item of cartItems) {
      if (item.product?.stock !== undefined) {
        if (Number(item.quantity) > Number(item.product.stock)) {
          setError(`${getProductName(item)} has insufficient stock.`);
          return false;
        }
      }
    }

    return true;
  };

  // -----------------------------------------
  // PAYMENT FAILURE HANDLER
  // -----------------------------------------

  const recordPaymentFailure = async (orderId, reason) => {
    try {
      await userApi.post("orders/payment-failed/", {
        order_id: orderId,
        reason: reason || "Payment failed",
      });

      setFailedOrderId(orderId);
    } catch (err) {
      console.error(
        "PAYMENT FAILURE RECORD ERROR:",
        err.response?.data || err.message
      );

      setFailedOrderId(orderId);
    }
  };

  // -----------------------------------------
  // OPEN RAZORPAY CHECKOUT
  // -----------------------------------------

  const openRazorpay = async (paymentData, orderId) => {
    const loaded = await loadRazorpayScript();

    if (!loaded) {
      setError("Unable to load payment gateway. Please try again.");
      await recordPaymentFailure(orderId, "Razorpay script failed to load.");
      return;
    }

    if (!paymentData?.key_id || !paymentData?.razorpay_order_id) {
      setError("Payment information is incomplete.");
      return;
    }

    const options = {
      key: paymentData.key_id,
      amount: paymentData.amount,
      currency: paymentData.currency || "INR",
      name: "STYLO",
      description: "Fashion Order Payment",
      order_id: paymentData.razorpay_order_id,

      handler: async function (response) {
        try {
          setPlacingOrder(true);
          setError("");

          const verifyResponse = await userApi.post(
            "orders/verify-payment/",
            {
              order_id: orderId,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }
          );

          setFailedOrderId(null);

          navigate("/order-success", {
            state: {
              order: verifyResponse.data.order || verifyResponse.data,
            },
          });
        } catch (err) {
          console.error(
            "PAYMENT VERIFICATION ERROR:",
            err.response?.data || err.message
          );

          setError(
            err.response?.data?.detail ||
            "Payment verification failed. Please contact support if money was deducted."
          );

          await recordPaymentFailure(orderId, "Payment verification failed.");
        } finally {
          setPlacingOrder(false);
        }
      },

      modal: {
        ondismiss: async () => {
          await recordPaymentFailure(orderId, "Payment window closed.");
          setError("Payment was not completed. You can retry the payment.");
        },
      },

      theme: {
        color: "#176b48",
      },
    };

    const razorpay = new window.Razorpay(options);

    razorpay.on("payment.failed", async (response) => {
      await recordPaymentFailure(
        orderId,
        response.error?.description || "Payment failed"
      );

      setError(
        response.error?.description || "Payment failed. Please try again."
      );
    });

    razorpay.open();
  };

  // -----------------------------------------
  // PLACE ORDER
  // -----------------------------------------

  const handlePlaceOrder = async () => {
    setError("");
    setSuccess("");

    if (!validateOrder()) return;

    try {
      setPlacingOrder(true);

      const deliveryAddress = selectedAddress;

      const orderPayload = {
        full_name: deliveryAddress.full_name,
        phone_number: deliveryAddress.phone_number,
        address: deliveryAddress.address_line,
        city: deliveryAddress.city,
        state: deliveryAddress.state,
        pincode: deliveryAddress.pincode,
        payment_method: paymentMethod === "cod" ? "cod" : "razorpay",
      };

      const response = await userApi.post(
        "orders/checkout/",
        orderPayload
      );

      const order = response.data.order || response.data;

      if (paymentMethod === "cod") {
        navigate("/order-success", {
          state: { order },
        });

        return;
      }

      const paymentData = response.data.payment;

      if (!paymentData) {
        setError("Payment details were not returned by the server.");
        return;
      }

      await openRazorpay(paymentData, order.id);
    } catch (err) {
      console.error(
        "PLACE ORDER ERROR:",
        err.response?.data || err.message
      );

      setError(
        err.response?.data?.detail ||
        err.response?.data?.message ||
        "Unable to place your order. Please try again."
      );
    } finally {
      setPlacingOrder(false);
    }
  };

  // -----------------------------------------
  // RETRY FAILED PAYMENT
  // -----------------------------------------

  const handleRetryPayment = async () => {
    if (!failedOrderId) return;

    try {
      setRetryingPayment(true);
      setError("");

      const response = await userApi.post(
        `orders/retry-payment/${failedOrderId}/`
      );

      const paymentData = response.data.payment || response.data;

      await openRazorpay(paymentData, failedOrderId);
    } catch (err) {
      console.error(
        "RETRY PAYMENT ERROR:",
        err.response?.data || err.message
      );

      setError(
        err.response?.data?.detail ||
        "Unable to retry payment. Please try again."
      );
    } finally {
      setRetryingPayment(false);
    }
  };

  // -----------------------------------------
  // LOADING
  // -----------------------------------------

  if (loading) {
    return (
      <>
        <Navbar />

        <div className="stylo-checkout-loading">
          <Loader2 className="spin-icon" size={35} />
          <p>Preparing your checkout...</p>
        </div>
      </>
    );
  }

  // -----------------------------------------
  // EMPTY CART
  // -----------------------------------------

  if (!cartItems.length) {
    return (
      <>
        <Navbar />

        <div className="stylo-checkout-empty">
          <ShoppingBag size={55} />

          <h2>Your cart is empty</h2>

          <p>Add some beautiful products before checkout.</p>

          <button
            type="button"
            onClick={() => navigate("/")}
            className="stylo-primary-button"
          >
            Continue Shopping
          </button>
        </div>
      </>
    );
  }

  // -----------------------------------------
  // MAIN CHECKOUT UI
  // -----------------------------------------

  return (
    <>
      <Navbar />

      <main className="stylo-checkout-page">

        <div className="stylo-checkout-container">

          {/* HEADER */}

          <div className="stylo-checkout-top">

            <button
              type="button"
              className="stylo-back-button"
              onClick={() => navigate("/cart")}
            >
              <ArrowLeft size={17} />
              Back to Cart
            </button>

            <div>
              <h1>Checkout</h1>
              <p>Complete your order securely with STYLO.</p>
            </div>

          </div>

          {/* ALERTS */}

          {error && (
            <div className="stylo-checkout-error">
              {error}
            </div>
          )}

          {success && (
            <div className="stylo-checkout-success">
              <CheckCircle size={17} />
              {success}
            </div>
          )}

          <div className="stylo-checkout-grid">

            {/* LEFT SIDE */}

            <div className="stylo-checkout-left">

              {/* DELIVERY ADDRESS */}

              <section className="stylo-checkout-card">

                <div className="stylo-section-heading">
                  <div className="stylo-heading-icon">
                    <MapPin size={20} />
                  </div>

                  <div>
                    <h2>Delivery Address</h2>
                    <p>Where should we deliver your order?</p>
                  </div>
                </div>

                {/* SAVED ADDRESSES */}

                {addresses.length > 0 && (
                  <div className="stylo-address-list">

                    {addresses.map((address) => (
                      <div
                        key={address.id}
                        className={`stylo-address-card ${
                          !temporaryAddress &&
                          String(selectedAddressId) === String(address.id)
                            ? "selected"
                            : ""
                        }`}
                      >
                        <label className="stylo-address-select">

                          <input
                            type="radio"
                            name="deliveryAddress"
                            checked={
                              !temporaryAddress &&
                              String(selectedAddressId) === String(address.id)
                            }
                            onChange={() => handleSelectAddress(address)}
                          />

                          <div className="stylo-address-details">

                            <div className="stylo-address-name">
                              <strong>{address.full_name}</strong>

                              {address.is_default && (
                                <span className="stylo-default-badge">
                                  Default
                                </span>
                              )}
                            </div>

                            <p>{address.phone_number}</p>
                            <p>{address.address_line}</p>

                            <p>
                              {address.city}, {address.state} - {address.pincode}
                            </p>

                          </div>
                        </label>

                        <button
                          type="button"
                          className="stylo-edit-address-button"
                          onClick={() => openEditAddressForm(address)}
                        >
                          <Pencil size={14} />
                          Edit
                        </button>

                      </div>
                    ))}

                  </div>
                )}

                {/* TEMPORARY ADDRESS */}

                {temporaryAddress && (
                  <div className="stylo-address-card selected temporary-address-card">

                    <div className="stylo-address-details">
                      <div className="stylo-address-name">
                        <strong>{temporaryAddress.full_name}</strong>

                        <span className="stylo-temporary-badge">
                          This order only
                        </span>
                      </div>

                      <p>{temporaryAddress.phone_number}</p>
                      <p>{temporaryAddress.address_line}</p>

                      <p>
                        {temporaryAddress.city}, {temporaryAddress.state} -{" "}
                        {temporaryAddress.pincode}
                      </p>
                    </div>

                    <button
                      type="button"
                      className="stylo-edit-address-button"
                      onClick={() => {
                        setAddressForm({
                          ...temporaryAddress,
                        });
                        setEditingAddressId(null);
                        setShowAddressForm(true);
                      }}
                    >
                      <Pencil size={14} />
                      Edit
                    </button>

                  </div>
                )}

                {/* ADD ADDRESS BUTTON */}

                {!showAddressForm && (
                  <button
                    type="button"
                    className="stylo-add-address-button"
                    onClick={openAddAddressForm}
                  >
                    <Plus size={17} />
                    Add New Address
                  </button>
                )}

                {/* ADDRESS FORM */}

                {showAddressForm && (
                  <div className="stylo-address-form">

                    <h3>
                      {editingAddressId
                        ? "Edit Delivery Address"
                        : "Enter Delivery Address"}
                    </h3>

                    <div className="stylo-form-grid">

                      <div className="stylo-form-group">
                        <label>Full Name *</label>

                        <input
                          type="text"
                          name="full_name"
                          value={addressForm.full_name}
                          onChange={handleAddressChange}
                          placeholder="Enter your full name"
                        />
                      </div>

                      <div className="stylo-form-group">
                        <label>Phone Number *</label>

                        <input
                          type="tel"
                          name="phone_number"
                          maxLength="10"
                          value={addressForm.phone_number}
                          onChange={handleAddressChange}
                          placeholder="10-digit mobile number"
                        />
                      </div>

                      <div className="stylo-form-group full-width">
                        <label>Address *</label>

                        <textarea
                          name="address_line"
                          value={addressForm.address_line}
                          onChange={handleAddressChange}
                          placeholder="House name, street, area"
                          rows="3"
                        />
                      </div>

                      <div className="stylo-form-group">
                        <label>City *</label>

                        <input
                          type="text"
                          name="city"
                          value={addressForm.city}
                          onChange={handleAddressChange}
                          placeholder="City"
                        />
                      </div>

                      <div className="stylo-form-group">
                        <label>State *</label>

                        <input
                          type="text"
                          name="state"
                          value={addressForm.state}
                          onChange={handleAddressChange}
                          placeholder="State"
                        />
                      </div>

                      <div className="stylo-form-group">
                        <label>PIN Code *</label>

                        <input
                          type="text"
                          name="pincode"
                          maxLength="6"
                          value={addressForm.pincode}
                          onChange={handleAddressChange}
                          placeholder="6-digit PIN code"
                        />
                      </div>

                    </div>

                    {!editingAddressId && (
                      <label className="stylo-default-checkbox">
                        <input
                          type="checkbox"
                          name="is_default"
                          checked={addressForm.is_default}
                          onChange={handleAddressChange}
                        />
                        Save as default address
                      </label>
                    )}

                    <div className="stylo-address-form-actions">

                      {!editingAddressId && (
                        <button
                          type="button"
                          className="stylo-primary-button"
                          onClick={handleUseAddressForOrder}
                        >
                          Use for this order
                        </button>
                      )}

                      <button
                        type="button"
                        className="stylo-save-address-button"
                        onClick={handleSaveAddress}
                      >
                        {editingAddressId
                          ? "Update Address"
                          : "Save Address"}
                      </button>

                      <button
                        type="button"
                        className="stylo-secondary-button"
                        onClick={resetAddressForm}
                      >
                        Cancel
                      </button>

                    </div>

                    {!editingAddressId && (
                      <p className="stylo-address-hint">
                        You can use this address for this order without saving
                        it to your address book.
                      </p>
                    )}

                  </div>
                )}

              </section>

              {/* PAYMENT METHOD */}

              <section className="stylo-checkout-card">

                <div className="stylo-section-heading">
                  <div className="stylo-heading-icon">
                    <CreditCard size={20} />
                  </div>

                  <div>
                    <h2>Payment Method</h2>
                    <p>Choose your preferred payment method.</p>
                  </div>
                </div>

                <div className="stylo-payment-methods">

                  <label
                    className={`stylo-payment-option ${
                      paymentMethod === "cod" ? "selected" : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment"
                      value="cod"
                      checked={paymentMethod === "cod"}
                      onChange={() => setPaymentMethod("cod")}
                    />

                    <div className="stylo-payment-icon">
                      <Truck size={22} />
                    </div>

                    <div className="stylo-payment-info">
                      <strong>Cash on Delivery</strong>
                      <span>Pay when your order arrives.</span>
                    </div>

                    {paymentMethod === "cod" && (
                      <CheckCircle className="stylo-payment-check" />
                    )}
                  </label>

                  <label
                    className={`stylo-payment-option ${
                      paymentMethod === "razorpay" ? "selected" : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment"
                      value="razorpay"
                      checked={paymentMethod === "razorpay"}
                      onChange={() => setPaymentMethod("razorpay")}
                    />

                    <div className="stylo-payment-icon">
                      <Smartphone size={22} />
                    </div>

                    <div className="stylo-payment-info">
                      <strong>UPI / Online Payment</strong>
                      <span>Pay securely using Razorpay.</span>
                    </div>

                    <span className="stylo-upi-badge">Secure</span>
                  </label>

                </div>

                {paymentMethod === "razorpay" && (
                  <div className="stylo-upi-information">
                    <ShieldCheck size={18} />
                    <p>
                      You will be redirected to Razorpay's secure payment
                      window to complete your payment.
                    </p>
                  </div>
                )}

              </section>

            </div>

            {/* RIGHT SIDE - ORDER SUMMARY */}

            <aside className="stylo-order-summary">

              <div className="stylo-summary-heading">
                <ShoppingBag size={20} />
                <h2>Order Summary</h2>
              </div>

              <div className="stylo-checkout-products">

                {cartItems.map((item, index) => {
                  const image = getProductImage(item);

                  return (
                    <div
                      className="stylo-checkout-product"
                      key={item.id || item.cart_item_id || index}
                    >

                      <div className="stylo-checkout-product-image">
                        {image ? (
                          <img
                            src={image}
                            alt={getProductName(item)}
                          />
                        ) : (
                          <ShoppingBag size={25} />
                        )}
                      </div>

                      <div className="stylo-checkout-product-info">
                        <h3>{getProductName(item)}</h3>

                        {getProductVariant(item) && (
                          <p>{getProductVariant(item)}</p>
                        )}

                        <p>Qty: {getProductQuantity(item)}</p>
                      </div>

                      <div className="stylo-checkout-product-price">
                        ₹{getProductSubtotal(item).toFixed(2)}
                      </div>

                    </div>
                  );
                })}

              </div>

              <div className="stylo-summary-calculations">

                <div className="stylo-summary-row">
                  <span>Subtotal</span>
                  <strong>₹{subtotal.toFixed(2)}</strong>
                </div>

                <div className="stylo-summary-row">
                  <span>Shipping</span>

                  <strong>
                    {shippingCharge === 0
                      ? "FREE"
                      : `₹${shippingCharge.toFixed(2)}`}
                  </strong>
                </div>

                {shippingCharge === 0 && (
                  <p className="stylo-free-shipping">
                    Congratulations! You have free shipping.
                  </p>
                )}

                <div className="stylo-summary-total">
                  <span>Total Payable</span>
                  <strong>₹{totalAmount.toFixed(2)}</strong>
                </div>

              </div>

              <div className="stylo-checkout-delivery-note">
                <Truck size={18} />
                <span>Free shipping on orders above ₹2,000.</span>
              </div>

              <button
                type="button"
                className="stylo-place-order-button"
                onClick={handlePlaceOrder}
                disabled={
                  placingOrder ||
                  showAddressForm ||
                  !selectedAddress ||
                  !cartItems.length
                }
              >
                {placingOrder ? (
                  <>
                    <Loader2 className="spin-icon" size={19} />
                    Processing...
                  </>
                ) : (
                  <>
                    Place Order
                    <ArrowLeft className="place-order-arrow" size={18} />
                  </>
                )}
              </button>

              {failedOrderId && (
                <div className="stylo-payment-retry-box">
                  <h3>Payment not completed?</h3>

                  <p>
                    You can retry the payment for your existing order.
                  </p>

                  <button
                    type="button"
                    onClick={handleRetryPayment}
                    disabled={retryingPayment}
                  >
                    {retryingPayment ? (
                      <>
                        <Loader2 className="spin-icon" size={16} />
                        Retrying...
                      </>
                    ) : (
                      "Retry Payment"
                    )}
                  </button>
                </div>
              )}

              <div className="stylo-secure-checkout">
                <ShieldCheck size={17} />
                <span>Secure checkout. Your information is protected.</span>
              </div>

            </aside>

          </div>
        </div>
      </main>
    </>
  );
}

export default Checkout;