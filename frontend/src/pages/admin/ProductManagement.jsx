
import { useCallback, useEffect, useMemo, useState } from "react";
import { adminApi } from "../../api";
import "./ProductManagement.css";

const PAGE_SIZE = 10;

const EMPTY_PRODUCT = {
  name: "",
  category: "",
  description: "",
  brand: "",
  material: "",
  care_instructions: "",
  highlights: "",
  publication_status: "draft",
  is_active: true,
};

const EMPTY_VARIANT = {
  color: "",
  size: "",
  sku: "",
  regular_price: "",
  sale_price: "",
  stock: 0,
  is_active: true,
};

function getErrorMessage(error) {
  const data = error?.response?.data;

  if (!data) {
    return "Unable to connect to the server. Please check whether Django is running.";
  }

  if (typeof data === "string") return data;
  if (data.detail) return data.detail;
  if (data.message) return data.message;

  return Object.entries(data)
    .map(([key, value]) => {
      const message = Array.isArray(value)
        ? value.join(", ")
        : typeof value === "object"
        ? JSON.stringify(value)
        : value;

      return `${key}: ${message}`;
    })
    .join(" | ");
}

function getImageUrl(image) {
  if (!image) return "";

  if (typeof image === "string") return image;

  return image.image_url || image.image || "";
}

function formatPrice(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) return "—";

  return `₹${number.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function ProductManagement() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [colors, setColors] = useState([]);
  const [sizes, setSizes] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeFilter, setActiveFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");

  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productForm, setProductForm] = useState(EMPTY_PRODUCT);

  const [selectedImages, setSelectedImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);

  const [showVariantModal, setShowVariantModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [variants, setVariants] = useState([]);
  const [variantForm, setVariantForm] = useState(EMPTY_VARIANT);
  const [editingVariant, setEditingVariant] = useState(null);
  const [variantLoading, setVariantLoading] = useState(false);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // ------------------------------------------
  // ADMIN AUTH ERROR HANDLING
  // ------------------------------------------

  const handleAdminError = useCallback((err) => {
    if (
      err?.response?.status === 401 ||
      err?.response?.status === 403
    ) {
      localStorage.removeItem("admin_access");
      localStorage.removeItem("admin_refresh");

      window.dispatchEvent(new Event("authChanged"));

      window.location.replace("/admin/login");
      return true;
    }

    return false;
  }, []);

  // ------------------------------------------
  // FETCH PRODUCTS
  // ------------------------------------------

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = {
        page,
        page_size: PAGE_SIZE,
      };

      if (search.trim()) {
        params.search = search.trim();
      }

      if (categoryFilter !== "all") {
        params.category = categoryFilter;
      }

      if (statusFilter !== "all") {
        params.publication_status = statusFilter;
      }

      if (activeFilter !== "all") {
        params.is_active = activeFilter === "active";
      }

      const response = await adminApi.get("products/", { params });

      const data = response.data;
      const list = Array.isArray(data)
        ? data
        : data.results || [];

      setProducts(list);
      setTotalCount(
        Array.isArray(data)
          ? data.length
          : Number(data.count || 0)
      );
    } catch (err) {
      if (handleAdminError(err)) return;

      setProducts([]);
      setTotalCount(0);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [
    page,
    search,
    categoryFilter,
    statusFilter,
    activeFilter,
    handleAdminError,
  ]);

  // ------------------------------------------
  // FETCH MASTER DATA
  // ------------------------------------------

  const fetchMasterData = useCallback(async () => {
    try {
      const [categoryRes, colorRes, sizeRes] =
        await Promise.all([
          adminApi.get("categories/"),
          adminApi.get("colors/"),
          adminApi.get("sizes/"),
        ]);

      const getList = (response) => {
        const data = response.data;
        return Array.isArray(data)
          ? data
          : data.results || [];
      };

      setCategories(
        getList(categoryRes).filter(
          (item) => !item.is_deleted && item.is_active
        )
      );

      setColors(
        getList(colorRes).filter(
          (item) => !item.is_deleted && item.is_active
        )
      );

      setSizes(
        getList(sizeRes).filter(
          (item) => !item.is_deleted && item.is_active
        )
      );
    } catch (err) {
      if (handleAdminError(err)) return;

      setError((previous) =>
        previous ||
        `Unable to load categories, colors or sizes. ${getErrorMessage(err)}`
      );
    }
  }, [handleAdminError]);

  useEffect(() => {
    fetchMasterData();
  }, [fetchMasterData]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // ------------------------------------------
  // PRODUCT STATISTICS
  // ------------------------------------------

  const statistics = useMemo(() => {
    const active = products.filter((p) => p.is_active).length;
    const inactive = products.filter((p) => !p.is_active).length;

    const getStock = (product) =>
      (product.variants || []).reduce(
        (total, variant) => total + Number(variant.stock || 0),
        0
      );

    const lowStock = products.filter((p) => {
      const stock = getStock(p);
      return stock > 0 && stock <= 5;
    }).length;

    const outOfStock = products.filter(
      (p) => getStock(p) === 0
    ).length;

    return {
      active,
      inactive,
      lowStock,
      outOfStock,
    };
  }, [products]);

  // ------------------------------------------
  // CLIENT-SIDE STOCK FILTER
  // ------------------------------------------

  const visibleProducts = useMemo(() => {
    return products.filter((product) => {
      const stock = (product.variants || []).reduce(
        (total, variant) => total + Number(variant.stock || 0),
        0
      );

      if (stockFilter === "low" && !(stock > 0 && stock <= 5)) {
        return false;
      }

      if (stockFilter === "out" && stock !== 0) {
        return false;
      }

      if (stockFilter === "available" && stock <= 0) {
        return false;
      }

      return true;
    });
  }, [products, stockFilter]);

  // ------------------------------------------
  // PRODUCT FORM
  // ------------------------------------------

  const handleProductChange = (event) => {
    const { name, value, type, checked } = event.target;

    setProductForm((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const openAddProduct = () => {
    setEditingProduct(null);
    setProductForm(EMPTY_PRODUCT);
    setSelectedImages([]);
    setImagePreviews([]);
    setError("");
    setMessage("");
    setShowProductModal(true);
  };

  const openEditProduct = (product) => {
    setEditingProduct(product);

    setProductForm({
      name: product.name || "",
      category: product.category || "",
      description: product.description || "",
      brand: product.brand || "",
      material: product.material || "",
      care_instructions: product.care_instructions || "",
      highlights: Array.isArray(product.highlights)
        ? product.highlights.join("\n")
        : "",
      publication_status: product.publication_status || "draft",
      is_active: Boolean(product.is_active),
    });

    setSelectedImages([]);
    setImagePreviews([]);
    setError("");
    setMessage("");
    setShowProductModal(true);
  };

  const handleImageSelection = (event) => {
    const files = Array.from(event.target.files || []);

    setImagePreviews((previous) => {
      previous.forEach((url) => URL.revokeObjectURL(url));
      return files.map((file) => URL.createObjectURL(file));
    });

    setSelectedImages(files);
  };

  const uploadProductImages = async (productId) => {
    if (!selectedImages.length) return;

    const formData = new FormData();

    formData.append("product_id", productId);

    selectedImages.forEach((image) => {
      formData.append("images", image);
    });

    await adminApi.post("product-images/", formData);
  };

  const handleProductSubmit = async (event) => {
    event.preventDefault();

    if (!productForm.category) {
      setError("Please select a category.");
      return;
    }

    if (!productForm.name.trim()) {
      setError("Product name is required.");
      return;
    }

    if (!productForm.description.trim()) {
      setError("Product description is required.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    const payload = {
      name: productForm.name.trim(),
      category: Number(productForm.category),
      description: productForm.description.trim(),
      brand: productForm.brand.trim(),
      material: productForm.material.trim(),
      care_instructions: productForm.care_instructions.trim(),
      highlights: productForm.highlights
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean),
      publication_status: productForm.publication_status,
      is_active: productForm.is_active,
    };

    try {
      let productId;

      if (editingProduct) {
        const response = await adminApi.patch(
          `products/${editingProduct.id}/`,
          payload
        );

        productId = response.data.id || editingProduct.id;
      } else {
        const response = await adminApi.post("products/", payload);
        productId = response.data.id;
      }

      if (selectedImages.length > 0) {
        await uploadProductImages(productId);
      }

      setMessage(
        editingProduct
          ? "Product updated successfully."
          : "Product created successfully."
      );

      setShowProductModal(false);
      setSelectedImages([]);
      setImagePreviews([]);

      await fetchProducts();
    } catch (err) {
      if (!handleAdminError(err)) {
        setError(getErrorMessage(err));
      }
    } finally {
      setSaving(false);
    }
  };

  // ------------------------------------------
  // PRODUCT STATUS
  // ------------------------------------------

  const toggleProductStatus = async (product) => {
    const nextStatus = !product.is_active;

    const confirmed = window.confirm(
      `Are you sure you want to ${nextStatus ? "activate" : "deactivate"} "${product.name}"?`
    );

    if (!confirmed) return;

    setError("");
    setMessage("");

    try {
      await adminApi.patch(`products/${product.id}/`, {
        is_active: nextStatus,
      });

      setMessage(
        nextStatus
          ? "Product activated successfully."
          : "Product deactivated successfully."
      );

      await fetchProducts();
    } catch (err) {
      if (!handleAdminError(err)) {
        setError(getErrorMessage(err));
      }
    }
  };

  // ------------------------------------------
  // SOFT DELETE PRODUCT
  // ------------------------------------------

  const deleteProduct = async (product) => {
    const confirmed = window.confirm(
      `Delete "${product.name}"? This will soft-delete the product.`
    );

    if (!confirmed) return;

    setError("");
    setMessage("");

    try {
      await adminApi.delete(`products/${product.id}/`);

      setMessage("Product moved to deleted items successfully.");

      if (products.length === 1 && page > 1) {
        setPage((previous) => previous - 1);
      } else {
        await fetchProducts();
      }
    } catch (err) {
      if (!handleAdminError(err)) {
        setError(getErrorMessage(err));
      }
    }
  };

  // ------------------------------------------
  // VARIANT MANAGEMENT
  // ------------------------------------------

  const fetchVariants = async (productId) => {
    const response = await adminApi.get("product-variants/", {
      params: {
        product: productId,
        page_size: 50,
      },
    });

    const data = response.data;
    const list = Array.isArray(data)
      ? data
      : data.results || [];

    setVariants(
      list.filter(
        (variant) => Number(variant.product) === Number(productId)
      )
    );
  };

  const openVariantManager = async (product) => {
    setSelectedProduct(product);
    setVariants([]);
    setVariantForm(EMPTY_VARIANT);
    setEditingVariant(null);
    setShowVariantModal(true);
    setVariantLoading(true);
    setError("");

    try {
      await fetchVariants(product.id);
    } catch (err) {
      if (!handleAdminError(err)) {
        setError(getErrorMessage(err));
      }
    } finally {
      setVariantLoading(false);
    }
  };

  const handleVariantChange = (event) => {
    const { name, value, type, checked } = event.target;

    setVariantForm((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const resetVariantForm = () => {
    setVariantForm(EMPTY_VARIANT);
    setEditingVariant(null);
  };

  const editVariant = (variant) => {
    setEditingVariant(variant);

    setVariantForm({
      color: variant.color || "",
      size: variant.size || "",
      sku: variant.sku || "",
      regular_price: variant.regular_price || "",
      sale_price: variant.sale_price || "",
      stock: variant.stock ?? 0,
      is_active: Boolean(variant.is_active),
    });
  };

  const saveVariant = async (event) => {
    event.preventDefault();

    if (!selectedProduct) return;

    if (!variantForm.color || !variantForm.size) {
      setError("Please select both color and size.");
      return;
    }

    const regularPrice = Number(variantForm.regular_price);
    const salePrice =
      variantForm.sale_price === ""
        ? null
        : Number(variantForm.sale_price);

    if (!regularPrice || regularPrice <= 0) {
      setError("Regular price must be greater than zero.");
      return;
    }

    if (
      salePrice !== null &&
      (salePrice <= 0 || salePrice >= regularPrice)
    ) {
      setError("Sale price must be lower than regular price.");
      return;
    }

    const payload = {
      product: selectedProduct.id,
      color: Number(variantForm.color),
      size: Number(variantForm.size),
      sku: variantForm.sku.trim().toUpperCase(),
      regular_price: regularPrice,
      sale_price: salePrice,
      stock: Number(variantForm.stock),
      is_active: variantForm.is_active,
    };

    setSaving(true);
    setError("");

    try {
      if (editingVariant) {
        await adminApi.patch(
          `product-variants/${editingVariant.id}/`,
          payload
        );
      } else {
        await adminApi.post("product-variants/", payload);
      }

      setMessage(
        editingVariant
          ? "Variant updated successfully."
          : "Variant added successfully."
      );

      resetVariantForm();

      await fetchVariants(selectedProduct.id);
      await fetchProducts();
    } catch (err) {
      if (!handleAdminError(err)) {
        setError(getErrorMessage(err));
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleVariantStatus = async (variant) => {
    try {
      await adminApi.patch(`product-variants/${variant.id}/`, {
        is_active: !variant.is_active,
      });

      setVariants((previous) =>
        previous.map((item) =>
          item.id === variant.id
            ? { ...item, is_active: !item.is_active }
            : item
        )
      );

      await fetchProducts();
    } catch (err) {
      if (!handleAdminError(err)) {
        setError(getErrorMessage(err));
      }
    }
  };

  // ------------------------------------------
  // HELPERS
  // ------------------------------------------

  const getProductPrice = (product) => {
    const activeVariants = (product.variants || []).filter(
      (variant) => variant.is_active
    );

    if (!activeVariants.length) return "—";

    const prices = activeVariants
      .map((variant) =>
        Number(
          variant.current_price ??
          variant.sale_price ??
          variant.regular_price
        )
      )
      .filter(Number.isFinite);

    if (!prices.length) return "—";

    const min = Math.min(...prices);
    const max = Math.max(...prices);

    return min === max
      ? formatPrice(min)
      : `${formatPrice(min)} – ${formatPrice(max)}`;
  };

  const getProductStock = (product) =>
    (product.variants || []).reduce(
      (total, variant) =>
        total +
        (variant.is_active ? Number(variant.stock || 0) : 0),
      0
    );

  const getProductImage = (product) => {
    const primary = (product.images || []).find(
      (image) => image.is_primary
    );

    return getImageUrl(primary || product.images?.[0]);
  };

  const clearFilters = () => {
    setSearch("");
    setCategoryFilter("all");
    setStatusFilter("all");
    setActiveFilter("all");
    setStockFilter("all");
    setPage(1);
  };

  // ------------------------------------------
  // RENDER
  // ------------------------------------------

  return (
    <div className="product-management-page">
      <div className="pm-header">
        <div>
          <span className="pm-eyebrow">STYLO ADMINISTRATION</span>
          <h1>Product Management</h1>
          <p>
            Manage your fashion catalogue, product variants,
            pricing, images and inventory.
          </p>
        </div>

        <button
          type="button"
          className="pm-primary-btn"
          onClick={openAddProduct}
        >
          <span>＋</span> Add New Product
        </button>
      </div>

      {message && (
        <div className="pm-alert pm-alert-success">
          <span>✓</span>
          {message}
          <button
            onClick={() => setMessage("")}
            type="button"
          >
            ×
          </button>
        </div>
      )}

      {error && (
        <div className="pm-alert pm-alert-error">
          <span>!</span>
          <span>{error}</span>
          <button
            onClick={() => setError("")}
            type="button"
          >
            ×
          </button>
        </div>
      )}

      <section className="pm-stat-grid">
        <div className="pm-stat-card">
          <div className="pm-stat-icon">▣</div>
          <div>
            <span>Total Products</span>
            <strong>{totalCount}</strong>
            <small>Matching catalogue</small>
          </div>
        </div>

        <div className="pm-stat-card">
          <div className="pm-stat-icon green">✓</div>
          <div>
            <span>Active on Page</span>
            <strong>{statistics.active}</strong>
            <small>Currently enabled</small>
          </div>
        </div>

        <div className="pm-stat-card">
          <div className="pm-stat-icon muted">Ⅱ</div>
          <div>
            <span>Inactive on Page</span>
            <strong>{statistics.inactive}</strong>
            <small>Currently disabled</small>
          </div>
        </div>

        <div className="pm-stat-card">
          <div className="pm-stat-icon amber">!</div>
          <div>
            <span>Low Stock</span>
            <strong>{statistics.lowStock}</strong>
            <small>1–5 units on this page</small>
          </div>
        </div>

        <div className="pm-stat-card">
          <div className="pm-stat-icon red">×</div>
          <div>
            <span>Out of Stock</span>
            <strong>{statistics.outOfStock}</strong>
            <small>No active variant stock</small>
          </div>
        </div>
      </section>

      <section className="pm-catalogue">
        <div className="pm-section-heading">
          <div>
            <span className="pm-eyebrow">YOUR INVENTORY</span>
            <h2>All Products</h2>
            <p>{totalCount} products in the current result</p>
          </div>

          <button
            type="button"
            className="pm-refresh-btn"
            onClick={fetchProducts}
            disabled={loading}
          >
            ↻ Refresh
          </button>
        </div>

        <div className="pm-filter-bar">
          <div className="pm-search">
            <span>⌕</span>
            <input
              type="search"
              placeholder="Search name, description or brand..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(event) => {
              setCategoryFilter(event.target.value);
              setPage(1);
            }}
          >
            <option value="all">All Categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setPage(1);
            }}
          >
            <option value="all">All Publication</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="unpublished">Unpublished</option>
          </select>

          <select
            value={activeFilter}
            onChange={(event) => {
              setActiveFilter(event.target.value);
              setPage(1);
            }}
          >
            <option value="all">All Activity</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          <select
            value={stockFilter}
            onChange={(event) => setStockFilter(event.target.value)}
          >
            <option value="all">All Stock</option>
            <option value="available">In Stock</option>
            <option value="low">Low Stock</option>
            <option value="out">Out of Stock</option>
          </select>

          <button
            type="button"
            className="pm-clear-btn"
            onClick={clearFilters}
          >
            Clear
          </button>
        </div>

        <div className="pm-table-wrap">
          {loading ? (
            <div className="pm-empty-state">
              <div className="pm-spinner" />
              <h3>Loading products</h3>
              <p>Please wait while we load your catalogue.</p>
            </div>
          ) : visibleProducts.length === 0 ? (
            <div className="pm-empty-state">
              <div className="pm-empty-icon">▤</div>
              <h3>No products found</h3>
              <p>
                Try changing your filters, or add a new product
                to your catalogue.
              </p>
              <button
                type="button"
                className="pm-primary-btn"
                onClick={clearFilters}
              >
                Clear filters
              </button>
            </div>
          ) : (
            <table className="pm-table">
              <thead>
                <tr>
                  <th>PRODUCT</th>
                  <th>CATEGORY</th>
                  <th>PRICE</th>
                  <th>STOCK</th>
                  <th>VARIANTS</th>
                  <th>PUBLICATION</th>
                  <th>STATUS</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>

              <tbody>
                {visibleProducts.map((product) => {
                  const image = getProductImage(product);
                  const stock = getProductStock(product);
                  const variantCount = (product.variants || []).length;

                  return (
                    <tr key={product.id}>
                      <td>
                        <div className="pm-product-cell">
                          <div className="pm-product-image">
                            {image ? (
                              <img src={image} alt={product.name} />
                            ) : (
                              <span>ST</span>
                            )}
                          </div>

                          <div className="pm-product-info">
                            <strong>{product.name}</strong>
                            <small>
                              {product.brand || "STYLO Collection"}
                            </small>
                            <small>#{product.id}</small>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span className="pm-category-tag">
                          {product.category_name ||
                            categories.find(
                              (item) =>
                                Number(item.id) === Number(product.category)
                            )?.name ||
                            "Uncategorised"}
                        </span>
                      </td>

                      <td className="pm-price-cell">
                        {getProductPrice(product)}
                      </td>

                      <td>
                        <span
                          className={`pm-stock ${
                            stock === 0
                              ? "stock-out"
                              : stock <= 5
                              ? "stock-low"
                              : "stock-good"
                          }`}
                        >
                          {stock}
                        </span>
                      </td>

                      <td>
                        <button
                          type="button"
                          className="pm-variant-count"
                          onClick={() => openVariantManager(product)}
                        >
                          {variantCount} variants
                        </button>
                      </td>

                      <td>
                        <span
                          className={`pm-publication ${product.publication_status}`}
                        >
                          {product.publication_status || "draft"}
                        </span>
                      </td>

                      <td>
                        <span
                          className={`pm-status ${
                            product.is_active
                              ? "status-active"
                              : "status-inactive"
                          }`}
                        >
                          <i />
                          {product.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>

                      <td>
                        <div className="pm-actions">
                          <button
                            type="button"
                            className="pm-action-btn"
                            title="Edit product"
                            onClick={() => openEditProduct(product)}
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            className="pm-action-btn"
                            title="Manage variants"
                            onClick={() => openVariantManager(product)}
                          >
                            Variants
                          </button>

                          <button
                            type="button"
                            className="pm-action-btn"
                            onClick={() => toggleProductStatus(product)}
                          >
                            {product.is_active ? "Disable" : "Enable"}
                          </button>

                          <button
                            type="button"
                            className="pm-action-btn danger"
                            onClick={() => deleteProduct(product)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {!loading && totalCount > 0 && (
          <div className="pm-pagination">
            <span>
              Showing {visibleProducts.length} products on page {page} of {totalPages}
            </span>

            <div>
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((previous) => previous - 1)}
              >
                Previous
              </button>

              <strong>{page}</strong>

              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((previous) => previous + 1)}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ADD / EDIT PRODUCT MODAL */}

      {showProductModal && (
        <div
          className="pm-modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !saving
            ) {
              setShowProductModal(false);
            }
          }}
        >
          <div className="pm-modal pm-product-modal">
            <div className="pm-modal-header">
              <div>
                <span className="pm-eyebrow">STYLO CATALOGUE</span>
                <h2>
                  {editingProduct ? "Edit Product" : "Add New Product"}
                </h2>
                <p>Enter the product details below.</p>
              </div>

              <button
                type="button"
                className="pm-modal-close"
                onClick={() => setShowProductModal(false)}
                disabled={saving}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleProductSubmit}>
              <div className="pm-form-grid">
                <div className="pm-field pm-field-full">
                  <label>Product Name *</label>
                  <input
                    name="name"
                    value={productForm.name}
                    onChange={handleProductChange}
                    placeholder="Example: Elegant Floral Maxi Dress"
                    required
                  />
                </div>

                <div className="pm-field">
                  <label>Category *</label>
                  <select
                    name="category"
                    value={productForm.category}
                    onChange={handleProductChange}
                    required
                  >
                    <option value="">Select category</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="pm-field">
                  <label>Brand</label>
                  <input
                    name="brand"
                    value={productForm.brand}
                    onChange={handleProductChange}
                    placeholder="STYLO"
                  />
                </div>

                <div className="pm-field pm-field-full">
                  <label>Description *</label>
                  <textarea
                    name="description"
                    rows="4"
                    value={productForm.description}
                    onChange={handleProductChange}
                    placeholder="Write a detailed product description..."
                    required
                  />
                </div>

                <div className="pm-field">
                  <label>Material</label>
                  <input
                    name="material"
                    value={productForm.material}
                    onChange={handleProductChange}
                    placeholder="Cotton, silk, linen..."
                  />
                </div>

                <div className="pm-field">
                  <label>Publication Status</label>
                  <select
                    name="publication_status"
                    value={productForm.publication_status}
                    onChange={handleProductChange}
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="unpublished">Unpublished</option>
                  </select>
                </div>

                <div className="pm-field pm-field-full">
                  <label>Care Instructions</label>
                  <textarea
                    name="care_instructions"
                    rows="2"
                    value={productForm.care_instructions}
                    onChange={handleProductChange}
                    placeholder="Add washing and care instructions..."
                  />
                </div>

                <div className="pm-field pm-field-full">
                  <label>Product Highlights</label>
                  <textarea
                    name="highlights"
                    rows="3"
                    value={productForm.highlights}
                    onChange={handleProductChange}
                    placeholder={"Premium fabric\nComfortable fit\nElegant design"}
                  />
                  <small>Enter one highlight per line.</small>
                </div>

                <div className="pm-field pm-field-full">
                  <label>Product Images</label>
                  <div className="pm-upload-box">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImageSelection}
                    />
                    <span className="pm-upload-icon">＋</span>
                    <strong>Choose product images</strong>
                    <small>
                      Select multiple images. New images will be added to
                      this product.
                    </small>
                  </div>

                  {imagePreviews.length > 0 && (
                    <div className="pm-image-previews">
                      {imagePreviews.map((src, index) => (
                        <div key={src}>
                          <img src={src} alt={`Selected ${index + 1}`} />
                          <span>{index + 1}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pm-field pm-field-full">
                  <label className="pm-checkbox-label">
                    <input
                      type="checkbox"
                      name="is_active"
                      checked={productForm.is_active}
                      onChange={handleProductChange}
                    />
                    <span>
                      <strong>Product is active</strong>
                      <small>
                        Active products can be managed and made visible
                        according to publication settings.
                      </small>
                    </span>
                  </label>
                </div>
              </div>

              <div className="pm-modal-footer">
                <button
                  type="button"
                  className="pm-secondary-btn"
                  onClick={() => setShowProductModal(false)}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="pm-primary-btn"
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : editingProduct
                    ? "Save Changes"
                    : "Create Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VARIANT MANAGEMENT MODAL */}

      {showVariantModal && selectedProduct && (
        <div className="pm-modal-overlay">
          <div className="pm-modal pm-variant-modal">
            <div className="pm-modal-header">
              <div>
                <span className="pm-eyebrow">INVENTORY MANAGEMENT</span>
                <h2>Product Variants</h2>
                <p>{selectedProduct.name}</p>
              </div>

              <button
                type="button"
                className="pm-modal-close"
                onClick={() => setShowVariantModal(false)}
              >
                ×
              </button>
            </div>

            <div className="pm-variant-content">
              <div className="pm-variant-list">
                <h3>Existing variants</h3>

                {variantLoading ? (
                  <p className="pm-inline-message">Loading variants...</p>
                ) : variants.length === 0 ? (
                  <p className="pm-inline-message">
                    No variants added yet. Create the first variant below.
                  </p>
                ) : (
                  <div className="pm-variant-table-wrap">
                    <table className="pm-variant-table">
                      <thead>
                        <tr>
                          <th>SKU</th>
                          <th>Color</th>
                          <th>Size</th>
                          <th>Price</th>
                          <th>Stock</th>
                          <th>Status</th>
                          <th>Action</th>
                        </tr>
                      </thead>

                      <tbody>
                        {variants.map((variant) => (
                          <tr key={variant.id}>
                            <td>{variant.sku}</td>

                            <td>
                              <span className="pm-color-name">
                                <i
                                  style={{
                                    background: variant.color_hex || "#ddd",
                                  }}
                                />
                                {variant.color_name || "—"}
                              </span>
                            </td>

                            <td>{variant.size_name || "—"}</td>

                            <td>
                              {formatPrice(
                                variant.current_price ||
                                variant.sale_price ||
                                variant.regular_price
                              )}
                            </td>

                            <td>{variant.stock}</td>

                            <td>
                              <span
                                className={`pm-status ${
                                  variant.is_active
                                    ? "status-active"
                                    : "status-inactive"
                                }`}
                              >
                                <i />
                                {variant.is_active ? "Active" : "Inactive"}
                              </span>
                            </td>

                            <td>
                              <div className="pm-actions">
                                <button
                                  type="button"
                                  className="pm-action-btn"
                                  onClick={() => editVariant(variant)}
                                >
                                  Edit
                                </button>

                                <button
                                  type="button"
                                  className="pm-action-btn"
                                  onClick={() => toggleVariantStatus(variant)}
                                >
                                  {variant.is_active ? "Disable" : "Enable"}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <form className="pm-variant-form" onSubmit={saveVariant}>
                <div className="pm-variant-form-heading">
                  <h3>
                    {editingVariant ? "Edit Variant" : "Add New Variant"}
                  </h3>

                  {editingVariant && (
                    <button
                      type="button"
                      className="pm-text-btn"
                      onClick={resetVariantForm}
                    >
                      Cancel edit
                    </button>
                  )}
                </div>

                <div className="pm-form-grid">
                  <div className="pm-field">
                    <label>Color *</label>
                    <select
                      name="color"
                      value={variantForm.color}
                      onChange={handleVariantChange}
                      required
                    >
                      <option value="">Select color</option>
                      {colors.map((color) => (
                        <option key={color.id} value={color.id}>
                          {color.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="pm-field">
                    <label>Size *</label>
                    <select
                      name="size"
                      value={variantForm.size}
                      onChange={handleVariantChange}
                      required
                    >
                      <option value="">Select size</option>
                      {sizes.map((size) => (
                        <option key={size.id} value={size.id}>
                          {size.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="pm-field pm-field-full">
                    <label>SKU *</label>
                    <input
                      name="sku"
                      value={variantForm.sku}
                      onChange={handleVariantChange}
                      placeholder="STY-DRESS-BLK-M"
                      required
                    />
                  </div>

                  <div className="pm-field">
                    <label>Regular Price (₹) *</label>
                    <input
                      type="number"
                      name="regular_price"
                      min="0.01"
                      step="0.01"
                      value={variantForm.regular_price}
                      onChange={handleVariantChange}
                      required
                    />
                  </div>

                  <div className="pm-field">
                    <label>Sale Price (₹)</label>
                    <input
                      type="number"
                      name="sale_price"
                      min="0.01"
                      step="0.01"
                      value={variantForm.sale_price}
                      onChange={handleVariantChange}
                      placeholder="Optional"
                    />
                  </div>

                  <div className="pm-field">
                    <label>Stock Quantity *</label>
                    <input
                      type="number"
                      name="stock"
                      min="0"
                      step="1"
                      value={variantForm.stock}
                      onChange={handleVariantChange}
                      required
                    />
                  </div>

                  <div className="pm-field pm-field-full">
                    <label className="pm-checkbox-label">
                      <input
                        type="checkbox"
                        name="is_active"
                        checked={variantForm.is_active}
                        onChange={handleVariantChange}
                      />
                      <span>
                        <strong>Variant is active</strong>
                      </span>
                    </label>
                  </div>
                </div>

                <div className="pm-modal-footer">
                  <button
                    type="button"
                    className="pm-secondary-btn"
                    onClick={resetVariantForm}
                  >
                    Reset
                  </button>

                  <button
                    type="submit"
                    className="pm-primary-btn"
                    disabled={saving}
                  >
                    {saving
                      ? "Saving..."
                      : editingVariant
                      ? "Update Variant"
                      : "Add Variant"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProductManagement;
