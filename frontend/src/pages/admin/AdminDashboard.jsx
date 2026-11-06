
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api";
import "./AdminDashboard.css";

function AdminDashboard() {
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [count, setCount] = useState(0);
  const [next, setNext] = useState(null);
  const [previous, setPrevious] = useState(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const access = localStorage.getItem("access");

  const fetchUsers = async (pageNumber = 1, searchValue = search) => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("auth/admin/users/", {
        params: {
          page: pageNumber,
          search: searchValue,
        },
        headers: {
          Authorization: `Bearer ${access}`,
        },
      });

      setUsers(response.data.results || []);
      setCount(response.data.count || 0);
      setNext(response.data.next);
      setPrevious(response.data.previous);
      setPage(pageNumber);

    } catch (err) {
      if (
        err.response?.status === 401 ||
        err.response?.status === 403
      ) {
        localStorage.removeItem("access");
        localStorage.removeItem("refresh");

        navigate("/admin/login", { replace: true });

      } else {
        setError("Unable to load customers. Please try again.");
      }

    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!access) {
      navigate("/admin/login", { replace: true });
      return;
    }

    fetchUsers(1, "");
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchUsers(1, search);
  };

  const handleStatus = async (user) => {
    const action = user.is_blocked ? "unblock" : "block";

    if (
      !window.confirm(
        `Are you sure you want to ${action} this customer?`
      )
    ) {
      return;
    }

    try {
      await api.patch(
        `auth/admin/users/${user.id}/status/`,
        { is_blocked: !user.is_blocked },
        {
          headers: {
            Authorization: `Bearer ${access}`,
          },
        }
      );

      fetchUsers(page, search);

    } catch (err) {
      alert(
        err.response?.data?.detail ||
        "Unable to update customer status."
      );
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");

    navigate("/admin/login", { replace: true });
  };

  const blockedCount = users.filter(
    (user) => user.is_blocked
  ).length;

  return (
    <div className="admin-dashboard">

      <aside className="admin-sidebar">
        <h2>STYLO</h2>

        <p className="admin-sidebar-label">
          ADMIN PANEL
        </p>

        <nav>
          <button className="sidebar-active">
            Dashboard
          </button>

          <button onClick={() => fetchUsers(1, "")}>
            Customers
          </button>
        </nav>

        <button
          className="admin-logout"
          onClick={handleLogout}
        >
          Logout
        </button>
      </aside>

      <main className="admin-main">

        <header className="admin-topbar">
          <div>
            <h1>Dashboard</h1>
            <p>
              Welcome to your STYLO store management panel.
            </p>
          </div>

          <span className="admin-role">
            Administrator
          </span>
        </header>

        <section className="admin-stats">

          <div className="admin-stat-card">
            <p>Total Customers</p>
            <h2>{count}</h2>
          </div>

          <div className="admin-stat-card">
            <p>Customers Loaded</p>
            <h2>{users.length}</h2>
          </div>

          <div className="admin-stat-card">
            <p>Blocked on This Page</p>
            <h2>{blockedCount}</h2>
          </div>

        </section>

        <section className="admin-customers">

          <div className="admin-section-heading">
            <div>
              <h2>Customer Management</h2>
              <p>
                View, search and manage customer accounts.
              </p>
            </div>
          </div>

          <form
            className="admin-search"
            onSubmit={handleSearch}
          >
            <input
              type="text"
              placeholder="Search by name, email or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <button type="submit">
              Search
            </button>

            <button
              type="button"
              className="admin-clear-button"
              onClick={() => {
                setSearch("");
                fetchUsers(1, "");
              }}
            >
              Clear
            </button>
          </form>

          {error && (
            <p className="admin-error">{error}</p>
          )}

          {loading ? (
            <p className="admin-loading">
              Loading customers...
            </p>
          ) : (
            <>

              <div className="admin-table-wrapper">

                <table className="admin-table">

                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Username</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {users.length > 0 ? (
                      users.map((user) => (
                        <tr key={user.id}>

                          <td>{user.id}</td>

                          <td>{user.username}</td>

                          <td>{user.email}</td>

                          <td>
                            {user.phone_number || "—"}
                          </td>

                          <td>
                            <span
                              className={
                                user.is_blocked
                                  ? "status-blocked"
                                  : "status-active"
                              }
                            >
                              {user.is_blocked
                                ? "Blocked"
                                : "Active"}
                            </span>
                          </td>

                          <td>
                            <button
                              className={
                                user.is_blocked
                                  ? "unblock-button"
                                  : "block-button"
                              }
                              onClick={() => handleStatus(user)}
                            >
                              {user.is_blocked
                                ? "Unblock"
                                : "Block"}
                            </button>
                          </td>

                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan="6"
                          className="admin-empty"
                        >
                          No customers found.
                        </td>
                      </tr>
                    )}
                  </tbody>

                </table>

              </div>

              <div className="admin-pagination">

                <button
                  disabled={!previous}
                  onClick={() => fetchUsers(page - 1)}
                >
                  Previous
                </button>

                <span>Page {page}</span>

                <button
                  disabled={!next}
                  onClick={() => fetchUsers(page + 1)}
                >
                  Next
                </button>

              </div>

            </>
          )}

        </section>

      </main>
    </div>
  );
}

export default AdminDashboard;
