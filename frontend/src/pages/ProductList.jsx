
import { useMemo, useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../api";
import "./ProductList.css";

// =====================================
// LOCAL CATEGORY IMAGES
// =====================================

import hero from "../assets/hero.webp";

import casual from "../assets/casual.png";
import casualb from "../assets/casualb.webp";
import casualc from "../assets/casualc.webp";
import casuald from "../assets/casuald.webp";
import casuale from "../assets/casuale.webp";

import party from "../assets/party.webp";
import partya from "../assets/partya.webp";
import partyb from "../assets/partyb.webp";
import partyc from "../assets/partyc.webp";

import ethnic from "../assets/ethnic.webp";
import ethnicf from "../assets/ethnicf.webp";
import etnicb from "../assets/etnicb.webp";
import etnicc from "../assets/etnicc.webp";
import etnicd from "../assets/etnicd.webp";
import etnice from "../assets/etnice.webp";

import bag from "../assets/bag.webp";
import baga from "../assets/baga.webp";
import bagb from "../assets/bagb.webp";
import bagc from "../assets/bagc.webp";
import bagd from "../assets/bagd.webp";

import jewel from "../assets/jewel.webp";
import jewela from "../assets/jewela.webp";
import jewelc from "../assets/jewelc.webp";
import jeweld from "../assets/jeweld.webp";

import modest from "../assets/modest.png";

// =====================================
// CATEGORY DISPLAY DATA
// =====================================

const categories = [
  {
    name: "All",
    image: hero,
    images: [hero, casual, party, ethnic],
  },
  {
    name: "Casual Wear",
    image: casual,
    images: [casual, casualb, casualc, casuald, casuale],
  },
  {
    name: "Party Wear",
    image: party,
    images: [party, partya, partyb, partyc],
  },
  {
    name: "Ethnic Wear",
    image: ethnic,
    images: [ethnic, ethnicf, etnicb, etnicc, etnicd, etnice],
  },
  {
    name: "Bags",
    image: bag,
    images: [bag, baga, bagb, bagc, bagd],
  },
  {
    name: "Jewellery",
    image: jewel,
    images: [jewel, jewela, jewelc, jeweld],
  },
  {
    name: "Modest Wear",
    image: modest,
    images: [modest],
  },
  {
    name: "New Arrivals",
    image: casuale,
    images: [casuale, partyc, modest, ethnicf],
  },
];

// =====================================
// HELPERS
// =====================================

const formatPrice = (price) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(price) || 0);

const getBackendOrigin = () => {
  const baseURL =
    api.defaults?.baseURL || "http://127.0.0.1:8000/api/";

  return baseURL.replace(/\/api\/?$/, "").replace(/\/$/, "");
};

const getImageUrl = (image) => {
  if (!image) return "";

  let imageUrl = image;

  if (typeof image === "object") {
    imageUrl =
      image.image_url ||
      image.image ||
      image.url ||
      image.image_url ||
      "";
  }

  if (typeof imageUrl !== "string" || !imageUrl.trim()) {
    return "";
  }

  if (
    imageUrl.startsWith("http://") ||
    imageUrl.startsWith("https://") ||
    imageUrl.startsWith("data:")
  ) {
    return imageUrl;
  }

  return `${getBackendOrigin()}${
    imageUrl.startsWith("/") ? "" : "/"
  }${imageUrl}`;
};

const getListFromResponse = (data) => {
  if (Array.isArray(data)) return data;

  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.products)) return data.products;
  if (Array.isArray(data?.data)) return data.data;

  return [];
};

const getErrorMessage = (error) => {
  const data = error?.response?.data;

  if (typeof data?.detail === "string") {
    return data.detail;
  }

  if (typeof data?.message === "string") {
    return data.message;
  }

  if (data && typeof data === "object") {
    return Object.entries(data)
      .map(([field, messages]) => {
        const message = Array.isArray(messages)
          ? messages.join(", ")
          : String(messages);

        return `${field}: ${message}`;
      })
      .join(" | ");
  }

  return "Unable to load products. Please try again.";
};

// =====================================
// NORMALIZE BACKEND PRODUCT DATA
// Matches your ProductSerializer
// =====================================

const normalizeProduct = (item) => {
  const variants = Array.isArray(item.variants)
    ? item.variants
    : [];

  const images = Array.isArray(item.images)
    ? item.images
    : [];

  // Product-level primary image first.
  // If unavailable, use another product-level image.
  // Finally, use a variant image.
  const primaryProductImage =
    images.find(
      (image) => image.is_primary && !image.variant
    ) ||
    images.find((image) => !image.variant) ||
    images.find((image) => image.is_primary) ||
    images[0] ||
    null;

  let imageUrl = getImageUrl(primaryProductImage);

  // If product image is unavailable, use a variant image.
  if (!imageUrl) {
    const variantWithImage = variants.find(
      (variant) => variant.image_url
    );

    imageUrl = getImageUrl(variantWithImage?.image_url);
  }

  // Find variants with valid prices.
  const pricedVariants = variants
    .map((variant) => {
      const currentPrice = Number(
        variant.current_price ??
          variant.sale_price ??
          variant.regular_price ??
          0
      );

      const regularPrice = Number(
        variant.regular_price ?? 0
      );

      return {
        ...variant,
        displayPrice: currentPrice,
        displayOldPrice:
          regularPrice > currentPrice ? regularPrice : 0,
      };
    })
    .filter(
      (variant) =>
        Number.isFinite(variant.displayPrice) &&
        variant.displayPrice > 0
    );

  // Display the lowest available variant price.
  const cheapestVariant = [...pricedVariants].sort(
    (a, b) => a.displayPrice - b.displayPrice
  )[0];

  const price = cheapestVariant?.displayPrice || 0;
  const oldPrice = cheapestVariant?.displayOldPrice || 0;

  // Total stock from all active variants.
  const stock = variants.reduce(
    (total, variant) =>
      total + Math.max(0, Number(variant.stock) || 0),
    0
  );

  // Color names and HEX codes from ProductVariantSerializer.
  const colors = [
    ...new Set(
      variants
        .map(
          (variant) =>
            variant.color_hex ||
            variant.color_name ||
            ""
        )
        .filter(Boolean)
    ),
  ];

  // Size names from ProductVariantSerializer.
  const sizes = [
    ...new Set(
      variants
        .map((variant) => variant.size_name || "")
        .filter(Boolean)
    ),
  ];

  // CategorySerializer relation is represented by category ID.
  // ProductSerializer also provides category_name.
  const category = item.category_name || "";

  // ProductSerializer does not provide an is_new_arrival field.
  // Treat products created in the last 30 days as new arrivals.
  const createdAt = item.created_at
    ? new Date(item.created_at)
    : null;

  const isNew =
    createdAt &&
    !Number.isNaN(createdAt.getTime()) &&
    Date.now() - createdAt.getTime() <=
      30 * 24 * 60 * 60 * 1000 &&
    Date.now() >= createdAt.getTime();

  return {
    id: item.id,
    name: item.name || "Untitled Product",
    category,
    price,
    oldPrice,
    image: imageUrl,
    stock,
    sizes,
    colors,
    isNew: Boolean(isNew),
    variants,
    images,
  };
};

// =====================================
// PRODUCT LIST COMPONENT
// =====================================

function ProductList() {
  const [searchParams, setSearchParams] = useSearchParams();

  const urlCategory = searchParams.get("category") || "All";

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedCategory, setSelectedCategory] = useState(
    categories.some((item) => item.name === urlCategory)
      ? urlCategory
      : "All"
  );

  const [sortBy, setSortBy] = useState("default");
  const [search, setSearch] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  // =====================================
  // FETCH CUSTOMER PRODUCTS
  // =====================================

  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError("");

      // Customer API, not admin-only products/ endpoint.
      const response = await api.get(
        "customer/products/?page_size=50"
      );

      const productList = getListFromResponse(response.data);

      const normalizedProducts = productList
        .filter(
          (item) => item.id !== undefined && item.id !== null
        )
        .map(normalizeProduct);

      setProducts(normalizedProducts);
    } catch (err) {
      console.error(
        "PRODUCT FETCH ERROR:",
        err.response?.data || err
      );

      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadProducts = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await api.get(
          "customer/products/?page_size=50"
        );

        const productList = getListFromResponse(response.data);

        const normalizedProducts = productList
          .filter(
            (item) =>
              item.id !== undefined && item.id !== null
          )
          .map(normalizeProduct);

        if (isMounted) {
          setProducts(normalizedProducts);
        }
      } catch (err) {
        console.error(
          "PRODUCT FETCH ERROR:",
          err.response?.data || err
        );

        if (isMounted) {
          setError(getErrorMessage(err));
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadProducts();

    return () => {
      isMounted = false;
    };
  }, []);

  // =====================================
  // URL CATEGORY SYNC
  // =====================================

  useEffect(() => {
    const category = searchParams.get("category") || "All";

    setSelectedCategory(
      categories.some((item) => item.name === category)
        ? category
        : "All"
    );
  }, [searchParams]);

  // =====================================
  // CATEGORY CHANGE
  // =====================================

  const handleCategoryChange = (category) => {
    setSelectedCategory(category);

    const params = new URLSearchParams(searchParams);

    if (category === "All") {
      params.delete("category");
    } else {
      params.set("category", category);
    }

    setSearchParams(params);
  };

  // =====================================
  // DISCOUNT
  // =====================================

  const getDiscount = (price, oldPrice) => {
    if (!oldPrice || oldPrice <= price) return 0;

    return Math.round(
      ((oldPrice - price) / oldPrice) * 100
    );
  };

  // =====================================
  // STOCK STATUS
  // =====================================

  const getStockStatus = (stock) => {
    if (stock === undefined || stock === null) {
      return {
        label: "Stock unavailable",
        className: "stock-unavailable",
      };
    }

    if (stock <= 0) {
      return {
        label: "Out of Stock",
        className: "stock-out",
      };
    }

    if (stock <= 5) {
      return {
        label: `Only ${stock} left`,
        className: "stock-low",
      };
    }

    return {
      label: "In Stock",
      className: "stock-available",
    };
  };

  // =====================================
  // FILTER AND SORT
  // =====================================

  const filteredProducts = useMemo(() => {
    let result = [...products];

    if (selectedCategory === "New Arrivals") {
      result = result.filter((product) => product.isNew);
    } else if (selectedCategory !== "All") {
      result = result.filter(
        (product) =>
          product.category?.toLowerCase() ===
          selectedCategory.toLowerCase()
      );
    }

    if (search.trim()) {
      const keyword = search.trim().toLowerCase();

      result = result.filter(
        (product) =>
          product.name.toLowerCase().includes(keyword) ||
          product.category.toLowerCase().includes(keyword)
      );
    }

    if (minPrice !== "") {
      result = result.filter(
        (product) => product.price >= Number(minPrice)
      );
    }

    if (maxPrice !== "") {
      result = result.filter(
        (product) => product.price <= Number(maxPrice)
      );
    }

    if (sortBy === "low") {
      result.sort((a, b) => a.price - b.price);
    } else if (sortBy === "high") {
      result.sort((a, b) => b.price - a.price);
    } else if (sortBy === "name") {
      result.sort((a, b) => a.name.localeCompare(b.name));
    }

    return result;
  }, [
    products,
    selectedCategory,
    search,
    minPrice,
    maxPrice,
    sortBy,
  ]);

  // =====================================
  // CLEAR FILTERS
  // =====================================

  const clearFilters = () => {
    setSearch("");
    setSortBy("default");
    setMinPrice("");
    setMaxPrice("");
    handleCategoryChange("All");
  };

  // =====================================
  // CATEGORY CARD IMAGES
  // =====================================

  const renderCategoryImages = (category) => (
    <div className="category-image-collage">
      {category.images.slice(0, 4).map((image, index) => (
        <div
          className={`category-collage-image image-${index + 1}`}
          key={`${category.name}-${index}`}
        >
          <img
            src={image}
            alt={`${category.name} style ${index + 1}`}
          />
        </div>
      ))}
    </div>
  );

  // =====================================
  // RENDER
  // =====================================

  return (
    <main className="product-list-page">

      {/* HERO BANNER */}

      <section
        className="collection-banner"
        style={{ backgroundImage: `url(${hero})` }}
      >
        <div className="collection-banner-overlay">
          <div className="collection-banner-content">
            <span className="collection-eyebrow">
              THE STYLO COLLECTION
            </span>

            <h1>
              Discover Your
              <br />
              Signature Style
            </h1>

            <p>
              Fashion that celebrates your individuality.
              Explore elegant styles for every occasion.
            </p>

            <button
              type="button"
              className="collection-banner-btn"
              onClick={() =>
                document
                  .getElementById("shop-collections")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
            >
              Explore Collection <span>→</span>
            </button>
          </div>
        </div>
      </section>

      {/* CATEGORY SECTION */}

      <section
        className="collection-categories"
        id="shop-collections"
      >
        <div className="product-section-heading">
          <span>EXPLORE STYLO</span>
          <h2>Shop By Category</h2>
          <p>Find the perfect style for every moment.</p>
        </div>

        <div className="category-image-grid">
          {categories.map((category) => (
            <button
              type="button"
              key={category.name}
              className={`category-image-card ${
                selectedCategory === category.name ? "active" : ""
              }`}
              onClick={() =>
                handleCategoryChange(category.name)
              }
            >
              {renderCategoryImages(category)}

              <div className="category-image-overlay">
                <span>{category.name}</span>
                <small>Explore Collection →</small>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* PRODUCT SECTION */}

      <section className="all-products-section">
        <div className="product-section-heading">
          <span>CURATED FOR YOU</span>

          <h2>
            {selectedCategory === "All"
              ? "Our Fashion Collection"
              : selectedCategory}
          </h2>

          <p>
            Discover pieces that make every look special.
          </p>
        </div>

        {/* FILTER TOOLBAR */}

        <div className="product-filter-toolbar">
          <div className="product-search-box">
            <span>⌕</span>

            <input
              type="search"
              placeholder="Search your favourite styles..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select
            value={selectedCategory}
            onChange={(e) =>
              handleCategoryChange(e.target.value)
            }
            aria-label="Filter by category"
          >
            <option value="All">All Categories</option>

            {categories
              .filter((item) => item.name !== "All")
              .map((category) => (
                <option
                  key={category.name}
                  value={category.name}
                >
                  {category.name}
                </option>
              ))}
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            aria-label="Sort products"
          >
            <option value="default">Sort By: Featured</option>
            <option value="low">Price: Low to High</option>
            <option value="high">Price: High to Low</option>
            <option value="name">Name: A to Z</option>
          </select>
        </div>

        {/* PRICE FILTER */}

        <div className="price-filter-row">
          <div className="price-filter-title">
            <span>Price Range</span>
          </div>

          <div className="price-filter-inputs">
            <input
              type="number"
              min="0"
              placeholder="Min ₹"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
            />

            <span>to</span>

            <input
              type="number"
              min="0"
              placeholder="Max ₹"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
            />
          </div>

          <button
            type="button"
            className="clear-filter-btn"
            onClick={clearFilters}
          >
            Clear Filters
          </button>
        </div>

        {/* RESULTS COUNT */}

        <div className="product-results-heading">
          <p>
            Showing <strong>{filteredProducts.length}</strong>{" "}
            products
          </p>

          {selectedCategory !== "All" && (
            <button
              type="button"
              onClick={() => handleCategoryChange("All")}
            >
              Clear category ×
            </button>
          )}
        </div>

        {/* LOADING */}

        {loading && (
          <div className="professional-product-empty">
            <h3>Loading products...</h3>
            <p>
              Please wait while we load the STYLO collection.
            </p>
          </div>
        )}

        {/* ERROR */}

        {!loading && error && (
          <div className="professional-product-empty">
            <h3>Unable to load products</h3>
            <p>{error}</p>

            <button
              type="button"
              onClick={fetchProducts}
            >
              Try Again
            </button>
          </div>
        )}

        {/* PRODUCT GRID */}

        {!loading && !error && filteredProducts.length > 0 && (
          <div className="professional-product-grid">
            {filteredProducts.map((product) => {
              const stockStatus = getStockStatus(product.stock);

              const discount = getDiscount(
                product.price,
                product.oldPrice
              );

              return (
                <article
                  className="professional-product-card"
                  key={product.id}
                >
                  {/* IMAGE */}

                  <Link
                    to={`/products/${product.id}`}
                    className="professional-product-image"
                  >
                    {product.image ? (
                      <img
                        src={product.image}
                        alt={product.name}
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="product-image-placeholder">
                        Image unavailable
                      </div>
                    )}

                    {discount > 0 && (
                      <span className="product-discount">
                        {discount}% OFF
                      </span>
                    )}

                    {product.isNew && (
                      <span className="product-badge">
                        NEW
                      </span>
                    )}
                  </Link>

                  {/* DETAILS */}

                  <div className="professional-product-info">
                    <span className="professional-product-category">
                      {product.category || "STYLO Collection"}
                    </span>

                    <h3>{product.name}</h3>

                    {/* PRICE */}

                    <div className="professional-product-prices">
                      <strong>
                        {formatPrice(product.price)}
                      </strong>

                      {product.oldPrice > product.price && (
                        <del>
                          {formatPrice(product.oldPrice)}
                        </del>
                      )}
                    </div>

                    {/* SAVINGS */}

                    {product.oldPrice > product.price && (
                      <p className="product-savings">
                        You save{" "}
                        {formatPrice(
                          product.oldPrice - product.price
                        )}
                      </p>
                    )}

                    {/* COLORS */}

                    {product.colors.length > 0 && (
                      <div className="product-variant-row">
                        <span>Available Colors</span>

                        <div className="product-color-options">
                          {product.colors.map((color, index) => {
                            const isHex =
                              /^#[0-9A-F]{6}$/i.test(color);

                            return (
                              <span
                                key={`${color}-${index}`}
                                className="product-color-dot"
                                style={{
                                  backgroundColor: isHex
                                    ? color
                                    : "#e8e0dc",
                                }}
                                title={color}
                              />
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* SIZES */}

                    {product.sizes.length > 0 && (
                      <div className="product-variant-row">
                        <span>Available Sizes</span>

                        <div className="product-size-options">
                          {product.sizes.map((size) => (
                            <span key={size}>{size}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* STOCK */}

                    <div className="product-stock">
                      <span className={stockStatus.className}>
                        {stockStatus.className ===
                          "stock-available" && (
                          <span className="stock-dot"></span>
                        )}

                        {stockStatus.label}
                      </span>
                    </div>

                    {/* DETAILS BUTTON */}

                    <Link
                      to={`/products/${product.id}`}
                      className="professional-view-btn"
                    >
                      View Details <span>→</span>
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* EMPTY STATE */}

        {!loading &&
          !error &&
          filteredProducts.length === 0 && (
            <div className="professional-product-empty">
              <span>⌕</span>
              <h3>No products found</h3>

              <p>
                We couldn't find products matching your filters.
                Try another search or clear your filters.
              </p>

              <button
                type="button"
                onClick={clearFilters}
              >
                View All Products
              </button>
            </div>
          )}
      </section>

      {/* BOTTOM PROMOTION */}

      <section className="product-bottom-promo">
        <div>
          <span>YOUR STYLE, YOUR STORY</span>
          <h2>Elegance begins with you.</h2>
          <p>
            Discover your next favourite look with STYLO.
          </p>
        </div>

        <Link to="/home">
          Back to Home →
        </Link>
      </section>
    </main>
  );
}

export default ProductList;
