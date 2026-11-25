
import axios from "axios";

// ========================================
// 1. BASE CONFIGURATION
// ========================================

const BASE_URL = "http://127.0.0.1:8000/api/";

const createApiInstance = () => {
  return axios.create({
    baseURL: BASE_URL,
    timeout: 15000,
  });
};

// ========================================
// 2. SEPARATE API INSTANCES
// ========================================

export const adminApi = createApiInstance();
export const userApi = createApiInstance();

// ========================================
// 3. PUBLIC ENDPOINTS
// ========================================

const publicEndpoints = [
  "auth/register/",
  "auth/login/",
  "auth/forgot-password/",
  "auth/reset-password/",
  "auth/verify-email/",
  "auth/resend-otp/",
  "auth/token/refresh/",
];

const isPublicEndpoint = (url = "") =>
  publicEndpoints.some((endpoint) => url.includes(endpoint));

// ========================================
// 4. AUTH CONFIGURATION
// ========================================

const authConfigs = {
  admin: {
    accessKey: "admin_access",
    refreshKey: "admin_refresh",
    loginPath: "/admin/login",
  },

  user: {
    accessKey: "user_access",
    refreshKey: "user_refresh",
    loginPath: "/login",
  },
};

// ========================================
// 5. SETUP INTERCEPTORS
// ========================================

const setupInterceptors = (api, auth) => {
  let refreshPromise = null;

  // ========================================
  // REQUEST INTERCEPTOR
  // ========================================

  api.interceptors.request.use(
    (config) => {
      config.headers = config.headers || {};

      const url = config.url || "";

      // Public endpoints should not receive old tokens
      if (isPublicEndpoint(url)) {
        delete config.headers.Authorization;
        return config;
      }

      // Handle FormData uploads
      if (
        typeof FormData !== "undefined" &&
        config.data instanceof FormData
      ) {
        delete config.headers["Content-Type"];
        delete config.headers["content-type"];
      }

      // Use the correct account token
      const accessToken = localStorage.getItem(auth.accessKey);

      if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
      } else {
        delete config.headers.Authorization;
      }

      return config;
    },
    (error) => Promise.reject(error)
  );

  // ========================================
  // LOGOUT FUNCTION
  // ========================================

  const logout = () => {
    localStorage.removeItem(auth.accessKey);
    localStorage.removeItem(auth.refreshKey);

    window.dispatchEvent(new Event("authChanged"));

    if (window.location.pathname !== auth.loginPath) {
      window.location.replace(auth.loginPath);
    }
  };

  // ========================================
  // RESPONSE INTERCEPTOR
  // ========================================

  api.interceptors.response.use(
    (response) => response,

    async (error) => {
      const originalRequest = error.config;

      if (
        error.response?.status !== 401 ||
        !originalRequest
      ) {
        return Promise.reject(error);
      }

      // Never refresh public endpoints
      if (isPublicEndpoint(originalRequest.url || "")) {
        return Promise.reject(error);
      }

      // Prevent infinite retry
      if (originalRequest._retry) {
        logout();
        return Promise.reject(error);
      }

      const refreshToken = localStorage.getItem(auth.refreshKey);

      if (!refreshToken) {
        logout();
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      try {
        // Reuse an active refresh request
        if (!refreshPromise) {
          refreshPromise = axios
            .post(
              `${BASE_URL}auth/token/refresh/`,
              {
                refresh: refreshToken,
              },
              {
                timeout: 15000,
              }
            )
            .then((response) => {
              const newAccessToken = response.data.access;

              if (!newAccessToken) {
                throw new Error("New access token not received.");
              }

              localStorage.setItem(
                auth.accessKey,
                newAccessToken
              );

              // Save rotated refresh token when provided
              if (response.data.refresh) {
                localStorage.setItem(
                  auth.refreshKey,
                  response.data.refresh
                );
              }

              return newAccessToken;
            })
            .catch((refreshError) => {
              logout();
              throw refreshError;
            })
            .finally(() => {
              refreshPromise = null;
            });
        }

        const newAccessToken = await refreshPromise;

        originalRequest.headers = originalRequest.headers || {};

        originalRequest.headers.Authorization =
          `Bearer ${newAccessToken}`;

        // Retry the original request
        return api(originalRequest);
      } catch (refreshError) {
        return Promise.reject(refreshError);
      }
    }
  );
};

// ========================================
// 6. INITIALIZE INTERCEPTORS
// ========================================

setupInterceptors(adminApi, authConfigs.admin);
setupInterceptors(userApi, authConfigs.user);

// ========================================
// 7. EXPORT
// ========================================

// Default API is for customers
export default userApi;
