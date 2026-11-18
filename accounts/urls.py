
from django.urls import path
from .views import (
    RegisterView,
    VerifyEmailView,
    ProfileView,
    ProfileUpdateView,
    PasswordChangeView,
    AdminUserListView,
    AdminUserStatusView,
    AddressListCreateView,
    AddressDetailView,
    ResendOTPView,
    ProfileImageUploadView,
    LogoutView,
    ForgotPasswordView,
    ResetPasswordView,
)

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("verify-email/", VerifyEmailView.as_view(), name="verify-email"),
    path("resend-otp/", ResendOTPView.as_view(), name="resend-otp"),

    path("profile/", ProfileView.as_view(), name="profile"),
    path("profile/update/", ProfileUpdateView.as_view(), name="profile-update"),
    path("profile/change-password/", PasswordChangeView.as_view(), name="password-change"),
    path("profile/image/", ProfileImageUploadView.as_view(), name="profile-image"),

    path("logout/", LogoutView.as_view(), name="logout"),

    path("addresses/", AddressListCreateView.as_view(), name="address-list-create"),
    path("addresses/<int:pk>/", AddressDetailView.as_view(), name="address-detail"),

    path("admin/users/", AdminUserListView.as_view(), name="admin-users"),
    path("admin/users/<int:user_id>/status/", AdminUserStatusView.as_view(), name="admin-user-status",
    ),
   
]
