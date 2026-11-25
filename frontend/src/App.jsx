
import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

// Public pages
const Home = lazy(() => import("./pages/Home"));
const Login = lazy(() => import("./pages/auth/Login"));
const Register = lazy(() => import("./pages/auth/Register"));
const VerifyEmail = lazy(() => import("./pages/auth/VerifyEmail"));
const ForgotPassword = lazy(() => import("./pages/auth/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/auth/ResetPassword"));

const Category = lazy(() => import("./pages/Category"));
const CategoryPage = lazy(() => import("./pages/category/Category"));
const ProductList = lazy(() => import("./pages/ProductList"));
const ProductDetails = lazy(() => import("./pages/ProductDetails"));

// Customer pages
const MyProfile = lazy(() => import("./pages/MyProfile"));
const MyAddresses = lazy(() => import("./pages/MyAddresses"));
const Cart = lazy(() => import("./pages/Cart"));
const Checkout = lazy(() => import("./pages/Checkout"));
const OrderConfirmation = lazy(() => import("./pages/OrderConfirmation"));
const Wishlist = lazy(() => import("./pages/Wishlist"));
const MyOrders = lazy(() => import("./pages/MyOrders"));
const OrderSuccess = lazy(() => import("./pages/OrderSuccess"));


// Admin pages
const AdminLogin = lazy(() => import("./pages/admin/AdminLogin"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const CategoryManagement = lazy(() => import("./pages/admin/CategoryManagement"));
const ColorManagement = lazy(() => import("./pages/admin/ColorManagement"));
const SizeManagement = lazy(() => import("./pages/admin/SizeManagement"));
const ProductVariantManagement = lazy(() => import("./pages/admin/ProductVariantManagement"));
const ProductManagement = lazy(() => import("./pages/admin/ProductManagement"));
const AdminOrders = lazy(() => import("./pages/admin/AdminOrders"));
const AdminReturns = lazy(() => import("./pages/admin/AdminReturns"));

// Route protection
import ProtectedRoute from "./ProtectedRoute";
import GuestRoute from "./GuestRoute";

// Loading screen
function PageLoader() {
  return (
    <div style={{
      minHeight: "60vh",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      flexDirection: "column",
      gap: "12px",
      color: "#064e3b",
      fontSize: "16px",
      fontWeight: "600"
    }}>
      <div style={{
        width: "35px",
        height: "35px",
        border: "4px solid #e5e7eb",
        borderTop: "4px solid #064e3b",
        borderRadius: "50%",
        animation: "stylo-spin 0.8s linear infinite"
      }} />
      <span>STYLO is loading...</span>

      <style>
        {`
          @keyframes stylo-spin {
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>

          {/* HOME */}
          <Route path="/" element={<Home />} />
          <Route path="/home" element={<Home />} />

          {/* GUEST ROUTES */}
          <Route element={<GuestRoute />}>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
          </Route>

          {/* OTHER PUBLIC AUTH ROUTES */}
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* PUBLIC SHOPPING ROUTES */}
          <Route path="/category" element={<Category />} />
          <Route path="/category-page" element={<CategoryPage />} />
          <Route path="/products" element={<ProductList />} />
          <Route path="/products/:id" element={<ProductDetails />} />

          {/* CUSTOMER PROTECTED ROUTES */}
          <Route element={<ProtectedRoute />}>
            <Route path="/profile" element={<MyProfile />} />
            <Route path="/addresses" element={<MyAddresses />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/wishlist" element={<Wishlist />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/order-success" element={<OrderSuccess />} />
            <Route
              path="/orders/:orderId/confirmation"
              element={<OrderConfirmation />}
            />
            <Route path="/myorders" element={<MyOrders />} />
          </Route>

          {/* ADMIN ROUTES */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/forgot-password" element={<ForgotPassword />} />
          <Route path="/admin/reset-password" element={<ResetPassword />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/categories" element={<CategoryManagement />} />
          <Route path="/admin/colors" element={<ColorManagement />} />
          <Route path="/admin/orders" element={<AdminOrders />} />
          <Route path="/admin/sizes" element={<SizeManagement />} />
          <Route path="/admin/product-variants" element={<ProductVariantManagement />} />
          <Route path="/admin/products" element={<ProductManagement />} />
          <Route path="/admin/returns" element={<AdminReturns />} />

        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
