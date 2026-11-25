
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api";
import "./ProductVariantManagement.css";

const initialForm = {
  product: "",
  color: "",
  size: "",
  sku: "",
  regular_price: "",
  sale_price: "",
  stock: "0",
  is_active: true,
};

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

function getResults(data) {
  if (Array.isArray(data)) return data;
  return data?.results || [];
}

function ProductVariantManagement() {
  const [products, setProducts] = useState([]);
  const [colors, setColors] = useState([]);
  const [sizes, setSizes] = useState([]);
  const [variants, setVariants] = useState([]);

  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");

  const [page, setPage] = useState(1);
  const [nextPage, setNextPage] = useState(null);
  const [previousPage, setPreviousPage] = useState(null);
  const [totalCount, setTotalCount] = useState(0);

  const fetchData = useCallback(async (pageNumber = 1) => {
    setLoading(true);
    setError("");

    try {
      const [productRes, colorRes, sizeRes, variantRes] =
        await Promise.all([
          api.get("products/"),
          api.get("colors/"),
          api.get("sizes/"),
          api.get("product-variants/", {
            params: { page: pageNumber },
          }),
        ]);

      setProducts(getResults(productRes.data));
      setColors(getResults(colorRes.data));
      setSizes(getResults(sizeRes.data));

      setVariants(getResults(variantRes.data));

      setTotalCount(
        Array.isArray(variantRes.data)
          ? variantRes.data.length
          : variantRes.data.count || 0
      );

      setNextPage(
        Array.isArray(variantRes.data)
          ? null
          : variantRes.data.next
      );

      setPreviousPage(
        Array.isArray(variantRes.data)
          ? null
          : variantRes.data.previous
      );

      setPage(pageNumber);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
        "Unable to load product variant information."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(1);
  }, [fetchData]);

  // Form change handler
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));

    setError("");
    setMessage("");
  };

  // Auto generate SKU
  const generateSKU = () => {
    const product = products.find(
      (item) => String(item.id) === String(form.product)
    );

    const color = colors.find(
      (item) => String(item.id) === String(form.color)
    );

    const size = sizes.find(
      (item) => String(item.id) === String(form.size)
    );

    if (!product || !color || !size) {
      setError("Select Product, Color and Size before generating SKU.");
      return;
    }

    const slug = (value) =>
      String(value)
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

    const productCode = slug(product.name).split("-").slice(0, 2).join("-");
    const generatedSKU = `STY-${productCode}-${slug(color.name)}-${slug(size.name)}`;

    setForm((prev) => ({
      ...prev,
      sku: generatedSKU,
    }));

    setError("");
  };

  // Reset form
  const resetForm = () => {
    setForm(initialForm);
    setEditingId(null);
    setError("");
    setMessage("");
  };

  // Submit form
  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setMessage("");

    if (!form.product || !form.color || !form.size) {
      setError("Please select Product, Color and Size.");
      return;
    }

    const regularPrice = Number(form.regular_price);
    const salePrice =
      form.sale_price === "" ? null : Number(form.sale_price);

    const stock = Number(form.stock);

    if (!Number.isFinite(regularPrice) || regularPrice <= 0) {
      setError("Regular price must be greater than zero.");
      return;
    }

    if (
      salePrice !== null &&
      (!Number.isFinite(salePrice) ||
        salePrice <= 0 ||
        salePrice >= regularPrice)
    ) {
      setError("Sale price must be greater than zero and less than regular price.");
      return;
    }

    if (!Number.isInteger(stock) || stock < 0) {
      setError("Stock must be a valid non-negative whole number.");
      return;
    }

    if (!form.sku.trim()) {
      setError("SKU is required. Enter it or generate one.");
      return;
    }

    const payload = {
      product: Number(form.product),
      color: Number(form.color),
      size: Number(form.size),
      sku: form.sku.trim().toUpperCase(),
      regular_price: regularPrice.toFixed(2),
      sale_price: salePrice === null ? null : salePrice.toFixed(2),
      stock,
      is_active: form.is_active,
    };

    setSaving(true);

    try {
      if (editingId) {
        await api.patch(
          `product-variants/${editingId}/`,
          payload
        );

        setMessage("Product variant updated successfully.");
      } else {
        await api.post("product-variants/", payload);
        setMessage("Product variant created successfully.");
      }

      resetForm();
      await fetchData(1);

      setMessage(
        editingId
          ? "Product variant updated successfully."
          : "Product variant created successfully."
      );
    } catch (err) {
      const data = err.response?.data;

      const errorMessage = data
        ? Object.entries(data)
            .map(([field, value]) => {
              const details = Array.isArray(value)
                ? value.join(", ")
                : typeof value === "object"
                  ? JSON.stringify(value)
                  : value;

              return `${field}: ${details}`;
            })
            .join(" | ")
        : "Unable to save product variant.";

      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  // Edit variant
  const handleEdit = (variant) => {
    setForm({
      product: String(variant.product),
      color: String(variant.color),
      size: String(variant.size),
      sku: variant.sku || "",
      regular_price: String(variant.regular_price ?? ""),
      sale_price:
        variant.sale_price === null || variant.sale_price === undefined
          ? ""
          : String(variant.sale_price),
      stock: String(variant.stock ?? 0),
      is_active: variant.is_active,
    });

    setEditingId(variant.id);
    setError("");
    setMessage("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // Deactivate variant
  const handleDeactivate = async (variant) => {
    const confirmed = window.confirm(
      `Are you sure you want to deactivate ${variant.sku}?`
    );

    if (!confirmed) return;

    setError("");
    setMessage("");

    try {
      await api.delete(`product-variants/${variant.id}/`);

      setMessage("Product variant deactivated successfully.");

      if (editingId === variant.id) {
        resetForm();
      }

      await fetchData(page);
      setMessage("Product variant deactivated successfully.");
    } catch (err) {
      setError(
        err.response?.data?.detail ||
        "Unable to deactivate product variant."
      );
    }
  };

  // Product name helper
  const getProductName = (productId) => {
    return (
      products.find(
        (product) => String(product.id) === String(productId)
      )?.name || `Product #${productId}`
    );
  };

  // Filter current page variants
  const filteredVariants = useMemo(() => {
    return variants.filter((variant) => {
      const product = getProductName(variant.product);

      const searchText = [
        product,
        variant.sku,
        variant.color_name,
        variant.size_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = searchText.includes(
        search.trim().toLowerCase()
      );

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && variant.is_active) ||
        (statusFilter === "inactive" && !variant.is_active);

      const matchesStock =
        stockFilter === "all" ||
        (stockFilter === "in-stock" && Number(variant.stock) > 0) ||
        (stockFilter === "out-of-stock" && Number(variant.stock) === 0);

      return matchesSearch && matchesStatus && matchesStock;
    });
  }, [variants, search, statusFilter, stockFilter, products]);

  const activeCount = variants.filter((v) => v.is_active).length;
  const inactiveCount = variants.length - activeCount;
  const outOfStockCount = variants.filter(
    (v) => Number(v.stock) === 0
  ).length;

  if (loading && variants.length === 0) {
    return (
      <div className="variant-page">
        <p className="variant-loading">Loading product variants...</p>
      </div>
    );
  }

  return (
    <div className="variant-page">
      <header className="variant-header">
        <div>
          <Link to="/admin/dashboard" className="variant-back-link">
            ← Back to Dashboard
          </Link>

          <h1>Product Variant Management</h1>

          <p>
            Manage product combinations, SKU, pricing and inventory.
          </p>
        </div>
      </header>

      {error && (
        <div className="variant-alert variant-alert-error">
          {error}
        </div>
      )}

      {message && (
        <div className="variant-alert variant-alert-success">
          {message}
        </div>
      )}

      {/* Statistics */}
      <section className="variant-stats">
        <div className="variant-stat-card">
          <span>Total Variants</span>
          <strong>{totalCount}</strong>
        </div>

        <div className="variant-stat-card">
          <span>Active on This Page</span>
          <strong>{activeCount}</strong>
        </div>

        <div className="variant-stat-card">
          <span>Inactive on This Page</span>
          <strong>{inactiveCount}</strong>
        </div>

        <div className="variant-stat-card">
          <span>Out of Stock</span>
          <strong>{outOfStockCount}</strong>
        </div>
      </section>

      {/* Variant Form */}
      <section className="variant-form-section">
        <div className="variant-section-heading">
          <div>
            <h2>{editingId ? "Edit Product Variant" : "Create Product Variant"}</h2>
            <p>
              Select a product, color and size to create a unique variant.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="variant-form">
          <label>
            Product <span>*</span>

            <select
              name="product"
              value={form.product}
              onChange={handleChange}
              required
            >
              <option value="">Choose a product</option>

              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>

            <small>Select an existing product from the list.</small>
          </label>

          <label>
            Color <span>*</span>

            <select
              name="color"
              value={form.color}
              onChange={handleChange}
              required
            >
              <option value="">Choose a color</option>

              {colors.map((color) => (
                <option key={color.id} value={color.id}>
                  {color.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Size <span>*</span>

            <select
              name="size"
              value={form.size}
              onChange={handleChange}
              required
            >
              <option value="">Choose a size</option>

              {sizes.map((size) => (
                <option key={size.id} value={size.id}>
                  {size.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            SKU <span>*</span>

            <div className="variant-sku-input">
              <input
                type="text"
                name="sku"
                value={form.sku}
                onChange={handleChange}
                placeholder="Example: STY-DRESS-PINK-M"
                required
              />

              <button
                type="button"
                onClick={generateSKU}
                className="variant-generate-button"
              >
                Generate
              </button>
            </div>

            <small>Unique product identification code.</small>
          </label>

          <label>
            Regular Price (₹) <span>*</span>

            <div className="variant-price-input">
              <span>₹</span>
              <input
                type="number"
                name="regular_price"
                value={form.regular_price}
                onChange={handleChange}
                placeholder="1999"
                min="0.01"
                step="0.01"
                required
                onFocus={(e) => e.target.select()}
              />
            </div>

            <small>Original selling price.</small>
          </label>

          <label>
            Sale Price (₹)

            <div className="variant-price-input">
              <span>₹</span>
              <input
                type="number"
                name="sale_price"
                value={form.sale_price}
                onChange={handleChange}
                placeholder="1499"
                min="0.01"
                step="0.01"
                onFocus={(e) => e.target.select()}
              />
            </div>

            <small>Leave empty if there is no discount.</small>
          </label>

          <label>
            Available Stock <span>*</span>

            <input
              type="number"
              name="stock"
              value={form.stock}
              onChange={handleChange}
              min="0"
              step="1"
              required
              onFocus={(e) => e.target.select()}
            />
          </label>

          <label className="variant-checkbox">
            <input
              type="checkbox"
              name="is_active"
              checked={form.is_active}
              onChange={handleChange}
            />
            <span>Variant is Active</span>
          </label>

          <div className="variant-form-actions">
            <button
              type="submit"
              disabled={saving}
              className="variant-submit-button"
            >
              {saving
                ? "Saving..."
                : editingId
                  ? "Update Variant"
                  : "Create Variant"}
            </button>

            <button
              type="button"
              onClick={resetForm}
              className="variant-reset-button"
            >
              {editingId ? "Cancel Edit" : "Clear Form"}
            </button>
          </div>
        </form>
      </section>

      {/* Variant List */}
      <section className="variant-list-section">
        <div className="variant-section-heading">
          <div>
            <h2>Existing Product Variants</h2>
            <p>{totalCount} variants in total.</p>
          </div>
        </div>

        <div className="variant-filters">
          <input
            type="search"
            placeholder="Search product, SKU, color or size..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          <select
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value)}
          >
            <option value="all">All Stock</option>
            <option value="in-stock">In Stock</option>
            <option value="out-of-stock">Out of Stock</option>
          </select>
        </div>

        <div className="variant-table-wrapper">
          <table className="variant-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Color</th>
                <th>Size</th>
                <th>SKU</th>
                <th>Regular Price</th>
                <th>Current Price</th>
                <th>Stock</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredVariants.length > 0 ? (
                filteredVariants.map((variant) => (
                  <tr key={variant.id}>
                    <td>{getProductName(variant.product)}</td>

                    <td>
                      <span className="variant-color-cell">
                        {variant.color_hex && (
                          <span
                            className="variant-color-dot"
                            style={{ backgroundColor: variant.color_hex }}
                          />
                        )}
                        {variant.color_name || variant.color}
                      </span>
                    </td>

                    <td>{variant.size_name || variant.size}</td>

                    <td>{variant.sku}</td>

                    <td>
                      {currency.format(Number(variant.regular_price))}
                    </td>

                    <td>
                      <strong>
                        {currency.format(Number(
                          variant.current_price ?? variant.regular_price
                        ))}
                      </strong>
                    </td>

                    <td>
                      <span className={
                        Number(variant.stock) > 0
                          ? "variant-stock-available"
                          : "variant-stock-empty"
                      }>
                        {variant.stock}
                      </span>
                    </td>

                    <td>
                      <span className={
                        variant.is_active
                          ? "variant-status-active"
                          : "variant-status-inactive"
                      }>
                        {variant.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>

                    <td>
                      <div className="variant-row-actions">
                        <button
                          type="button"
                          onClick={() => handleEdit(variant)}
                          className="variant-edit-button"
                        >
                          Edit
                        </button>

                        {variant.is_active && (
                          <button
                            type="button"
                            onClick={() => handleDeactivate(variant)}
                            className="variant-deactivate-button"
                          >
                            Deactivate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="9" className="variant-empty">
                    No matching product variants found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="variant-pagination">
          <button
            type="button"
            disabled={!previousPage || loading}
            onClick={() => fetchData(page - 1)}
          >
            Previous
          </button>

          <span>Page {page}</span>

          <button
            type="button"
            disabled={!nextPage || loading}
            onClick={() => fetchData(page + 1)}
          >
            Next
          </button>
        </div>
      </section>
    </div>
  );
}

export default ProductVariantManagement;
