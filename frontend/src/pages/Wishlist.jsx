
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api";
import "./Wishlist.css";

const BACKEND_URL = "http://127.0.0.1:8000";

function getImageUrl(image) {
    if (!image) return "";

    const url =
        typeof image === "string"
            ? image
            : image.url || image.image || image.image_url || "";

    if (!url) return "";

    if (url.startsWith("http")) return url;

    return `${BACKEND_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

function getErrorMessage(error) {
    const data = error.response?.data;

    if (!data) return "Something went wrong. Please try again.";
    if (typeof data === "string") return data;
    if (data.detail) return data.detail;
    if (data.message) return data.message;

    const firstError = Object.values(data)[0];

    if (Array.isArray(firstError)) return String(firstError[0]);
    if (typeof firstError === "string") return firstError;

    return "Something went wrong. Please try again.";
}

function getProduct(item) {
    return (
        item.product_details ||
        (typeof item.product === "object" ? item.product : null) ||
        item.product_data ||
        null
    );
}

function getVariants(product) {
    return Array.isArray(product?.variants) ? product.variants : [];
}

function getVariantSize(variant) {
    if (typeof variant.size === "object") {
        return variant.size?.name || variant.size?.size_name || "";
    }

    return variant.size_name || variant.size || "";
}

function getVariantColor(variant) {
    if (typeof variant.color === "object") {
        return variant.color?.name || variant.color?.color_name || "";
    }

    return variant.color_name || variant.color || "";
}

function isVariantAvailable(variant) {
    return (
        variant.is_active !== false &&
        variant.is_in_stock !== false &&
        Number(variant.stock ?? 0) > 0
    );
}

function getVariantPrice(variant) {
    return (
        variant?.current_price ??
        variant?.sale_price ??
        variant?.regular_price ??
        null
    );
}

function formatPrice(price) {
    if (price === null || price === undefined || price === "") {
        return "Price unavailable";
    }

    return `₹${Number(price).toLocaleString("en-IN")}`;
}

function Wishlist() {
    const navigate = useNavigate();

    const [wishlist, setWishlist] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [selectedSizes, setSelectedSizes] = useState({});
    const [selectedColors, setSelectedColors] = useState({});

    const [removingId, setRemovingId] = useState(null);
    const [addingCartId, setAddingCartId] = useState(null);

    const [message, setMessage] = useState("");
    const [actionError, setActionError] = useState("");

    const redirectToLogin = useCallback(() => {
        navigate("/login", {
            state: {
                from: { pathname: "/wishlist" },
            },
            replace: true,
        });
    }, [navigate]);

    const fetchWishlist = useCallback(async () => {
        if (!localStorage.getItem("user_access")) {
            redirectToLogin();
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError("");

            const response = await api.get("wishlist/");
            const data = response.data;

            const items = Array.isArray(data)
                ? data
                : Array.isArray(data?.items)
                    ? data.items
                    : Array.isArray(data?.results)
                        ? data.results
                        : [];

            const formattedItems = items
                .map((item) => ({
                    id: item.id,
                    product: getProduct(item),
                }))
                .filter((item) => item.id && item.product);

            setWishlist(formattedItems);

            const sizes = {};
            const colors = {};

            formattedItems.forEach(({ id, product }) => {
                const variants = getVariants(product);
                const available = variants.filter(isVariantAvailable);

                if (available.length > 0) {
                    sizes[id] = getVariantSize(available[0]);
                    colors[id] = getVariantColor(available[0]);
                } else {
                    sizes[id] = "";
                    colors[id] = "";
                }
            });

            setSelectedSizes(sizes);
            setSelectedColors(colors);
        } catch (err) {
            console.error("Wishlist fetch error:", err);

            if (err.response?.status === 401) {
                redirectToLogin();
            } else {
                setError(getErrorMessage(err));
            }
        } finally {
            setLoading(false);
        }
    }, [redirectToLogin]);

    useEffect(() => {
        fetchWishlist();
    }, [fetchWishlist]);

    const getAvailableOptions = (variants, type) => {
        const values = variants
            .filter(isVariantAvailable)
            .map((variant) =>
                type === "size"
                    ? getVariantSize(variant)
                    : getVariantColor(variant)
            )
            .filter(Boolean);

        return [...new Set(values)];
    };

    const findSelectedVariant = (product, itemId) => {
        const variants = getVariants(product);
        const size = selectedSizes[itemId];
        const color = selectedColors[itemId];

        return variants.find((variant) => {
            const sizeMatches =
                !getAvailableOptions(variants, "size").length ||
                getVariantSize(variant) === size;

            const colorMatches =
                !getAvailableOptions(variants, "color").length ||
                getVariantColor(variant) === color;

            return (
                sizeMatches &&
                colorMatches &&
                isVariantAvailable(variant)
            );
        });
    };

    const handleSizeChange = (itemId, value) => {
        setSelectedSizes((prev) => ({
            ...prev,
            [itemId]: value,
        }));

        setMessage("");
        setActionError("");
    };

    const handleColorChange = (itemId, value) => {
        setSelectedColors((prev) => ({
            ...prev,
            [itemId]: value,
        }));

        setMessage("");
        setActionError("");
    };

    const handleRemove = async (itemId) => {
        if (!itemId || removingId !== null) return;

        try {
            setRemovingId(itemId);
            setMessage("");
            setActionError("");

            const response = await api.delete(
                `wishlist/items/${itemId}/`
            );

            setWishlist((prev) =>
                prev.filter((item) => item.id !== itemId)
            );

            setMessage(
                response.data?.message ||
                "Product removed from your wishlist."
            );
        } catch (err) {
            console.error("Remove wishlist error:", err);

            if (err.response?.status === 401) {
                redirectToLogin();
            } else {
                setActionError(getErrorMessage(err));
            }
        } finally {
            setRemovingId(null);
        }
    };

    const handleAddToCart = async (item) => {
        const variant = findSelectedVariant(item.product, item.id);

        if (!variant) {
            setActionError(
                "Please select an available size and color."
            );
            return;
        }

        try {
            setAddingCartId(item.id);
            setMessage("");
            setActionError("");

            const response = await api.post("cart/items/", {
                variant: Number(variant.id),
                quantity: 1,
            });

            setMessage(
                response.data?.message ||
                "Product added to your cart successfully."
            );

            // Remove from wishlist only after successful cart addition.
           setWishlist((prev) =>
    prev.filter((saved) => saved.id !== item.id)
);
        } catch (err) {
            console.error("Add to cart error:", err);

            if (err.response?.status === 401) {
                redirectToLogin();
            } else {
                setActionError(getErrorMessage(err));
            }
        } finally {
            setAddingCartId(null);
        }
    };

    const getProductImages = (product) => {
        const images = [];

        if (product.primary_image) {
            images.push(product.primary_image);
        }

        if (product.image) {
            images.push(product.image);
        }

        if (Array.isArray(product.images)) {
            images.push(
                ...product.images
                    .slice()
                    .sort(
                        (a, b) =>
                            Number(Boolean(b.is_primary)) -
                            Number(Boolean(a.is_primary))
                    )
            );
        }

        const unique = [];

        images.forEach((image) => {
            const url = getImageUrl(image);

            if (url && !unique.includes(url)) {
                unique.push(url);
            }
        });

        return unique;
    };

    if (loading) {
        return (
            <div className="wishlist-loading">
                <div className="wishlist-spinner"></div>
                <p>Preparing your favourites...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="wishlist-page">
                <div className="wishlist-error-box">
                    <h2>Unable to load your wishlist</h2>
                    <p>{error}</p>
                    <button onClick={fetchWishlist}>
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    if (wishlist.length === 0) {
        return (
            <div className="wishlist-page">
                <div className="wishlist-empty">
                    <div className="wishlist-empty-heart">♡</div>
                    <span className="wishlist-eyebrow">
                        YOUR PERSONAL COLLECTION
                    </span>
                    <h1>Your Wishlist is Empty</h1>
                    <p>
                        Save the pieces you love and keep your favourite
                        styles close at hand.
                    </p>
                    <Link to="/products" className="wishlist-shop-btn">
                        Explore Collection
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="wishlist-page">
            <div className="wishlist-container">

                <div className="wishlist-top">
                    <div>
                        <span className="wishlist-eyebrow">
                            YOUR PERSONAL COLLECTION
                        </span>
                        <h1>My Wishlist <span>♡</span></h1>
                        <p>
                            A little collection of things you love.
                        </p>
                    </div>

                    <Link
                        to="/products"
                        className="wishlist-continue"
                    >
                        Continue Shopping →
                    </Link>
                </div>

                <div className="wishlist-summary">
                    <span>
                        {wishlist.length} saved{" "}
                        {wishlist.length === 1 ? "item" : "items"}
                    </span>
                    <span>CURATED WITH LOVE</span>
                </div>

                {message && (
                    <div className="wishlist-message success" role="status">
                        ✓ {message}
                    </div>
                )}

                {actionError && (
                    <div className="wishlist-message error" role="alert">
                        {actionError}
                    </div>
                )}

                <div className="wishlist-grid">
                    {wishlist.map(({ id, product }) => {
                        const variants = getVariants(product);
                        const sizes = getAvailableOptions(variants, "size");
                        const colors = getAvailableOptions(variants, "color");

                        const selectedVariant =
                            findSelectedVariant(product, id);

                        const images = getProductImages(product);
                        const price = getVariantPrice(selectedVariant) ??
                            product.price_from ??
                            product.current_price ??
                            product.sale_price ??
                            product.regular_price;

                        const regularPrice =
                            selectedVariant?.regular_price ??
                            product.regular_price ??
                            null;

                        const available = variants.some(isVariantAvailable);

                        const category =
                            product.category_name ||
                            product.category?.name ||
                            "Fashion";

                        return (
                            <WishlistCard
                                key={id}
                                id={id}
                                product={product}
                                images={images}
                                category={category}
                                variants={variants}
                                sizes={sizes}
                                colors={colors}
                                selectedSize={selectedSizes[id] || ""}
                                selectedColor={selectedColors[id] || ""}
                                selectedVariant={selectedVariant}
                                price={price}
                                regularPrice={regularPrice}
                                available={available}
                                removing={removingId === id}
                                adding={addingCartId === id}
                                onSizeChange={handleSizeChange}
                                onColorChange={handleColorChange}
                                onRemove={handleRemove}
                                onAddToCart={handleAddToCart}
                            />
                        );
                    })}
                </div>

                <div className="wishlist-bottom">
                    <p>Find your style. Love your choices.</p>
                    <Link to="/products">Discover More Pieces →</Link>
                </div>
            </div>
        </div>
    );
}

function WishlistCard({
    id,
    product,
    images,
    category,
    variants,
    sizes,
    colors,
    selectedSize,
    selectedColor,
    selectedVariant,
    price,
    regularPrice,
    available,
    removing,
    adding,
    onSizeChange,
    onColorChange,
    onRemove,
    onAddToCart,
}) {
    const [imageIndex, setImageIndex] = useState(0);

    const imageUrl = images[imageIndex] || "";

    const discount =
        regularPrice && price && Number(regularPrice) > Number(price)
            ? Math.round(
                ((Number(regularPrice) - Number(price)) /
                    Number(regularPrice)) * 100
            )
            : 0;

    const hasVariants = variants.length > 0;

    return (
        <article className="wishlist-card">
            <div className="wishlist-card-image">
                <Link
                    to={`/products/${product.id}`}
                    className="wishlist-image-link"
                >
                    {imageUrl ? (
                        <img
                            src={imageUrl}
                            alt={product.name || "STYLO product"}
                            onError={(event) => {
                                event.currentTarget.style.display = "none";
                            }}
                        />
                    ) : (
                        <div className="wishlist-image-placeholder">
                            STYLO
                        </div>
                    )}
                </Link>

                {discount > 0 && (
                    <span className="wishlist-discount">
                        {discount}% OFF
                    </span>
                )}

                <button
                    type="button"
                    className="wishlist-remove-btn"
                    title="Remove from wishlist"
                    aria-label="Remove from wishlist"
                    disabled={removing}
                    onClick={() => onRemove(id)}
                >
                    {removing ? "..." : "♥"}
                </button>

                {images.length > 1 && (
                    <div className="wishlist-image-controls">
                        <button
                            type="button"
                            aria-label="Previous image"
                            onClick={() =>
                                setImageIndex((prev) =>
                                    (prev - 1 + images.length) % images.length
                                )
                            }
                        >
                            ‹
                        </button>
                        <span>
                            {imageIndex + 1} / {images.length}
                        </span>
                        <button
                            type="button"
                            aria-label="Next image"
                            onClick={() =>
                                setImageIndex((prev) =>
                                    (prev + 1) % images.length
                                )
                            }
                        >
                            ›
                        </button>
                    </div>
                )}
            </div>

            <div className="wishlist-card-info">
                <span className="wishlist-category">{category}</span>

                <Link
                    to={`/products/${product.id}`}
                    className="wishlist-product-name"
                >
                    {product.name || "Fashion Product"}
                </Link>

                <div className="wishlist-price-row">
                    <strong>{formatPrice(price)}</strong>
                    {discount > 0 && (
                        <del>{formatPrice(regularPrice)}</del>
                    )}
                </div>

                {hasVariants ? (
                    <div className="wishlist-options">
                        {sizes.length > 0 && (
                            <div className="wishlist-option">
                                <label htmlFor={`size-${id}`}>Size</label>
                                <select
                                    id={`size-${id}`}
                                    value={selectedSize}
                                    onChange={(event) =>
                                        onSizeChange(id, event.target.value)
                                    }
                                >
                                    <option value="">Select size</option>
                                    {sizes.map((size) => (
                                        <option key={size} value={size}>
                                            {size}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {colors.length > 0 && (
                            <div className="wishlist-option">
                                <label htmlFor={`color-${id}`}>Color</label>
                                <select
                                    id={`color-${id}`}
                                    value={selectedColor}
                                    onChange={(event) =>
                                        onColorChange(id, event.target.value)
                                    }
                                >
                                    <option value="">Select color</option>
                                    {colors.map((color) => (
                                        <option key={color} value={color}>
                                            {color}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                ) : (
                    <p className="wishlist-no-variant">
                        Variant information unavailable
                    </p>
                )}

                <div className={`wishlist-stock ${available ? "in-stock" : "out-stock"}`}>
                    <span className="stock-dot"></span>
                    {available ? "In Stock" : "Currently Unavailable"}
                </div>

                <div className="wishlist-card-actions">
                    <button
                        type="button"
                        className="wishlist-cart-btn"
                        disabled={
                            !selectedVariant ||
                            !available ||
                            adding
                        }
                        onClick={() =>
                            onAddToCart({ id, product })
                        }
                    >
                        {adding ? "Adding..." : "Add to Cart"}
                    </button>

                    <Link
                        to={`/products/${product.id}`}
                        className="wishlist-view-btn"
                    >
                        View Details
                    </Link>
                </div>
            </div>
        </article>
    );
}

export default Wishlist;
