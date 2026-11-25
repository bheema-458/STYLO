
from django.contrib.auth import get_user_model

from rest_framework import filters, generics, status
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError

from .models import Address
from .permissions import IsActiveUser, IsAdminUser as IsActiveAdmin

from .serializers import (
    RegisterSerializer,
    AdminUserListSerializer,
    ProfileUpdateSerializer,
    PasswordChangeSerializer,
    CustomTokenObtainPairSerializer,
    ForgotPasswordSerializer,
    ResetPasswordSerializer,
    ProfileImageSerializer,
    AddressSerializer,
)

from accounts.services.account_service import (
    send_email_verification,
    verify_email_address,
    resend_email_verification,
)

from accounts.services.password_service import (
    send_password_reset_otp,
    reset_user_password,
    change_user_password,
)

from accounts.services.address_service import (
    create_user_address,
    update_user_address,
    delete_user_address,
)

from accounts.services.admin_service import (
    update_user_block_status,
)


User = get_user_model()


# --------------------------------------------------
# 1. CUSTOMER REGISTRATION
# --------------------------------------------------

class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]
    throttle_scope = "registration"

    def perform_create(self, serializer):
        user = serializer.save()
        send_email_verification(user)


# --------------------------------------------------
# 2. EMAIL VERIFICATION
# --------------------------------------------------

class VerifyEmailView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = str(request.data.get("email", "")).strip().lower()
        otp = str(request.data.get("otp", "")).strip()

        if not email or not otp:
            return Response(
                {"detail": "Email and OTP are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = User.objects.filter(email__iexact=email).first()

        if user is None:
            return Response(
                {"detail": "Invalid email or OTP."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        success, message = verify_email_address(user, otp)

        if not success:
            if message == "Invalid OTP. Please try again.":
                message = "Invalid email or OTP."

            return Response(
                {"detail": message},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {"message": message},
            status=status.HTTP_200_OK,
        )


# --------------------------------------------------
# 3. RESEND EMAIL VERIFICATION OTP
# --------------------------------------------------

class ResendOTPView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "resend_otp"

    def post(self, request):
        email = str(request.data.get("email", "")).strip().lower()

        if not email:
            return Response(
                {"detail": "Email is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = User.objects.filter(email__iexact=email).first()

        generic_message = (
            "If the account needs verification, an OTP can be requested."
        )

        if user is None or user.is_email_verified:
            return Response(
                {"message": generic_message},
                status=status.HTTP_200_OK,
            )

        success, message = resend_email_verification(user)

        if not success and "60 seconds" in message:
            return Response(
                {"detail": message},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        return Response(
            {"message": generic_message},
            status=status.HTTP_200_OK,
        )


# --------------------------------------------------
# 4. FORGOT PASSWORD
# --------------------------------------------------

class ForgotPasswordView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "forgot_password"

    def post(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"]

        user = User.objects.filter(
            email__iexact=email,
            is_active=True,
            is_email_verified=True,
            is_blocked=False,
        ).first()

        if user:
            send_password_reset_otp(user)

        return Response(
            {
                "message": (
                    "If an eligible account exists with this email, "
                    "a password reset OTP has been sent."
                )
            },
            status=status.HTTP_200_OK,
        )


# --------------------------------------------------
# 5. RESET PASSWORD
# --------------------------------------------------

class ResetPasswordView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "reset_password"

    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"]
        otp = serializer.validated_data["otp"]
        new_password = serializer.validated_data["new_password"]

        user = User.objects.filter(
            email__iexact=email,
            is_active=True,
            is_email_verified=True,
            is_blocked=False,
        ).first()

        if not user:
            return Response(
                {"detail": "Invalid or expired OTP."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        success, message = reset_user_password(
            user=user,
            otp=otp,
            new_password=new_password,
        )

        if not success:
            return Response(
                {"detail": message},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {"message": message},
            status=status.HTTP_200_OK,
        )


# --------------------------------------------------
# 6. CUSTOMER PROFILE
# --------------------------------------------------

class ProfileView(APIView):
    permission_classes = [IsActiveUser]

    def get(self, request):
        user = request.user

        profile_image_url = None

        if user.profile_image:
            profile_image_url = request.build_absolute_uri(
                user.profile_image.url
            )

        return Response({
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "phone_number": user.phone_number,
            "profile_image": profile_image_url,
        })


# --------------------------------------------------
# 7. PROFILE IMAGE UPLOAD AND DELETE
# --------------------------------------------------

class ProfileImageUploadView(APIView):
    permission_classes = [IsActiveUser]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        serializer = ProfileImageSerializer(
            request.user,
            data=request.data,
            partial=True,
        )

        serializer.is_valid(raise_exception=True)
        serializer.save()

        image = request.user.profile_image

        return Response({
            "message": "Profile image uploaded successfully.",
            "profile_image": request.build_absolute_uri(image.url),
        }, status=status.HTTP_200_OK)

    def delete(self, request):
        user = request.user

        if user.profile_image:
            user.profile_image.delete(save=True)

        return Response({
            "message": "Profile image removed successfully."
        }, status=status.HTTP_200_OK)


# --------------------------------------------------
# 8. PROFILE UPDATE
# --------------------------------------------------

class ProfileUpdateView(generics.UpdateAPIView):
    serializer_class = ProfileUpdateSerializer
    permission_classes = [IsActiveUser]

    def get_object(self):
        return self.request.user


# --------------------------------------------------
# 9. ADMIN USER PAGINATION
# --------------------------------------------------

class AdminUserPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 50


# --------------------------------------------------
# 10. ADMIN USER LIST, SEARCH AND SORTING
# --------------------------------------------------

class AdminUserListView(generics.ListAPIView):
    serializer_class = AdminUserListSerializer
    permission_classes = [IsActiveAdmin]
    pagination_class = AdminUserPagination

    filter_backends = [filters.SearchFilter]

    search_fields = [
        "username",
        "email",
        "first_name",
        "last_name",
        "phone_number",
    ]

    def get_queryset(self):
        return User.objects.all().order_by("-created_at")


# --------------------------------------------------
# 11. ADMIN BLOCK / UNBLOCK USER
# --------------------------------------------------

class AdminUserStatusView(APIView):
    permission_classes = [IsActiveAdmin]

    def patch(self, request, user_id):
        is_blocked = request.data.get("is_blocked")

        if not isinstance(is_blocked, bool):
            return Response(
                {"is_blocked": "Send true or false."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        success, message, target_user = update_user_block_status(
            admin_user=request.user,
            target_user_id=user_id,
            is_blocked=is_blocked,
        )

        if not success:
            response_status = (
                status.HTTP_404_NOT_FOUND
                if message == "User not found."
                else status.HTTP_400_BAD_REQUEST
            )

            return Response(
                {"detail": message},
                status=response_status,
            )

        return Response({
            "id": target_user.id,
            "username": target_user.username,
            "is_blocked": target_user.is_blocked,
            "message": message,
        }, status=status.HTTP_200_OK)


# --------------------------------------------------
# 12. CHANGE PASSWORD
# --------------------------------------------------

class PasswordChangeView(generics.GenericAPIView):
    serializer_class = PasswordChangeSerializer
    permission_classes = [IsActiveUser]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        success, message = change_user_password(
            user=request.user,
            new_password=serializer.validated_data["new_password"],
        )

        if not success:
            return Response(
                {"detail": message},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {"message": message},
            status=status.HTTP_200_OK,
        )


# --------------------------------------------------
# 13. CUSTOMER ADDRESS LIST AND CREATE
# --------------------------------------------------

class AddressListCreateView(generics.ListCreateAPIView):
    serializer_class = AddressSerializer
    permission_classes = [IsActiveUser]

    def get_queryset(self):
        return Address.objects.filter(
            user=self.request.user
        ).order_by("-created_at")

    def perform_create(self, serializer):
        create_user_address(
            user=self.request.user,
            validated_data=serializer.validated_data,
        )


# --------------------------------------------------
# 14. CUSTOMER ADDRESS RETRIEVE, UPDATE AND DELETE
# --------------------------------------------------

class AddressDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = AddressSerializer
    permission_classes = [IsActiveUser]

    def get_queryset(self):
        return Address.objects.filter(
            user=self.request.user
        )

    def perform_update(self, serializer):
        update_user_address(
            address=serializer.instance,
            validated_data=serializer.validated_data,
        )

    def perform_destroy(self, instance):
        delete_user_address(instance)


# --------------------------------------------------
# 15. JWT LOGIN
# --------------------------------------------------

class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer
    throttle_scope = "login"


# --------------------------------------------------
# 16. JWT LOGOUT
# --------------------------------------------------

class LogoutView(APIView):
    permission_classes = [IsActiveUser]

    def post(self, request):
        refresh_token = request.data.get("refresh")

        if not refresh_token:
            return Response(
                {"detail": "Refresh token is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            token = RefreshToken(refresh_token)

            token_user_id = token.get("user_id")

            if str(token_user_id) != str(request.user.pk):
                return Response(
                    {"detail": "Invalid refresh token."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            token.blacklist()

            return Response(
                {"message": "Logout successful."},
                status=status.HTTP_200_OK,
            )

        except TokenError:
            return Response(
                {"detail": "Invalid or expired refresh token."},
                status=status.HTTP_400_BAD_REQUEST,
            )
