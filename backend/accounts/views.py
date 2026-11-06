from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
import secrets
from datetime import timedelta
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import make_password, check_password
from django.core.mail import send_mail
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, filters, status
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny, IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView


from .models import Address, EmailOTP
from .serializers import (
    AddressSerializer,
    RegisterSerializer,
    AdminUserListSerializer,
    ProfileUpdateSerializer,
    PasswordChangeSerializer,
    CustomTokenObtainPairSerializer,
    ForgotPasswordSerializer,
    ResetPasswordSerializer,
    ProfileImageSerializer,
)
from .permissions import IsActiveCustomer
from .permissions import IsAdminUser as IsActiveAdmin
User = get_user_model()
# 1. Customer Registration
class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]
    throttle_scope = "registration"

    def perform_create(self, serializer):
        user = serializer.save()

        otp = f"{secrets.randbelow(1000000):06d}"

        EmailOTP.objects.filter(
            user=user,
            is_verified=False,
            purpose="email_verification"
        ).delete()

        expires_at = timezone.now() + timedelta(minutes=5)

        EmailOTP.objects.create(
            user=user,
            otp=make_password(otp),
            expires_at=expires_at,
            purpose="email_verification",
        )

        send_mail(
            subject="STYLO Email Verification OTP",
            message=(
                f"Hello {user.first_name or user.username},\n\n"
                f"Your STYLO verification OTP is: {otp}\n\n"
                "This OTP expires in 5 minutes."
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False,
        )
class VerifyEmailView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get("email", "").strip().lower()
        otp = request.data.get("otp", "").strip()

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

        if user.is_email_verified:
            return Response(
                {"detail": "Email is already verified."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        otp_record = EmailOTP.objects.filter(
            user=user,
            is_verified=False,
            purpose="email_verification",
        ).order_by("-created_at").first()

        if otp_record is None:
            return Response(
                {"detail": "No active OTP found. Please request a new OTP."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if timezone.now() >= otp_record.expires_at:
            otp_record.delete()
            return Response(
                {"detail": "OTP expired. Please request a new OTP."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if otp_record.attempts >= 5:
            otp_record.delete()
            return Response(
                {"detail": "Too many attempts. Please request a new OTP."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        otp_record.attempts += 1
        otp_record.save(update_fields=["attempts"])

        if not check_password(otp, otp_record.otp):
            return Response(
                {"detail": "Invalid email or OTP."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.is_email_verified = True
        user.save(update_fields=["is_email_verified"])

        otp_record.is_verified = True
        otp_record.save(update_fields=["is_verified"])

        return Response(
            {"message": "Email verified successfully. You can now log in."},
            status=status.HTTP_200_OK,
        )

class ResendOTPView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "resend_otp"

    def post(self, request):
        email = request.data.get("email", "").strip().lower()

        if not email:
            return Response(
                {"detail": "Email is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = User.objects.filter(email__iexact=email).first()

        if user is None or user.is_email_verified:
            return Response(
                {"message": "If the account needs verification, an OTP can be requested."},
                status=status.HTTP_200_OK,
            )

        latest_otp = EmailOTP.objects.filter(
            user=user,
            is_verified=False,
            purpose="email_verification",
        ).order_by("-created_at").first()

        if latest_otp and (
            timezone.now() - latest_otp.created_at
        ).total_seconds() < 60:
            return Response(
                {"detail": "Please wait 60 seconds before requesting another OTP."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        EmailOTP.objects.filter(
            user=user,
            is_verified=False,
            purpose="email_verification",
        ).delete()

        otp = f"{secrets.randbelow(1000000):06d}"
        expires_at = timezone.now() + timedelta(minutes=5)

        EmailOTP.objects.create(
            user=user,
            otp=make_password(otp),
            expires_at=expires_at,
            purpose="email_verification",
        )

        send_mail(
            subject="STYLO Email Verification OTP",
            message=(
                f"Your new STYLO verification OTP is: {otp}\n\n"
                "This OTP expires in 5 minutes."
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False,
        )

        return Response(
            {"message": "If the account needs verification, an OTP can be requested."},
            status=status.HTTP_200_OK,
        )
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
            is_blocked=False
        ).first()

        # Use the same response whether or not the account exists.
        if user:
            otp = f"{secrets.randbelow(1000000):06d}"

            EmailOTP.objects.filter(
                user=user,
                purpose="password_reset",
                is_verified=False
            ).delete()

            expires_at = timezone.now() + timedelta(minutes=5)

            EmailOTP.objects.create(
                user=user,
                otp=make_password(otp),
                purpose="password_reset",
                expires_at=expires_at
            )

            send_mail(
                subject="STYLO Password Reset OTP",
                message=(
                    f"Hello {user.first_name or user.username},\n\n"
                    f"Your STYLO password reset OTP is: {otp}\n\n"
                    "This OTP expires in 5 minutes."
                ),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                fail_silently=False,
            )

        return Response(
            {
                "message": (
                    "If an eligible account exists with this email, "
                    "a password reset OTP has been sent."
                )
            },
            status=status.HTTP_200_OK
        )

class ResetPasswordView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "reset_password"

    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)

        # Step 1: Validate request data
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"]
        otp = serializer.validated_data["otp"]
        new_password = serializer.validated_data["new_password"]

        # Step 2: Find eligible user
        user = User.objects.filter(
            email__iexact=email,
            is_active=True,
            is_email_verified=True,
            is_blocked=False,
        ).first()

        # Debugging information
        print("RESET EMAIL:", email)
        print("USER FOUND:", user is not None)

        if user:
            print("USER EMAIL VERIFIED:", user.is_email_verified)
            print("USER ACTIVE:", user.is_active)
            print("USER BLOCKED:", user.is_blocked)

        if not user:
            return Response(
                {"detail": "Invalid or expired OTP."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Step 3: Find latest password reset OTP
        otp_record = EmailOTP.objects.filter(
            user=user,
            purpose="password_reset",
            is_verified=False,
        ).order_by("-created_at").first()

        print("OTP RECORD FOUND:", otp_record is not None)

        if not otp_record:
            return Response(
                {"detail": "Invalid or expired OTP."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Step 4: Check OTP expiry
        if timezone.now() >= otp_record.expires_at:
            otp_record.delete()
            return Response(
                {"detail": "OTP has expired. Please request a new OTP."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        print("OTP EXPIRED:", timezone.now() >= otp_record.expires_at)
        print("OTP ATTEMPTS:", otp_record.attempts)

        # Step 5: Check maximum attempts
        if otp_record.attempts >= 5:
            otp_record.delete()
            return Response(
                {"detail": "Too many attempts. Request a new OTP."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Step 6: Increment attempts
        otp_record.attempts += 1
        otp_record.save(update_fields=["attempts"])

        # Step 7: Verify OTP
        if not check_password(otp, otp_record.otp):
            return Response(
                {"detail": "Invalid OTP. Please try again."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Step 8: Update password securely
        user.set_password(new_password)
        user.save(update_fields=["password"])

        # Step 9: Delete used OTP records
        EmailOTP.objects.filter(
            user=user,
            purpose="password_reset",
        ).delete()

        # Step 10: Return success response
        return Response(
            {
                "message": (
                    "Password reset successfully. "
                    "Please log in with your new password."
                )
            },
            status=status.HTTP_200_OK,
        )

class ProfileView(APIView):
    permission_classes = [IsActiveCustomer]

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
    
class ProfileImageUploadView(APIView):
    permission_classes = [IsActiveCustomer]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        serializer = ProfileImageSerializer(
            request.user,
            data=request.data,
            partial=True
        )

        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response({
            "message": "Profile image uploaded successfully.",
            "profile_image": request.build_absolute_uri(
                request.user.profile_image.url
            )
        }, status=status.HTTP_200_OK)

    def delete(self, request):
        user = request.user

        if user.profile_image:
            user.profile_image.delete(save=True)

        return Response({
            "message": "Profile image removed successfully."
        }, status=status.HTTP_200_OK)


class ProfileUpdateView(generics.UpdateAPIView):
    serializer_class = ProfileUpdateSerializer
    permission_classes = [IsActiveCustomer]

    def get_object(self):
        return self.request.user


# 3. Admin User Pagination
class AdminUserPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 50


# 4. Admin User List, Search and Latest-First Sorting
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


# 5. Admin Block / Unblock Customer
class AdminUserStatusView(APIView):
    permission_classes = [IsActiveAdmin]

    def patch(self, request, user_id):
        target_user = get_object_or_404(User, id=user_id)

        # Do not allow admin to block their own account.
        if target_user.id == request.user.id:
            return Response(
                {"detail": "You cannot block your own account."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Protect staff and superuser accounts.
        if target_user.is_staff or target_user.is_superuser:
            return Response(
                {"detail": "Admin accounts cannot be blocked here."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        is_blocked = request.data.get("is_blocked")

        if not isinstance(is_blocked, bool):
            return Response(
                {"is_blocked": "Send true or false."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        target_user.is_blocked = is_blocked
        target_user.save(update_fields=["is_blocked"])

        return Response({
            "id": target_user.id,
            "username": target_user.username,
            "is_blocked": target_user.is_blocked,
            "message": (
                "User blocked successfully."
                if is_blocked
                else "User unblocked successfully."
            ),
        })
    
class PasswordChangeView(generics.GenericAPIView):
    serializer_class = PasswordChangeSerializer
    permission_classes = [IsActiveCustomer]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response({
            "message": "Password changed successfully."
        }, status=status.HTTP_200_OK)


class AddressListCreateView(generics.ListCreateAPIView):
    serializer_class = AddressSerializer
    permission_classes = [IsActiveCustomer]

    def get_queryset(self):
        return Address.objects.filter(
            user=self.request.user
        ).order_by("-created_at")

    def perform_create(self, serializer):
        user = self.request.user
        is_default = serializer.validated_data.get(
            "is_default", False
        )

        if is_default or not Address.objects.filter(
            user=user
        ).exists():
            Address.objects.filter(
                user=user,
                is_default=True
            ).update(is_default=False)

            serializer.save(user=user, is_default=True)
        else:
            serializer.save(user=user)


class AddressDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = AddressSerializer
    permission_classes = [IsActiveCustomer]

    def get_queryset(self):
        return Address.objects.filter(
            user=self.request.user
        )

    def perform_update(self, serializer):
        user = self.request.user
        is_default = serializer.validated_data.get(
            "is_default",
            serializer.instance.is_default
        )

        if is_default:
            Address.objects.filter(
                user=user,
                is_default=True
            ).exclude(
                pk=serializer.instance.pk
            ).update(is_default=False)

        serializer.save()

    def perform_destroy(self, instance):
        user = self.request.user
        was_default = instance.is_default

        instance.delete()

        if was_default:
            next_address = Address.objects.filter(
                user=user
            ).order_by("-created_at").first()

            if next_address:
                next_address.is_default = True
                next_address.save(update_fields=["is_default"])

class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer
    throttle_scope = "login"

class LogoutView(APIView):
    permission_classes = [IsActiveCustomer]

    def post(self, request):
        refresh_token = request.data.get("refresh")

        if not refresh_token:
            return Response(
                {"detail": "Refresh token is required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            token = RefreshToken(refresh_token)
            token.blacklist()

            return Response(
                {"message": "Logout successful."},
                status=status.HTTP_200_OK
            )

        except TokenError:
            return Response(
                {"detail": "Invalid or expired refresh token."},
                status=status.HTTP_400_BAD_REQUEST
            )
