
import { useCallback, useEffect, useState } from "react";
import { adminApi } from "../../api";
import "./ColorManagement.css";

const initialForm = {
  name: "",
  hex_code: "#C98F9D",
  is_active: true,
};

function ColorManagement() {
  const [colors, setColors] = useState([]);
  const [form, setForm] = useState(initialForm);

  const [editingColor, setEditingColor] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Fetch colors using Admin API
  const fetchColors = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await adminApi.get("colors/", {
        params: {
          page,
          page_size: 10,
          search: search.trim() || undefined,
          ordering: "name",
        },
      });

      if (Array.isArray(response.data)) {
        setColors(response.data);
        setTotalPages(1);
      } else {
        const results = response.data.results || [];
        const count = response.data.count || 0;

        setColors(results);
        setTotalPages(Math.max(1, Math.ceil(count / 10)));
      }
    } catch (err) {
      console.error("Color loading error:", err);

      setError(
        err.response?.data?.detail ||
        "Unable to load colors. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchColors();
  }, [fetchColors]);

  // Open Add Color form
  const handleAdd = () => {
    setEditingColor(null);
    setForm({ ...initialForm });
    setError("");
    setSuccess("");
    setShowForm(true);
  };

  // Open Edit Color form
  const handleEdit = (color) => {
    setEditingColor(color);

    setForm({
      name: color.name || "",
      hex_code: color.hex_code || "#000000",
      is_active: color.is_active ?? true,
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

  // Create or update color
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.name.trim()) {
      setError("Please enter a color name.");
      return;
    }

    if (!/^#[0-9A-Fa-f]{6}$/.test(form.hex_code)) {
      setError("Please choose a valid color.");
      return;
    }

    const colorData = {
      name: form.name.trim(),
      hex_code: form.hex_code.toUpperCase(),
      is_active: form.is_active,
    };

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      if (editingColor) {
        await adminApi.patch(
          `colors/${editingColor.id}/`,
          colorData
        );

        setSuccess("Color updated successfully.");
      } else {
        await adminApi.post("colors/", colorData);
        setSuccess("Color created successfully.");
      }

      setShowForm(false);
      setForm({ ...initialForm });
      setEditingColor(null);

      await fetchColors();
    } catch (err) {
      console.error("Color save error:", err);

      const responseData = err.response?.data;

      if (responseData) {
        const firstError = Object.values(responseData).flat()[0];

        setError(
          typeof firstError === "string"
            ? firstError
            : "Unable to save color. Please check the details."
        );
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  // Delete color
  const handleDelete = async (color) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${color.name}"?`
    );

    if (!confirmed) return;

    try {
      setError("");
      setSuccess("");

      await adminApi.delete(`colors/${color.id}/`);

      setSuccess("Color deleted successfully.");

      if (colors.length === 1 && page > 1) {
        setPage((previous) => previous - 1);
      } else {
        await fetchColors();
      }
    } catch (err) {
      console.error("Color delete error:", err);

      setError(
        err.response?.data?.detail ||
        "Unable to delete color. Please try again."
      );
    }
  };

  // Close modal
  const closeForm = () => {
    if (saving) return;

    setShowForm(false);
    setEditingColor(null);
    setForm({ ...initialForm });
    setError("");
  };

  return (
    <div className="color-management">
      <div className="color-management-header">
        <div>
          <span className="admin-page-label">
            PRODUCT MANAGEMENT
          </span>

          <h1>Color Management</h1>

          <p>Manage colors available for your products.</p>
        </div>

        <button
          type="button"
          className="color-add-btn"
          onClick={handleAdd}
        >
          + Add Color
        </button>
      </div>

      {success && (
        <div className="color-success">{success}</div>
      )}

      {error && !showForm && (
        <div className="color-error">{error}</div>
      )}

      <div className="color-toolbar">
        <div className="color-search">
          <span>⌕</span>

          <input
            type="text"
            placeholder="Search colors..."
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

        <span className="color-count">
          {colors.length} colors displayed
        </span>
      </div>

      <div className="color-table-container">
        <table className="color-table">
          <thead>
            <tr>
              <th>PREVIEW</th>
              <th>COLOR NAME</th>
              <th>HEX CODE</th>
              <th>STATUS</th>
              <th>ACTIONS</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan="5" className="color-message">
                  Loading colors...
                </td>
              </tr>
            ) : colors.length === 0 ? (
              <tr>
                <td colSpan="5" className="color-message">
                  No colors found.
                </td>
              </tr>
            ) : (
              colors.map((color) => (
                <tr key={color.id}>
                  <td>
                    <div
                      className="color-preview"
                      style={{
                        backgroundColor: color.hex_code,
                      }}
                    />
                  </td>

                  <td>
                    <strong>{color.name}</strong>
                  </td>

                  <td>
                    <code>{color.hex_code}</code>
                  </td>

                  <td>
                    <span
                      className={`color-status ${
                        color.is_active ? "active" : "inactive"
                      }`}
                    >
                      {color.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>

                  <td>
                    <div className="color-actions">
                      <button
                        type="button"
                        className="color-edit-btn"
                        onClick={() => handleEdit(color)}
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        className="color-delete-btn"
                        onClick={() => handleDelete(color)}
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

      <div className="color-pagination">
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
        <div className="color-modal-overlay">
          <div className="color-modal">
            <div className="color-modal-header">
              <div>
                <span className="admin-page-label">
                  COLOR SETTINGS
                </span>

                <h2>
                  {editingColor ? "Edit Color" : "Add Color"}
                </h2>
              </div>

              <button
                type="button"
                className="color-close-btn"
                onClick={closeForm}
                disabled={saving}
              >
                ×
              </button>
            </div>

            {error && (
              <div className="color-error">{error}</div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="color-form-group">
                <label htmlFor="color-name">
                  Color Name *
                </label>

                <input
                  id="color-name"
                  type="text"
                  name="name"
                  placeholder="Example: Dusty Pink"
                  value={form.name}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="color-form-group">
                <label htmlFor="color-picker">
                  Choose Color *
                </label>

                <div className="color-picker-wrapper">
                  <input
                    id="color-picker"
                    type="color"
                    name="hex_code"
                    value={form.hex_code}
                    onChange={handleChange}
                    className="color-picker-input"
                  />

                  <div>
                    <strong>
                      {form.hex_code.toUpperCase()}
                    </strong>

                    <p>Select your preferred color</p>
                  </div>
                </div>
              </div>

              <div className="color-live-preview">
                <div
                  className="color-preview-large"
                  style={{
                    backgroundColor: form.hex_code,
                  }}
                />

                <div>
                  <strong>
                    {form.name || "Color Preview"}
                  </strong>

                  <p>{form.hex_code.toUpperCase()}</p>
                </div>
              </div>

              <div className="color-active-option">
                <label>
                  <input
                    type="checkbox"
                    name="is_active"
                    checked={form.is_active}
                    onChange={handleChange}
                  />

                  Active Color
                </label>
              </div>

              <div className="color-form-actions">
                <button
                  type="button"
                  className="color-cancel-btn"
                  onClick={closeForm}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="color-save-btn"
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : editingColor
                    ? "Update Color"
                    : "Create Color"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ColorManagement;
