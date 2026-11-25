
import { useEffect, useState, useCallback } from "react";
import { adminApi } from "../../api";
import "./CategoryManagement.css";

const initialForm = {
  name: "",
  description: "",
  parent: "",
  display_order: 0,
  is_active: true,
  image: null,
};

function CategoryManagement() {
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(initialForm);

  const [editingCategory, setEditingCategory] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Convert Django media path into full image URL
  const getImageUrl = (image) => {
    if (!image) return "";

    if (typeof image !== "string") {
      image = image.image_url || image.image || "";
    }

    if (!image) return "";

    if (image.startsWith("http")) {
      return image;
    }

    const baseURL =
      adminApi.defaults.baseURL || "http://127.0.0.1:8000/api/";

    const backendURL = baseURL.replace(/\/api\/?$/, "");

    return `${backendURL}${image.startsWith("/") ? "" : "/"}${image}`;
  };

  // Fetch categories
  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await adminApi.get("categories/", {
        params: {
          page,
          page_size: 10,
          search: search.trim() || undefined,
          ordering: "-created_at",
        },
      });

      if (Array.isArray(response.data)) {
        setCategories(response.data);
        setTotalPages(1);
      } else {
        setCategories(response.data.results || []);

        setTotalPages(
          Math.max(
            1,
            Math.ceil((response.data.count || 0) / 10)
          )
        );
      }
    } catch (err) {
      console.error("Category loading error:", err);

      setError(
        err.response?.data?.detail ||
          "Unable to load categories. Please check your connection."
      );
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // Open Add Category form
  const handleAdd = () => {
    setEditingCategory(null);
    setForm(initialForm);
    setError("");
    setSuccess("");
    setShowForm(true);
  };

  // Open Edit Category form
  const handleEdit = (category) => {
    setEditingCategory(category);

    setForm({
      name: category.name || "",
      description: category.description || "",
      parent: category.parent || "",
      display_order: category.display_order ?? 0,
      is_active: Boolean(category.is_active),
      image: null,
    });

    setError("");
    setSuccess("");
    setShowForm(true);
  };

  // Handle form inputs
  const handleChange = (e) => {
    const { name, value, type, checked, files } = e.target;

    setForm((previous) => ({
      ...previous,
      [name]:
        type === "checkbox"
          ? checked
          : type === "file"
          ? files?.[0] || null
          : value,
    }));
  };

  // Create or update category
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.name.trim()) {
      setError("Please enter a category name.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const formData = new FormData();

      formData.append("name", form.name.trim());
      formData.append("description", form.description);
      formData.append("display_order", String(form.display_order));
      formData.append("is_active", String(form.is_active));

      if (form.parent) {
        formData.append("parent", form.parent);
      }

      if (form.image) {
        formData.append("image", form.image);
      }

      if (editingCategory) {
        await adminApi.patch(
          `categories/${editingCategory.id}/`,
          formData
        );

        setSuccess("Category updated successfully.");
      } else {
        await adminApi.post("categories/", formData);

        setSuccess("Category created successfully.");
      }

      setShowForm(false);
      setForm(initialForm);
      setEditingCategory(null);

      await fetchCategories();
    } catch (err) {
      console.error("Category save error:", err);

      const responseData = err.response?.data;

      if (responseData) {
        const firstError = Object.values(responseData).flat()[0];

        setError(
          typeof firstError === "string"
            ? firstError
            : "Unable to save category. Please check the entered details."
        );
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  // Soft delete category
  const handleDelete = async (category) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${category.name}"?`
    );

    if (!confirmed) return;

    try {
      setError("");
      setSuccess("");

      await adminApi.delete(`categories/${category.id}/`);

      setSuccess("Category deleted successfully.");

      await fetchCategories();
    } catch (err) {
      console.error("Category delete error:", err);

      setError(
        err.response?.data?.detail ||
          "Unable to delete category. It may contain subcategories."
      );
    }
  };

  // Close modal
  const closeForm = () => {
    if (saving) return;

    setShowForm(false);
    setEditingCategory(null);
    setForm(initialForm);
    setError("");
  };

  return (
    <div className="category-management">

      {/* Page Header */}
      <div className="category-management-header">
        <div>
          <span className="admin-page-label">
            PRODUCT MANAGEMENT
          </span>

          <h1>Category Management</h1>

          <p>Manage your store categories and collections.</p>
        </div>

        <button
          type="button"
          className="category-add-btn"
          onClick={handleAdd}
        >
          + Add Category
        </button>
      </div>

      {/* Success Message */}
      {success && (
        <div className="category-success">
          {success}
        </div>
      )}

      {/* Error Message */}
      {error && !showForm && (
        <div className="category-error">
          {error}
        </div>
      )}

      {/* Search */}
      <div className="category-toolbar">
        <div className="category-search">
          <span>⌕</span>

          <input
            type="text"
            placeholder="Search categories..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />

          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setPage(1);
              }}
            >
              Clear
            </button>
          )}
        </div>

        <span className="category-count">
          {categories.length} categories displayed
        </span>
      </div>

      {/* Category Table */}
      <div className="category-table-container">
        <table className="category-table">
          <thead>
            <tr>
              <th>IMAGE</th>
              <th>CATEGORY</th>
              <th>PARENT</th>
              <th>ORDER</th>
              <th>STATUS</th>
              <th>ACTIONS</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" className="category-message">
                  Loading categories...
                </td>
              </tr>
            ) : categories.length === 0 ? (
              <tr>
                <td colSpan="6" className="category-message">
                  No categories found.
                </td>
              </tr>
            ) : (
              categories.map((category) => (
                <tr key={category.id}>
                  <td>
                    <div className="category-table-image">
                      {category.image ? (
                        <img
                          src={getImageUrl(category.image)}
                          alt={category.name}
                        />
                      ) : (
                        <span>No Image</span>
                      )}
                    </div>
                  </td>

                  <td>
                    <div className="category-name-cell">
                      <strong>{category.name}</strong>
                      <small>{category.slug}</small>
                    </div>
                  </td>

                  <td>
                    {category.parent_name || "Main Category"}
                  </td>

                  <td>{category.display_order}</td>

                  <td>
                    <span
                      className={`category-status ${
                        category.is_active ? "active" : "inactive"
                      }`}
                    >
                      {category.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>

                  <td>
                    <div className="category-actions">
                      <button
                        type="button"
                        className="category-edit-btn"
                        onClick={() => handleEdit(category)}
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        className="category-delete-btn"
                        onClick={() => handleDelete(category)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="category-pagination">
        <button
          type="button"
          disabled={page <= 1 || loading}
          onClick={() => setPage((previous) => previous - 1)}
        >
          Previous
        </button>

        <span>
          Page {page} of {totalPages}
        </span>

        <button
          type="button"
          disabled={page >= totalPages || loading}
          onClick={() => setPage((previous) => previous + 1)}
        >
          Next
        </button>
      </div>

      {/* Add / Edit Modal */}
      {showForm && (
        <div className="category-modal-overlay">
          <div className="category-modal">

            <div className="category-modal-header">
              <div>
                <span className="admin-page-label">
                  CATEGORY SETTINGS
                </span>

                <h2>
                  {editingCategory
                    ? "Edit Category"
                    : "Add Category"}
                </h2>
              </div>

              <button
                type="button"
                className="category-close-btn"
                onClick={closeForm}
                disabled={saving}
              >
                ×
              </button>
            </div>

            {error && (
              <div className="category-error">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>

              <div className="category-form-group">
                <label>Category Name *</label>

                <input
                  type="text"
                  name="name"
                  placeholder="Example: Dresses"
                  value={form.name}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="category-form-group">
                <label>Description</label>

                <textarea
                  name="description"
                  placeholder="Enter category description"
                  value={form.description}
                  onChange={handleChange}
                  rows="3"
                />
              </div>

              <div className="category-form-row">

                <div className="category-form-group">
                  <label>Parent Category</label>

                  <select
                    name="parent"
                    value={form.parent}
                    onChange={handleChange}
                  >
                    <option value="">
                      Main Category
                    </option>

                    {categories
                      .filter(
                        (category) =>
                          category.id !== editingCategory?.id &&
                          category.is_active
                      )
                      .map((category) => (
                        <option
                          key={category.id}
                          value={category.id}
                        >
                          {category.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="category-form-group">
                  <label>Display Order</label>

                  <input
                    type="number"
                    name="display_order"
                    min="0"
                    value={form.display_order}
                    onChange={handleChange}
                  />
                </div>

              </div>

              <div className="category-form-group">
                <label>Category Image</label>

                <input
                  type="file"
                  name="image"
                  accept="image/*"
                  onChange={handleChange}
                />

                {editingCategory?.image && !form.image && (
                  <div className="category-current-image">
                    <img
                      src={getImageUrl(editingCategory.image)}
                      alt="Current category"
                    />

                    <span>Current image</span>
                  </div>
                )}

                {form.image && (
                  <p className="category-file-name">
                    Selected: {form.image.name}
                  </p>
                )}
              </div>

              <div className="category-active-option">
                <label>
                  <input
                    type="checkbox"
                    name="is_active"
                    checked={form.is_active}
                    onChange={handleChange}
                  />

                  Active Category
                </label>
              </div>

              <div className="category-form-actions">

                <button
                  type="button"
                  className="category-cancel-btn"
                  onClick={closeForm}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="category-save-btn"
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : editingCategory
                    ? "Update Category"
                    : "Create Category"}
                </button>

              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default CategoryManagement;
