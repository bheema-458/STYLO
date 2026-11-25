
import { useCallback, useEffect, useState } from "react";
import { adminApi } from "../../api";
import "./SizeManagement.css";

const initialForm = {
  name: "",
  display_order: 0,
  is_active: true,
};

function SizeManagement() {
  const [sizes, setSizes] = useState([]);
  const [form, setForm] = useState(initialForm);

  const [editingSize, setEditingSize] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Fetch sizes using Admin API
  const fetchSizes = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await adminApi.get("sizes/", {
        params: {
          page,
          page_size: 10,
          search: search.trim() || undefined,
          ordering: "display_order",
        },
      });

      if (Array.isArray(response.data)) {
        setSizes(response.data);
        setTotalPages(1);
      } else {
        const results = response.data.results || [];
        const count = response.data.count || 0;

        setSizes(results);
        setTotalPages(Math.max(1, Math.ceil(count / 10)));
      }
    } catch (err) {
      console.error("Size loading error:", err);

      setError(
        err.response?.data?.detail ||
        "Unable to load sizes. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchSizes();
  }, [fetchSizes]);

  // Open Add Size form
  const handleAdd = () => {
    setEditingSize(null);
    setForm({ ...initialForm });
    setError("");
    setSuccess("");
    setShowForm(true);
  };

  // Open Edit Size form
  const handleEdit = (size) => {
    setEditingSize(size);

    setForm({
      name: size.name || "",
      display_order: size.display_order ?? 0,
      is_active: size.is_active ?? true,
    });

    setError("");
    setSuccess("");
    setShowForm(true);
  };

  // Handle inputs
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setForm((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  // Create or update size
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.name.trim()) {
      setError("Please enter a size name.");
      return;
    }

    const order = Number(form.display_order);

    if (!Number.isInteger(order) || order < 0) {
      setError("Display order must be a valid non-negative number.");
      return;
    }

    const sizeData = {
      name: form.name.trim(),
      display_order: order,
      is_active: form.is_active,
    };

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      if (editingSize) {
        await adminApi.patch(
          `sizes/${editingSize.id}/`,
          sizeData
        );

        setSuccess("Size updated successfully.");
      } else {
        await adminApi.post("sizes/", sizeData);
        setSuccess("Size created successfully.");
      }

      setShowForm(false);
      setForm({ ...initialForm });
      setEditingSize(null);

      await fetchSizes();
    } catch (err) {
      console.error("Size save error:", err);

      const responseData = err.response?.data;

      if (responseData) {
        const firstError = Object.values(responseData).flat()[0];

        setError(
          typeof firstError === "string"
            ? firstError
            : "Unable to save size. Please check the details."
        );
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  // Delete size
  const handleDelete = async (size) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${size.name}"?`
    );

    if (!confirmed) return;

    try {
      setError("");
      setSuccess("");

      await adminApi.delete(`sizes/${size.id}/`);

      setSuccess("Size deleted successfully.");

      if (sizes.length === 1 && page > 1) {
        setPage((previous) => previous - 1);
      } else {
        await fetchSizes();
      }
    } catch (err) {
      console.error("Size delete error:", err);

      setError(
        err.response?.data?.detail ||
        "Unable to delete size. Please try again."
      );
    }
  };

  // Close modal
  const closeForm = () => {
    if (saving) return;

    setShowForm(false);
    setEditingSize(null);
    setForm({ ...initialForm });
    setError("");
  };

  return (
    <div className="size-management">
      <div className="size-management-header">
        <div>
          <span className="admin-page-label">
            PRODUCT MANAGEMENT
          </span>

          <h1>Size Management</h1>

          <p>Manage sizes available for your products.</p>
        </div>

        <button
          type="button"
          className="size-add-btn"
          onClick={handleAdd}
        >
          + Add Size
        </button>
      </div>

      {success && (
        <div className="size-success">{success}</div>
      )}

      {error && !showForm && (
        <div className="size-error">{error}</div>
      )}

      <div className="size-toolbar">
        <div className="size-search">
          <span>⌕</span>

          <input
            type="text"
            placeholder="Search sizes..."
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

        <span className="size-count">
          {sizes.length} sizes displayed
        </span>
      </div>

      <div className="size-table-container">
        <table className="size-table">
          <thead>
            <tr>
              <th>SIZE</th>
              <th>DISPLAY ORDER</th>
              <th>STATUS</th>
              <th>ACTIONS</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan="4" className="size-message">
                  Loading sizes...
                </td>
              </tr>
            ) : sizes.length === 0 ? (
              <tr>
                <td colSpan="4" className="size-message">
                  No sizes found.
                </td>
              </tr>
            ) : (
              sizes.map((size) => (
                <tr key={size.id}>
                  <td>
                    <strong>{size.name}</strong>
                  </td>

                  <td>{size.display_order}</td>

                  <td>
                    <span
                      className={`size-status ${
                        size.is_active ? "active" : "inactive"
                      }`}
                    >
                      {size.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>

                  <td>
                    <div className="size-actions">
                      <button
                        type="button"
                        className="size-edit-btn"
                        onClick={() => handleEdit(size)}
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        className="size-delete-btn"
                        onClick={() => handleDelete(size)}
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

      <div className="size-pagination">
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

      {showForm && (
        <div className="size-modal-overlay">
          <div className="size-modal">
            <div className="size-modal-header">
              <div>
                <span className="admin-page-label">
                  SIZE SETTINGS
                </span>

                <h2>
                  {editingSize ? "Edit Size" : "Add Size"}
                </h2>
              </div>

              <button
                type="button"
                className="size-close-btn"
                onClick={closeForm}
                disabled={saving}
              >
                ×
              </button>
            </div>

            {error && (
              <div className="size-error">{error}</div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="size-form-group">
                <label htmlFor="size-name">
                  Size Name *
                </label>

                <input
                  id="size-name"
                  type="text"
                  name="name"
                  placeholder="Example: XS, S, M, L, XL"
                  value={form.name}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="size-form-group">
                <label htmlFor="size-order">
                  Display Order
                </label>

                <input
                  id="size-order"
                  type="number"
                  name="display_order"
                  min="0"
                  step="1"
                  value={form.display_order}
                  onChange={handleChange}
                />

                <p>Smaller numbers appear first.</p>
              </div>

              <div className="size-active-option">
                <label>
                  <input
                    type="checkbox"
                    name="is_active"
                    checked={form.is_active}
                    onChange={handleChange}
                  />

                  Active Size
                </label>
              </div>

              <div className="size-form-actions">
                <button
                  type="button"
                  className="size-cancel-btn"
                  onClick={closeForm}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="size-save-btn"
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : editingSize
                    ? "Update Size"
                    : "Create Size"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default SizeManagement;
