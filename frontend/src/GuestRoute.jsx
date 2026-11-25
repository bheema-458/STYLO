
import { Navigate, Outlet } from "react-router-dom";

export default function GuestRoute() {
  // Check CUSTOMER token
  const token = localStorage.getItem("user_access");

  if (token) {
    return <Navigate to="/home" replace />;
  }

  return <Outlet />;
}
