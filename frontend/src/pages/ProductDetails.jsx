
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Heart,
  ShoppingBag,
  Minus,
  Plus,
  Truck,
  ShieldCheck,
  RotateCcw,
  ChevronRight,
  Check,
  LoaderCircle,
} from "lucide-react";
import userApi from "../api";
import "./ProductDetails.css";

const BACKEND_URL = "http://127.0.0.1:8000";

function getImageUrl(value) {
  if (!value) return "";

  let image = value;

  if (typeof image === "object") {
    image =
      image.image_url ||
      image.url ||
      image.image ||
      image.imageUrl ||
      "";
  }

  if (typeof image !== "string" || !image.trim()) return "";

  if (
    image.startsWith("http://") ||
    image.startsWith("https://") ||
    image.startsWith("data:")
  ) {
    return image;
  }

  return `${BACKEND_URL}${image.startsWith("/") ? "" : "/"}${image}`;
}

function formatPrice(value) {
  const amount = Number(value || 0);

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

function ProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [product, setProduct] = useState(null);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [selectedImage, setSelectedImage] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [addingCart, setAddingCart] = useState(false);
  const [addingWishlist, setAddingWishlist] = useState(false);
  const [activeTab, setActiveTab] = useState("description");
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [error, setError] = useState("");

  const variants = useMemo(() => {
    return (product?.variants || []).filter(
      (variant) => variant.is_active
    );
  }, [product]);

  const productImages = useMemo(() => {
    const images = (product?.images || [])
      .map((item) => ({
        id: item.id,
        url: getImageUrl(item.image_url || item.image),
        isPrimary: item.is_primary,
        alt: item.alt_text || product?.name || "Product image",
        variantId: item.variant,
      }))
      .filter((item) => item.url);

    return images.sort(
      (a, b) => Number(b.isPrimary) - Number(a.isPrimary)
    );
  }, [product]);

  const selectedColor = selectedVariant?.color;
  const selectedSize = selectedVariant?.size;

  const availableSizes = useMemo(() => {
    if (!selectedColor) return variants;

    return variants.filter(
      (variant) => variant.color === selectedColor
    );
  }, [variants, selectedColor]);

  const currentPrice = Number(
    selectedVariant?.current_price ?? 0
  );

  const regularPrice = Number(
    selectedVariant?.regular_price ?? currentPrice
  );

  const discount = Number(
    selectedVariant?.discount_percentage ?? 0
  );

  const stock = Number(selectedVariant?.stock ?? 0);

  const isInStock =
    Boolean(selectedVariant) &&
    selectedVariant.is_in_stock === true &&
    stock > 0;

  const subtotal = currentPrice * quantity;

  const variantImage = getImageUrl(selectedVariant?.image_url);

  const activeImage =
    selectedImage ||
    variantImage ||
    productImages[0]?.url ||
    "";

  const galleryImages = useMemo(() => {
    const images = [...productImages];

    if (variantImage && !images.some((item) => item.url === variantImage)) {
      images.unshift({
        id: `variant-${selectedVariant?.id}`,
        url: variantImage,
        isPrimary: false,
        alt: `${product?.name || "Product"} selected variant`,
      });
    }

    return images;
  }, [productImages, variantImage, selectedVariant, product]);

  const fetchProduct = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await userApi.get(
        `customer/products/${id}/`
      );

      const data = response.data?.product || response.data;

      setProduct(data);

      const activeVariants = (data.variants || []).filter(
        (variant) => variant.is_active
      );

      const firstVariant =
        activeVariants.find(
          (variant) =>
            variant.is_in_stock && Number(variant.stock) > 0
        ) || activeVariants[0] || null;

      setSelectedVariant(firstVariant);

      const images = (data.images || [])
        .map((item) => getImageUrl(item.image_url || item.image))
        .filter(Boolean);

      const firstImage =
        firstVariant?.image_url
          ? getImageUrl(firstVariant.image_url)
          : images[0] || "";

      setSelectedImage(firstImage);
      setQuantity(1);
    } catch (err) {
      console.error("PRODUCT DETAILS ERROR:", err.response?.data || err);
      setError(
        err.response?.data?.detail ||
          "Unable to load this product. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchProduct();
  }, [fetchProduct]);

  useEffect(() => {
    setQuantity(1);
  }, [selectedVariant?.id]);

  const requireLogin = () => {
    const token = localStorage.getItem("user_access");

    if (!token) {
      navigate("/login", {
        state: { from: `/products/${id}` },
      });
      return false;
    }

    return true;
  };

  const chooseColor = (colorId) => {
    const matchingVariants = variants.filter(
      (variant) => variant.color === colorId
    );

    const nextVariant =
      matchingVariants.find(
        (variant) =>
          variant.size === selectedSize &&
          variant.is_in_stock &&
          Number(variant.stock) > 0
      ) ||
      matchingVariants.find(
        (variant) =>
          variant.is_in_stock && Number(variant.stock) > 0
      ) ||
      matchingVariants[0];

    if (nextVariant) {
      setSelectedVariant(nextVariant);

      const nextImage = getImageUrl(nextVariant.image_url);
      if (nextImage) setSelectedImage(nextImage);
    }
  };

  const chooseSize = (variant) => {
    setSelectedVariant(variant);

    const nextImage = getImageUrl(variant.image_url);
    if (nextImage) {
      setSelectedImage(nextImage);
    } else if (productImages.length > 0) {
      setSelectedImage(productImages[0].url);
    }
  };

  const colors = useMemo(() => {
    const uniqueColors = new Map();

    variants.forEach((variant) => {
      if (!uniqueColors.has(variant.color)) {
        uniqueColors.set(variant.color, variant);
      }
    });

    return Array.from(uniqueColors.values());
  }, [variants]);

  const handleAddToCart = async () => {
    if (!requireLogin()) return;

    if (!selectedVariant) {
      alert("Please select a product size and color.");
      return;
    }

    if (!isInStock) {
      alert("This variant is currently out of stock.");
      return;
    }

    if (quantity > stock) {
      alert(`Only ${stock} item(s) are available.`);
      return;
    }

    try {
      setAddingCart(true);

      await userApi.post("cart/items/", {
        variant: Number(selectedVariant.id),
        quantity: Number(quantity),
      });

      alert("Product added to your cart successfully!");
    } catch (err) {
      console.error("ADD TO CART ERROR:", err.response?.data || err);

      const message =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        "Unable to add this product to cart.";

      alert(
        typeof message === "string"
          ? message
          : "Please check the selected size, color and stock."
      );
    } finally {
      setAddingCart(false);
    }
  };

  const handleWishlist = async () => {
    if (!requireLogin()) return;

    try {
      setAddingWishlist(true);

      await userApi.post("wishlist/items/", {
        product_id: Number(product.id),
      });

      setIsWishlisted(true);
      alert("Product added to your wishlist!");
    } catch (err) {
      console.error("WISHLIST ERROR:", err.response?.data || err);

      const message =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        "Unable to update wishlist.";

      alert(typeof message === "string" ? message : "Wishlist update failed.");
    } finally {
      setAddingWishlist(false);
    }
  };

  if (loading) {
    return (
      <div className="pd-loading">
        <LoaderCircle className="pd-spinner" size={36} />
        <p>Loading product details...</p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="pd-error">
        <h2>Product unavailable</h2>
        <p>{error || "This product could not be found."}</p>
        <Link to="/home" className="pd-primary-link">
          Continue Shopping
        </Link>
      </div>
    );
  }

  const highlights = Array.isArray(product.highlights)
    ? product.highlights
    : [];

  return (
    <main className="pd-page">
      <div className="pd-container">
        <nav className="pd-breadcrumb">
          <Link to="/home">Home</Link>
          <ChevronRight size={15} />
          <span>{product.category_name || "Fashion"}</span>
          <ChevronRight size={15} />
          <strong>{product.name}</strong>
        </nav>

        <section className="pd-main">
          <div className="pd-gallery">
            <div className="pd-thumbnails">
              {galleryImages.map((image, index) => (
                <button
                  type="button"
                  key={image.id ?? index}
                  className={`pd-thumbnail ${
                    activeImage === image.url ? "active" : ""
                  }`}
                  onClick={() => setSelectedImage(image.url)}
                  aria-label={`View product image ${index + 1}`}
                >
                  <img src={image.url} alt={image.alt} />
                </button>
              ))}
            </div>

            <div className="pd-main-image">
              {activeImage ? (
                <img
                  src={activeImage}
                  alt={product.name}
                  onError={(event) => {
                    event.currentTarget.style.display = "none";
                  }}
                />
              ) : (
                <div className="pd-no-image">
                  <ShoppingBag size={48} />
                  <span>Image not available</span>
                </div>
              )}

              {discount > 0 && (
                <span className="pd-discount-badge">
                  {discount}% OFF
                </span>
              )}
            </div>
          </div>

          <div className="pd-information">
            <div className="pd-brand">
              {product.brand || "STYLO COLLECTION"}
            </div>

            <h1>{product.name}</h1>

            <p className="pd-category">
              {product.category_name || "Women's Fashion"}
            </p>

            <div className="pd-price-section">
              <strong className="pd-current-price">
                {formatPrice(currentPrice)}
              </strong>

              {regularPrice > currentPrice && (
                <>
                  <del>{formatPrice(regularPrice)}</del>
                  <span className="pd-save">
                    Save {discount}%
                  </span>
                </>
              )}
            </div>

            <p className="pd-tax-note">
              Inclusive of applicable taxes
            </p>

            <div className="pd-divider" />

            {colors.length > 0 && (
              <div className="pd-option-group">
                <div className="pd-option-heading">
                  <strong>Color</strong>
                  <span>
                    {selectedVariant?.color_name || "Select color"}
                  </span>
                </div>

                <div className="pd-color-options">
                  {colors.map((variant) => (
                    <button
                      type="button"
                      key={variant.color}
                      className={`pd-color-button ${
                        selectedColor === variant.color ? "selected" : ""
                      }`}
                      onClick={() => chooseColor(variant.color)}
                      title={variant.color_name}
                      aria-label={variant.color_name}
                    >
                      <span
                        style={{
                          backgroundColor: variant.color_hex || "#dddddd",
                        }}
                      />
                      {selectedColor === variant.color && (
                        <Check size={13} />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {availableSizes.length > 0 && (
              <div className="pd-option-group">
                <div className="pd-option-heading">
                  <strong>Select Size</strong>
                  <span>{selectedVariant?.size_name || ""}</span>
                </div>

                <div className="pd-size-options">
                  {availableSizes
                    .slice()
                    .sort(
                      (a, b) =>
                        Number(a.size_display_order || 0) -
                        Number(b.size_display_order || 0)
                    )
                    .map((variant) => {
                      const available =
                        variant.is_in_stock &&
                        Number(variant.stock) > 0;

                      return (
                        <button
                          type="button"
                          key={variant.id}
                          disabled={!available}
                          className={`pd-size-button ${
                            selectedVariant?.id === variant.id
                              ? "selected"
                              : ""
                          } ${!available ? "out-of-stock" : ""}`}
                          onClick={() => chooseSize(variant)}
                        >
                          {variant.size_name}
                        </button>
                      );
                    })}
                </div>
              </div>
            )}

            <div className="pd-stock">
              {isInStock ? (
                <span className="pd-stock-available">
                  <Check size={16} /> In Stock ({stock} available)
                </span>
              ) : (
                <span className="pd-stock-unavailable">
                  Currently Out of Stock
                </span>
              )}
            </div>

            <div className="pd-quantity-row">
              <strong>Quantity</strong>

              <div className="pd-quantity-control">
                <button
                  type="button"
                  disabled={quantity <= 1}
                  onClick={() =>
                    setQuantity((previous) => Math.max(1, previous - 1))
                  }
                  aria-label="Decrease quantity"
                >
                  <Minus size={16} />
                </button>

                <span>{quantity}</span>

                <button
                  type="button"
                  disabled={!isInStock || quantity >= stock}
                  onClick={() =>
                    setQuantity((previous) =>
                      Math.min(stock, previous + 1)
                    )
                  }
                  aria-label="Increase quantity"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>

            <div className="pd-subtotal">
              <span>Subtotal</span>
              <strong>{formatPrice(subtotal)}</strong>
            </div>

            <div className="pd-actions">
              <button
                type="button"
                className="pd-add-cart"
                onClick={handleAddToCart}
                disabled={!isInStock || addingCart}
              >
                {addingCart ? (
                  <LoaderCircle className="pd-button-spinner" size={19} />
                ) : (
                  <ShoppingBag size={19} />
                )}
                {addingCart ? "Adding..." : "Add to Cart"}
              </button>

              <button
                type="button"
                className={`pd-wishlist ${
                  isWishlisted ? "wishlisted" : ""
                }`}
                onClick={handleWishlist}
                disabled={addingWishlist}
                aria-label="Add to wishlist"
              >
                {addingWishlist ? (
                  <LoaderCircle className="pd-button-spinner" size={20} />
                ) : (
                  <Heart
                    size={20}
                    fill={isWishlisted ? "currentColor" : "none"}
                  />
                )}
              </button>
            </div>

            <div className="pd-benefits">
              <div>
                <Truck size={21} />
                <span>
                  <strong>Delivery</strong>
                  <small>Delivery details at checkout</small>
                </span>
              </div>

              <div>
                <ShieldCheck size={21} />
                <span>
                  <strong>Secure Shopping</strong>
                  <small>Safe and secure checkout</small>
                </span>
              </div>

              <div>
                <RotateCcw size={21} />
                <span>
                  <strong>Easy Support</strong>
                  <small>Contact us for assistance</small>
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="pd-details-section">
          <div className="pd-tabs">
            <button
              type="button"
              className={activeTab === "description" ? "active" : ""}
              onClick={() => setActiveTab("description")}
            >
              Description
            </button>

            <button
              type="button"
              className={activeTab === "details" ? "active" : ""}
              onClick={() => setActiveTab("details")}
            >
              Product Details
            </button>

            <button
              type="button"
              className={activeTab === "care" ? "active" : ""}
              onClick={() => setActiveTab("care")}
            >
              Care Instructions
            </button>
          </div>

          <div className="pd-tab-content">
            {activeTab === "description" && (
              <div>
                <h3>About this product</h3>
                <p>
                  {product.description ||
                    "Discover this beautiful addition to your wardrobe from STYLO."}
                </p>

                {highlights.length > 0 && (
                  <>
                    <h3>Product Highlights</h3>
                    <ul className="pd-highlights">
                      {highlights.map((item, index) => (
                        <li key={index}>
                          <Check size={16} />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}

            {activeTab === "details" && (
              <div className="pd-specifications">
                <h3>Product Specifications</h3>

                <div>
                  <span>Product</span>
                  <strong>{product.name}</strong>
                </div>

                <div>
                  <span>Brand</span>
                  <strong>{product.brand || "STYLO"}</strong>
                </div>

                <div>
                  <span>Category</span>
                  <strong>{product.category_name || "Fashion"}</strong>
                </div>

                <div>
                  <span>Material</span>
                  <strong>{product.material || "Not specified"}</strong>
                </div>

                <div>
                  <span>Selected Color</span>
                  <strong>{selectedVariant?.color_name || "—"}</strong>
                </div>

                <div>
                  <span>Selected Size</span>
                  <strong>{selectedVariant?.size_name || "—"}</strong>
                </div>
              </div>
            )}

            {activeTab === "care" && (
              <div>
                <h3>Care Instructions</h3>
                <p>
                  {product.care_instructions ||
                    "Please follow the garment care label for the best results."}
                </p>
              </div>
            )}
          </div>
        </section>

        <div className="pd-continue">
          <Link to="/home">Continue Shopping</Link>
        </div>
      </div>
    </main>
  );
}

export default ProductDetails;
