
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api";
import "./Home.css";

// ========================================
// CONSTANTS AND HELPERS
// ========================================

const CART_KEY = "stylo_cart";
const WISHLIST_KEY = "stylo_wishlist";

const formatPrice = (price) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(price) || 0);

const readStorage = (key, fallback = []) => {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return Array.isArray(value) ? value : fallback;
  } catch {
    return fallback;
  }
};

// ========================================
// PRODUCT FORMATTER
// ========================================

const formatProduct = (product) => {
  const variants = (product.variants || []).filter(
    (variant) => variant.is_active
  );

  const availableVariants = variants.filter(
    (variant) => Number(variant.stock || 0) > 0
  );

  const prices = variants
    .map((variant) => Number(variant.current_price))
    .filter((price) => Number.isFinite(price) && price > 0);

  const regularPrices = variants
    .map((variant) => Number(variant.regular_price))
    .filter((price) => Number.isFinite(price) && price > 0);

  const image =
    product.images?.find((item) => item.is_primary) ||
    product.images?.[0];

  const imageUrl =
    image?.image_url ||
    (typeof image?.image === "string" ? image.image : "");

  return {
    ...product,
    id: product.id,
    name: product.name || "Untitled Product",
    category: product.category_name || "Collection",
    description: product.description || "",
    image: imageUrl,
    price: prices.length ? Math.min(...prices) : 0,
    oldPrice: regularPrices.length
      ? Math.min(...regularPrices)
      : 0,
    stock: availableVariants.reduce(
      (total, variant) => total + Number(variant.stock || 0),
      0
    ),
    rating: null,
    variants,
  };
};

// ========================================
// ICONS
// ========================================

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="10.8" cy="10.8" r="6.8" />
      <path d="m16 16 5 5" />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 3h2l2.2 12.1a2 2 0 0 0 2 1.7h8.9a2 2 0 0 0 1.9-1.5L22 8H6" />
      <circle cx="10" cy="21" r="1" />
      <circle cx="18" cy="21" r="1" />
    </svg>
  );
}

function HeartIcon({ filled = false }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={filled ? "heart-filled" : ""}
    >
      <path d="M20.8 4.8a5.5 5.5 0 0 0-7.8 0L12 5.9l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.3 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

// ========================================
// HOME COMPONENT
// ========================================

export default function Home() {
  const navigate = useNavigate();

  // SEARCH AND FILTERS
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("featured");
  const [selectedCategory, setSelectedCategory] = useState("All");

  // BACKEND PRODUCTS AND CATEGORIES
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState("");

  // CART AND WISHLIST
  const [cart, setCart] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [wishlistLoading, setWishlistLoading] = useState(false);

  const [cartOwnerKey, setCartOwnerKey] = useState(null);
  const [wishlistOwnerKey, setWishlistOwnerKey] = useState(null);

  // AUTHENTICATION
  const [authChecked, setAuthChecked] = useState(false);
  const [profile, setProfile] = useState(null);

  // NAVIGATION
  const [mobileMenu, setMobileMenu] = useState(false);
  const [profileMenu, setProfileMenu] = useState(false);

  // SMART OUTFIT
  const [budget, setBudget] = useState(3000);
  const [outfitItems, setOutfitItems] = useState([]);

  // SHOPPING ASSISTANT
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantQuestion, setAssistantQuestion] = useState("");
  const [assistantReply, setAssistantReply] = useState(
    "Hello! Welcome to STYLO. How can I help you find your perfect look?"
  );

  // NEWSLETTER
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [newsletterMessage, setNewsletterMessage] = useState("");

  // ========================================
  // AUTHENTICATION
  // ========================================

  useEffect(() => {
    let active = true;

    const checkUserAuth = async () => {
      const accessToken = localStorage.getItem("user_access");

      if (!accessToken) {
        if (active) {
          setProfile(null);
          setAuthChecked(true);
          setProfileMenu(false);
        }
        return;
      }

      setAuthChecked(false);

      try {
        const response = await api.get("auth/profile/");

        if (active) {
          setProfile(response.data);
        }
      } catch (error) {
        console.error(
          "HOME PROFILE ERROR:",
          error.response?.data || error.message
        );

        if (active) {
          setProfile(null);
          setProfileMenu(false);

          if (error.response?.status === 401) {
            localStorage.removeItem("user_access");
            localStorage.removeItem("user_refresh");
          }
        }
      } finally {
        if (active) {
          setAuthChecked(true);
        }
      }
    };

    checkUserAuth();

    window.addEventListener("authChanged", checkUserAuth);
    window.addEventListener("profileUpdated", checkUserAuth);

    return () => {
      active = false;
      window.removeEventListener("authChanged", checkUserAuth);
      window.removeEventListener("profileUpdated", checkUserAuth);
    };
  }, []);

  // ========================================
  // FETCH CUSTOMER PRODUCTS
  // ========================================

  useEffect(() => {
    let active = true;

    const fetchProducts = async () => {
      setProductsLoading(true);
      setProductsError("");

      try {
        const response = await api.get("customer/products/", {
          params: {
            page: 1,
            page_size: 50,
          },
        });

        const data = response.data;
        const productList = Array.isArray(data)
          ? data
          : data.results || [];

        const formattedProducts = productList
          .map(formatProduct)
          .filter((product) => product.stock > 0);

        if (active) {
          setProducts(formattedProducts);
        }
      } catch (error) {
        console.error(
          "CUSTOMER PRODUCTS ERROR:",
          error.response?.data || error.message
        );

        if (active) {
          setProductsError("Unable to load products. Please try again.");
        }
      } finally {
        if (active) {
          setProductsLoading(false);
        }
      }
    };

    fetchProducts();

    return () => {
      active = false;
    };
  }, []);

  // ========================================
  // FETCH CUSTOMER CATEGORIES
  // ========================================

  useEffect(() => {
    let active = true;

    const fetchCategories = async () => {
      try {
        const response = await api.get("customer/categories/");

        const data = response.data;
        const categoryList = Array.isArray(data)
          ? data
          : data.results || [];

        if (active) {
          setCategories(categoryList);
        }
      } catch (error) {
        console.error(
          "CUSTOMER CATEGORIES ERROR:",
          error.response?.data || error.message
        );
      }
    };

    fetchCategories();

    return () => {
      active = false;
    };
  }, []);

  // ========================================
  // CUSTOMER STORAGE
  // ========================================

  const userStorageId =
    profile?.id ?? profile?.email ?? profile?.username;

  const userCartKey = userStorageId
    ? `${CART_KEY}_${String(userStorageId).toLowerCase()}`
    : null;

  const userWishlistKey = userStorageId
    ? `${WISHLIST_KEY}_${String(userStorageId).toLowerCase()}`
    : null;

  useEffect(() => {
    if (!userCartKey || !userWishlistKey) {
      setCart([]);
      setWishlist([]);
      setCartOwnerKey(null);
      setWishlistOwnerKey(null);
      return;
    }

    setCart(readStorage(userCartKey));
    setCartOwnerKey(userCartKey);
  }, [userCartKey, userWishlistKey]);

  // ========================================
  // FETCH WISHLIST FROM BACKEND
  // ========================================

  useEffect(() => {
    let active = true;

    const fetchWishlist = async () => {
      if (!profile || !localStorage.getItem("user_access")) {
        setWishlist([]);
        setWishlistOwnerKey(null);
        return;
      }

      setWishlistLoading(true);

      try {
        const response = await api.get("wishlist/");

        const data = response.data;

        const items = Array.isArray(data)
          ? data
          : data?.items || data?.results || [];

        if (active) {
          setWishlist(items);
          setWishlistOwnerKey(userWishlistKey);
        }
      } catch (error) {
        console.error(
          "FETCH WISHLIST ERROR:",
          error.response?.data || error.message
        );

        if (active) {
          setWishlist([]);
        }
      } finally {
        if (active) {
          setWishlistLoading(false);
        }
      }
    };

    fetchWishlist();

    return () => {
      active = false;
    };
  }, [profile, userWishlistKey]);

  // SAVE CART
  useEffect(() => {
    if (userCartKey && cartOwnerKey === userCartKey) {
      localStorage.setItem(userCartKey, JSON.stringify(cart));
    }
  }, [cart, cartOwnerKey, userCartKey]);

  // ========================================
  // CART CALCULATIONS
  // ========================================

  const cartCount = cart.reduce(
    (total, item) => total + Number(item.quantity || 1),
    0
  );

  const cartTotal = cart.reduce(
    (total, item) =>
      total + Number(item.price || 0) * Number(item.quantity || 1),
    0
  );

  // ========================================
  // PRODUCT FILTERING AND SORTING
  // ========================================

  const filteredProducts = useMemo(() => {
    let result = [...products];

    if (selectedCategory !== "All") {
      result = result.filter(
        (product) => product.category === selectedCategory
      );
    }

    if (search.trim()) {
      const query = search.toLowerCase().trim();

      result = result.filter(
        (product) =>
          product.name.toLowerCase().includes(query) ||
          product.category.toLowerCase().includes(query) ||
          product.description.toLowerCase().includes(query)
      );
    }

    if (sort === "low") {
      result.sort((a, b) => a.price - b.price);
    } else if (sort === "high") {
      result.sort((a, b) => b.price - a.price);
    } else if (sort === "az") {
      result.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sort === "za") {
      result.sort((a, b) => b.name.localeCompare(a.name));
    }

    return result;
  }, [products, search, sort, selectedCategory]);

  // ========================================
  // SMART OUTFIT CALCULATIONS
  // ========================================

  const outfitTotal = outfitItems.reduce(
    (total, item) => total + Number(item.price || 0),
    0
  );

  const outfitRemaining = budget - outfitTotal;

  // ========================================
  // LOGIN PROTECTION
  // ========================================

  const requireLogin = (destination) => {
    if (!authChecked) {
      alert("Please wait. We are checking your account.");
      return false;
    }

    if (!profile) {
      navigate("/login", {
        state: {
          from: {
            pathname: destination,
          },
        },
      });

      return false;
    }

    return true;
  };

  // ========================================
  // LOGOUT
  // ========================================

  const handleLogout = () => {
    localStorage.removeItem("user_access");
    localStorage.removeItem("user_refresh");

    setProfile(null);
    setAuthChecked(true);
    setProfileMenu(false);

    setCart([]);
    setWishlist([]);

    setCartOwnerKey(null);
    setWishlistOwnerKey(null);

    window.dispatchEvent(new Event("authChanged"));
    navigate("/", { replace: true });
  };

  // ========================================
  // NAVIGATION HELPERS
  // ========================================

  const scrollToProducts = () => {
    document.getElementById("trending")?.scrollIntoView({
      behavior: "smooth",
    });

    setMobileMenu(false);
  };

  const handleSearch = (event) => {
    event.preventDefault();
    scrollToProducts();
  };

  const selectCategory = (category) => {
    setSelectedCategory(category);
    scrollToProducts();
  };

  const goToCategory = (category) => {
    selectCategory(category);
  };

  // ========================================
  // ADD TO CART
  // ========================================

  const addToCart = (product) => {
    if (!requireLogin("/cart")) return;

    setCart((previous) => {
      const existing = previous.find(
        (item) => Number(item.id) === Number(product.id)
      );

      if (existing) {
        return previous.map((item) =>
          Number(item.id) === Number(product.id)
            ? {
                ...item,
                quantity: Number(item.quantity || 1) + 1,
              }
            : item
        );
      }

      return [...previous, { ...product, quantity: 1 }];
    });

    alert(`${product.name} added to your cart!`);
  };

  // ========================================
  // WISHLIST
  // ========================================

  const getWishlistProductId = (item) =>
    item.product_details?.id ??
    item.product?.id ??
    item.product;

  const toggleWishlist = async (product) => {
    if (!requireLogin("/wishlist")) return;

    try {
      const existingItem = wishlist.find(
        (item) =>
          Number(getWishlistProductId(item)) === Number(product.id)
      );

      if (existingItem) {
        await api.delete(`wishlist/items/${existingItem.id}/`);

        setWishlist((previous) =>
          previous.filter(
            (item) => Number(item.id) !== Number(existingItem.id)
          )
        );

        return;
      }

      const response = await api.post("wishlist/items/", {
        product_id: product.id,
      });

      const savedItem = response.data?.item || response.data;

      setWishlist((previous) => [...previous, savedItem]);
    } catch (error) {
      console.error(
        "WISHLIST ERROR:",
        error.response?.data || error.message
      );

      if (error.response?.status === 401) {
        navigate("/login", {
          state: {
            from: {
              pathname: "/wishlist",
            },
          },
        });
      } else {
        const errorMessage =
          error.response?.data?.detail ||
          error.response?.data?.message ||
          error.response?.data?.product_id?.[0] ||
          "Unable to update wishlist. Please try again.";

        alert(errorMessage);
      }
    }
  };

  const isWishlisted = (productId) =>
    wishlist.some(
      (item) =>
        Number(getWishlistProductId(item)) === Number(productId)
    );

  // ========================================
  // COUPON
  // ========================================

  const copyCoupon = async () => {
    try {
      await navigator.clipboard.writeText("STYLO10");
      alert("Coupon code STYLO10 copied!");
    } catch {
      alert("Please copy this coupon: STYLO10");
    }
  };

  // ========================================
  // SMART OUTFIT BUILDER
  // ========================================

  const addToOutfit = (product) => {
    if (outfitItems.some((item) => item.id === product.id)) {
      alert("This product is already in your outfit.");
      return;
    }

    if (outfitTotal + product.price > budget) {
      alert("This item exceeds your selected outfit budget.");
      return;
    }

    setOutfitItems((previous) => [...previous, product]);
  };

  const removeFromOutfit = (productId) => {
    setOutfitItems((previous) =>
      previous.filter((item) => item.id !== productId)
    );
  };

  const addOutfitToCart = () => {
    if (!outfitItems.length) {
      alert("Please select some outfit items first.");
      return;
    }

    if (!requireLogin("/cart")) return;

    setCart((previous) => {
      const updated = [...previous];

      outfitItems.forEach((product) => {
        const existingIndex = updated.findIndex(
          (item) => item.id === product.id
        );

        if (existingIndex !== -1) {
          updated[existingIndex] = {
            ...updated[existingIndex],
            quantity:
              Number(updated[existingIndex].quantity || 1) + 1,
          };
        } else {
          updated.push({
            ...product,
            quantity: 1,
          });
        }
      });

      return updated;
    });

    alert("Your complete outfit has been added to cart!");
  };

  // ========================================
  // SHOPPING ASSISTANT
  // ========================================

  const askAssistant = (event) => {
    event.preventDefault();

    const question = assistantQuestion.toLowerCase().trim();

    if (!question) return;

    let reply =
      "Thank you for contacting STYLO! Explore our collection or contact our support team for more help.";

    if (question.includes("abaya") || question.includes("modest")) {
      reply = "Explore our Modest Wear collection for elegant styles.";
    } else if (question.includes("party") || question.includes("occasion")) {
      reply = "Our Party Wear collection has beautiful styles for special occasions.";
    } else if (
      question.includes("budget") ||
      question.includes("3000") ||
      question.includes("outfit")
    ) {
      reply = "Try our Smart Outfit Builder to create a look within your budget.";
    } else if (
      question.includes("jewellery") ||
      question.includes("accessory")
    ) {
      reply = "Check our Jewellery and Accessories collections.";
    } else if (question.includes("cart")) {
      reply = profile
        ? `You currently have ${cartCount} item(s) in your cart. Your cart total is ${formatPrice(cartTotal)}.`
        : "Please sign in to view your personal cart.";
    } else if (question.includes("login")) {
      reply = profile
        ? "You are already signed in to your STYLO account."
        : "Please click Sign In to access your STYLO account.";
    }

    setAssistantReply(reply);
    setAssistantQuestion("");
  };

  // ========================================
  // NEWSLETTER
  // ========================================

  const handleNewsletter = (event) => {
    event.preventDefault();

    if (!newsletterEmail.trim()) {
      setNewsletterMessage("Please enter your email address.");
      return;
    }

    setNewsletterMessage("Thank you for subscribing to STYLO updates!");
    setNewsletterEmail("");
  };

  // ========================================
  // JSX
  // ========================================

  return (
    <main className="stylo-home">

      <div className="announcement-bar">
        <p>
          ✦ FREE SHIPPING ON ORDERS ABOVE ₹1,999 ✦
          <span> Discover your style with STYLO</span>
        </p>
      </div>

      <header className="stylo-navbar">
        <div className="navbar-inner">

          <Link to="/" className="stylo-logo">
            STYLO<span>.</span>
            <small>THE ART OF DRESSING</small>
          </Link>

          <nav className={`desktop-nav ${mobileMenu ? "nav-open" : ""}`}>
            <a href="#home" onClick={() => setMobileMenu(false)}>Home</a>
            <a href="#categories" onClick={() => setMobileMenu(false)}>Categories</a>
            <a href="#trending" onClick={() => setMobileMenu(false)}>New Arrivals</a>
            <a href="#smart-outfit" onClick={() => setMobileMenu(false)}>Smart Outfit</a>
            <a href="#about" onClick={() => setMobileMenu(false)}>About</a>
          </nav>

          <form className="navbar-search" onSubmit={handleSearch}>
            <SearchIcon />
            <input
              type="search"
              placeholder="Search dresses, accessories..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <button type="submit">Search</button>
          </form>

          <div className="navbar-actions">

            <Link
              to={profile ? "/wishlist" : "/login"}
              state={profile ? undefined : { from: { pathname: "/wishlist" } }}
              className="icon-button"
              aria-label="Wishlist"
              title="Wishlist"
            >
              <HeartIcon />
              {profile && wishlist.length > 0 && (
                <span className="icon-count">{wishlist.length}</span>
              )}
            </Link>

            <Link
              to={profile ? "/cart" : "/login"}
              state={profile ? undefined : { from: { pathname: "/cart" } }}
              className="icon-button"
              aria-label="Shopping cart"
              title="Shopping cart"
            >
              <CartIcon />
              {profile && cartCount > 0 && (
                <span className="icon-count">{cartCount}</span>
              )}
            </Link>

            {!authChecked ? (
              <span className="signin-button">
                <UserIcon />
                <span>Loading...</span>
              </span>
            ) : profile ? (
              <div className="profile-wrapper">
                <button
                  className="profile-button"
                  type="button"
                  onClick={() => setProfileMenu((previous) => !previous)}
                  aria-expanded={profileMenu}
                >
                  <UserIcon />
                  <span>Account</span>
                </button>

                {profileMenu && (
                  <div className="profile-dropdown">
                    <p>
                      Hello, {profile.first_name || profile.username || profile.email || "Customer"}
                    </p>

                    <Link to="/profile" onClick={() => setProfileMenu(false)}>My Profile</Link>
                    <Link to="/addresses" onClick={() => setProfileMenu(false)}>My Addresses</Link>
                    <Link to="/orders" onClick={() => setProfileMenu(false)}>My Orders</Link>
                    <Link to="/wishlist" onClick={() => setProfileMenu(false)}>My Wishlist</Link>
                    <Link to="/cart" onClick={() => setProfileMenu(false)}>My Cart</Link>

                    <button type="button" onClick={handleLogout}>Logout</button>
                  </div>
                )}
              </div>
            ) : (
              <Link to="/login" className="signin-button">
                <UserIcon />
                <span>Sign In</span>
              </Link>
            )}

            <button
              type="button"
              className="mobile-menu-button"
              onClick={() => setMobileMenu((previous) => !previous)}
              aria-label="Toggle navigation"
            >
              {mobileMenu ? <CloseIcon /> : <MenuIcon />}
            </button>
          </div>
        </div>

        <form className="mobile-search" onSubmit={handleSearch}>
          <SearchIcon />
          <input
            type="search"
            placeholder="Search your style..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <button type="submit">Search</button>
        </form>
      </header>

      <section className="coupon-strip">
        <div>
          <span className="coupon-label">WELCOME OFFER</span>
          <p>
            Enjoy <strong>10% OFF</strong> on your first purchase.
            Use code <strong>STYLO10</strong>
          </p>
        </div>
        <button onClick={copyCoupon} type="button">COPY CODE</button>
      </section>

      <section className="hero-section" id="home">
        <div className="hero-content">
          <span className="eyebrow">THE STYLO EDIT · 2026</span>
          <h1>Elegance in<br /><em>Every Moment.</em></h1>
          <p className="hero-description">
            Discover a world of timeless fashion, effortless elegance
            and styles that celebrate the woman you are.
          </p>

          <div className="hero-buttons">
            <button className="primary-button" onClick={scrollToProducts} type="button">
              SHOP THE COLLECTION <span>→</span>
            </button>
            <a href="#categories" className="secondary-button">Explore Categories</a>
          </div>

          <div className="hero-note">
            <span>✦</span> Thoughtfully curated. Beautifully you.
          </div>
        </div>

        <div className="hero-image-wrapper">
          <img
            src="https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=1200"
            alt="Elegant women's fashion collection"
            className="hero-image"
          />

          <div className="hero-image-label">
            <span>NEW COLLECTION</span>
            <strong>Find Your Signature Style</strong>
          </div>

          <div className="hero-floating-card">
            <span>✦</span>
            <div>
              <strong>Style that speaks</strong>
              <small>Confidence in every outfit</small>
            </div>
          </div>
        </div>
      </section>

      <section className="benefits-section">
        <div className="benefit-item">
          <span>✧</span>
          <div><strong>Curated Collections</strong><small>Styles worth discovering</small></div>
        </div>
        <div className="benefit-item">
          <span>♡</span>
          <div><strong>Made for You</strong><small>Fashion meets individuality</small></div>
        </div>
        <div className="benefit-item">
          <span>♧</span>
          <div><strong>Secure Shopping</strong><small>A smooth shopping experience</small></div>
        </div>
        <div className="benefit-item">
          <span>✦</span>
          <div><strong>Special Offers</strong><small>More style, more value</small></div>
        </div>
      </section>

      {/* CATEGORIES FROM DATABASE */}

      <section className="categories-section" id="categories">
        <div className="section-heading">
          <span className="eyebrow">EXPLORE YOUR STYLE</span>
          <h2>Shop by Category</h2>
          <p>Find the pieces that make your style uniquely yours.</p>
        </div>

        <div className="category-grid">
          {categories.map((category) => (
            <button
              className="category-card"
              key={category.id}
              onClick={() => goToCategory(category.name)}
              type="button"
            >
              <img
                src={category.image || ""}
                alt={category.name}
              />
              <div className="category-overlay">
                <span>{category.name}</span>
                <small>EXPLORE COLLECTION →</small>
              </div>
            </button>
          ))}

          {categories.length === 0 && (
            <p>No categories available right now.</p>
          )}
        </div>
      </section>

      <section className="promotion-section">
        <div className="promotion-image">
          <img
            src="https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=1200"
            alt="Women's fashion editorial"
          />
        </div>

        <div className="promotion-content">
          <span className="eyebrow">A LITTLE MORE YOU</span>
          <h2>Your style.<br />Your story.<br /><em>Your STYLO.</em></h2>
          <p>
            Fashion is more than what you wear. It is how you express
            yourself, every single day.
          </p>
          <button type="button" className="primary-button" onClick={scrollToProducts}>
            DISCOVER MORE →
          </button>
        </div>
      </section>

      {/* PRODUCTS FROM DATABASE */}

      <section className="trending-section" id="trending">
        <div className="section-heading">
          <span className="eyebrow">HANDPICKED FOR YOU</span>
          <h2>Trending This Season</h2>
          <p>Beautiful finds to refresh your wardrobe.</p>
        </div>

        <div className="product-toolbar">
          <div className="category-filters">
            {[
              "All",
              ...categories.map((category) => category.name),
            ].map((category) => (
              <button
                key={category}
                type="button"
                className={selectedCategory === category ? "filter-active" : ""}
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>

          <select
            value={sort}
            onChange={(event) => setSort(event.target.value)}
            aria-label="Sort products"
          >
            <option value="featured">Featured</option>
            <option value="low">Price: Low to High</option>
            <option value="high">Price: High to Low</option>
            <option value="az">Name: A to Z</option>
            <option value="za">Name: Z to A</option>
          </select>
        </div>

        {productsLoading ? (
          <div className="no-products">
            <h3>Loading products...</h3>
          </div>
        ) : productsError ? (
          <div className="no-products">
            <h3>{productsError}</h3>
            <button type="button" onClick={() => window.location.reload()}>
              Try Again
            </button>
          </div>
        ) : (
          <div className="product-grid">
            {filteredProducts.length > 0 ? (
              filteredProducts.map((product) => (
                <article className="product-card" key={product.id}>
                  <div className="product-image-wrapper">
                    {product.image ? (
                      <img src={product.image} alt={product.name} />
                    ) : (
                      <div className="product-image-placeholder">
                        Image unavailable
                      </div>
                    )}

                    {product.oldPrice > product.price && (
                      <span className="product-discount">
                        {Math.round(
                          ((product.oldPrice - product.price) / product.oldPrice) * 100
                        )}% OFF
                      </span>
                    )}

                    <button
                      type="button"
                      className={`wishlist-button ${isWishlisted(product.id) ? "wishlisted" : ""}`}
                      onClick={() => toggleWishlist(product)}
                      aria-label="Toggle wishlist"
                    >
                      <HeartIcon filled={isWishlisted(product.id)} />
                    </button>

                    <button
                      className="quick-view-button"
                      type="button"
                      onClick={() => navigate(`/products/${product.id}`)}
                    >
                      QUICK VIEW
                    </button>
                  </div>

                  <div className="product-details">
                    <span className="product-category">{product.category}</span>
                    <h3>{product.name}</h3>

                    {product.rating && (
                      <div className="product-rating">
                        <span>★</span> {product.rating}
                      </div>
                    )}

                    <div className="product-price">
                      <strong>{formatPrice(product.price)}</strong>
                      {product.oldPrice > product.price && (
                        <del>{formatPrice(product.oldPrice)}</del>
                      )}
                    </div>

                    {product.stock <= 5 && (
                      <p className="stock-warning">
                        Only {product.stock} left!
                      </p>
                    )}

                    <button
                      className="add-cart-button"
                      type="button"
                      onClick={() => addToCart(product)}
                    >
                      ADD TO CART <span>+</span>
                    </button>

                    <button
                      className="outfit-add-button"
                      type="button"
                      onClick={() => addToOutfit(product)}
                    >
                      + Add to Smart Outfit
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <div className="no-products">
                <span>⌕</span>
                <h3>No products found</h3>
                <p>Try another search or category.</p>
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setSelectedCategory("All");
                  }}
                >
                  Clear Filters
                </button>
              </div>
            )}
          </div>
        )}

        <div className="view-all-wrapper">
          <button
            className="secondary-button"
            type="button"
            onClick={() => navigate("/products")}
          >
            VIEW ALL PRODUCTS →
          </button>
        </div>
      </section>

      {/* SMART OUTFIT BUILDER */}

      <section className="smart-outfit-section" id="smart-outfit">
        <div className="outfit-intro">
          <span className="eyebrow">YOUR PERSONAL STYLE STUDIO</span>
          <h2>One Budget.<br />One Complete <em>Look.</em></h2>
          <p>
            Create a beautiful outfit with clothes and accessories
            that match your style and your budget.
          </p>

          <div className="budget-control">
            <div className="budget-heading">
              <span>Your Budget</span>
              <strong>{formatPrice(budget)}</strong>
            </div>

            <input
              type="range"
              min="1000"
              max="10000"
              step="500"
              value={budget}
              onChange={(event) => setBudget(Number(event.target.value))}
            />

            <div className="budget-range">
              <span>₹1,000</span>
              <span>₹10,000</span>
            </div>
          </div>
        </div>

        <div className="outfit-builder">
          <div className="outfit-builder-header">
            <div>
              <span className="eyebrow">MY OUTFIT</span>
              <h3>Build Your Look</h3>
            </div>
            <span className="outfit-count">{outfitItems.length} ITEMS</span>
          </div>

          <div className="outfit-selected-items">
            {outfitItems.length > 0 ? (
              outfitItems.map((item) => (
                <div className="outfit-item" key={item.id}>
                  <img src={item.image} alt={item.name} />
                  <div>
                    <strong>{item.name}</strong>
                    <span>{formatPrice(item.price)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFromOutfit(item.id)}
                    aria-label={`Remove ${item.name}`}
                  >
                    ×
                  </button>
                </div>
              ))
            ) : (
              <div className="empty-outfit">
                <span>✧</span>
                <h4>Your look starts here</h4>
                <p>
                  Select products from the collection to create your
                  complete outfit.
                </p>
              </div>
            )}
          </div>

          <div className="outfit-summary">
            <div>
              <span>Selected items</span>
              <strong>{formatPrice(outfitTotal)}</strong>
            </div>

            <div>
              <span>Remaining budget</span>
              <strong className={outfitRemaining < 0 ? "over-budget" : ""}>
                {formatPrice(outfitRemaining)}
              </strong>
            </div>

            <div className="budget-progress">
              <div
                style={{
                  width: `${Math.min((outfitTotal / budget) * 100, 100)}%`,
                }}
              />
            </div>

            <button
              type="button"
              className="primary-button outfit-cart-button"
              onClick={addOutfitToCart}
              disabled={outfitItems.length === 0}
            >
              ADD COMPLETE OUTFIT TO CART →
            </button>
          </div>
        </div>
      </section>

      {/* STYLE EDITORIAL */}

      <section className="editorial-section" id="about">
        <div className="editorial-image">
          <img
            src="https://images.unsplash.com/photo-1525507119028-ed4c629a60a3?w=1000"
            alt="Fashion collection"
          />
        </div>

        <div className="editorial-content">
          <span className="eyebrow">THE STYLO PHILOSOPHY</span>
          <h2>Beauty in<br />the details.</h2>
          <p>
            We believe that every woman deserves to feel confident,
            comfortable and beautiful. STYLO brings together thoughtfully
            selected styles to help you express your individuality.
          </p>
          <a href="#trending" className="text-link">
            EXPLORE OUR COLLECTION <span>→</span>
          </a>
        </div>
      </section>

      {/* NEWSLETTER */}

      <section className="newsletter-section">
        <div>
          <span className="eyebrow">STAY IN THE STYLE LOOP</span>
          <h2>A little love in your inbox.</h2>
          <p>
            Subscribe for new arrivals, fashion inspiration and
            exclusive offers.
          </p>
        </div>

        <form className="newsletter-form" onSubmit={handleNewsletter}>
          <input
            type="email"
            placeholder="Enter your email address"
            value={newsletterEmail}
            onChange={(event) => setNewsletterEmail(event.target.value)}
            required
          />

          <button type="submit">SUBSCRIBE →</button>

          {newsletterMessage && (
            <p className="form-message">{newsletterMessage}</p>
          )}
        </form>
      </section>

      {/* FOOTER */}

      <footer className="stylo-footer">
        <div className="footer-main">
          <div className="footer-brand">
            <Link to="/" className="stylo-logo footer-logo">
              STYLO<span>.</span>
              <small>THE ART OF DRESSING</small>
            </Link>

            <p>
              Discover your signature style with thoughtfully curated
              fashion, made to celebrate you.
            </p>
          </div>

          <div className="footer-column">
            <h4>SHOP</h4>
            <a href="#categories">Categories</a>
            <a href="#trending">New Arrivals</a>
            <a href="#smart-outfit">Smart Outfit</a>
          </div>

          <div className="footer-column">
            <h4>MY ACCOUNT</h4>

            <Link
              to={profile ? "/profile" : "/login"}
              state={profile ? undefined : { from: { pathname: "/profile" } }}
            >
              My Profile
            </Link>

            <Link
              to={profile ? "/orders" : "/login"}
              state={profile ? undefined : { from: { pathname: "/orders" } }}
            >
              My Orders
            </Link>

            <Link
              to={profile ? "/wishlist" : "/login"}
              state={profile ? undefined : { from: { pathname: "/wishlist" } }}
            >
              Wishlist
            </Link>

            <Link
              to={profile ? "/cart" : "/login"}
              state={profile ? undefined : { from: { pathname: "/cart" } }}
            >
              Shopping Cart
            </Link>
          </div>

          <div className="footer-column">
            <h4>HELP & SUPPORT</h4>
            <a href="mailto:support@stylo.com">Contact Us</a>
            <a href="#about">About STYLO</a>
            <a href="mailto:support@stylo.com">Customer Support</a>
          </div>
        </div>

        <div className="footer-bottom">
          <p>© 2026 STYLO. All rights reserved.</p>
          <p>Designed with elegance. Made with care. ✦</p>
        </div>
      </footer>

      {/* SHOPPING ASSISTANT */}

      <button
        type="button"
        className="assistant-toggle"
        onClick={() => setAssistantOpen((previous) => !previous)}
        aria-label="Open shopping assistant"
      >
        {assistantOpen ? "×" : "✦"}
      </button>

      {assistantOpen && (
        <div className="assistant-panel">
          <div className="assistant-header">
            <div>
              <span>✦ STYLO ASSISTANT</span>
              <small>Here to help you find your style</small>
            </div>

            <button
              type="button"
              onClick={() => setAssistantOpen(false)}
              aria-label="Close assistant"
            >
              ×
            </button>
          </div>

          <div className="assistant-body">
            <div className="assistant-message">{assistantReply}</div>

            <div className="assistant-suggestions">
              <button
                type="button"
                onClick={() => {
                  setAssistantQuestion("Show me modest wear");
                  setAssistantReply("Explore our Modest Wear category for graceful everyday styles.");
                }}
              >
                Modest wear
              </button>

              <button
                type="button"
                onClick={() => {
                  setAssistantQuestion("Show party wear");
                  setAssistantReply("Explore our Party Wear collection for special occasions.");
                }}
              >
                Party wear
              </button>

              <button
                type="button"
                onClick={() => {
                  setAssistantQuestion("Help me with my budget outfit");
                  setAssistantReply("Use the Smart Outfit Builder to create a look within your budget.");
                }}
              >
                Budget outfit
              </button>
            </div>
          </div>

          <form className="assistant-input" onSubmit={askAssistant}>
            <input
              type="text"
              placeholder="Ask something..."
              value={assistantQuestion}
              onChange={(event) => setAssistantQuestion(event.target.value)}
            />

            <button type="submit" aria-label="Send message">→</button>
          </form>
        </div>
      )}

    </main>
  );
}
