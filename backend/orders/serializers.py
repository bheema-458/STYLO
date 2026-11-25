
from rest_framework import serializers

from .models import (
    Order,
    OrderItem,
    PaymentAttempt,
    ReturnRequest,
    OrderStatusHistory,
    Refund,
)


# ==========================================
# 1. ORDER ITEM SERIALIZER
# ==========================================

class OrderItemSerializer(serializers.ModelSerializer):

    class Meta:
        model = OrderItem

        fields = [
            "id",
            "product",
            "variant",
            "product_name",
            "size",
            "color",
            "quantity",
            "price",
            "total_price",
        ]

        read_only_fields = fields


# ==========================================
# 2. PAYMENT ATTEMPT SERIALIZER
# ==========================================

class PaymentAttemptSerializer(serializers.ModelSerializer):

    class Meta:
        model = PaymentAttempt

        fields = [
            "id",
            "order",
            "amount",
            "currency",
            "razorpay_order_id",
            "razorpay_payment_id",
            "status",
            "failure_reason",
            "created_at",
            "updated_at",
        ]

        read_only_fields = fields


# ==========================================
# 3. RETURN REQUEST SERIALIZER
# ==========================================

class ReturnRequestSerializer(serializers.ModelSerializer):

    reviewed_by_email = serializers.EmailField(
        source="reviewed_by.email",
        read_only=True,
        allow_null=True,
    )

    class Meta:
        model = ReturnRequest

        fields = [
            "id",
            "order",
            "user",
            "reason",
            "status",
            "admin_note",
            "reviewed_by",
            "reviewed_by_email",
            "reviewed_at",
            "requested_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "order",
            "user",
            "status",
            "admin_note",
            "reviewed_by",
            "reviewed_by_email",
            "reviewed_at",
            "requested_at",
            "updated_at",
        ]

    def validate_reason(self, value):

        value = value.strip()

        if not value:
            raise serializers.ValidationError(
                "Return reason is required."
            )

        if len(value) < 5:
            raise serializers.ValidationError(
                "Please provide a more detailed return reason."
            )

        return value


# ==========================================
# 4. ORDER STATUS HISTORY SERIALIZER
# ==========================================

class OrderStatusHistorySerializer(serializers.ModelSerializer):

    changed_by_email = serializers.EmailField(
        source="changed_by.email",
        read_only=True,
        allow_null=True,
    )

    class Meta:
        model = OrderStatusHistory

        fields = [
            "id",
            "order",
            "status",
            "description",
            "changed_by",
            "changed_by_email",
            "created_at",
        ]

        read_only_fields = fields


# ==========================================
# 5. REFUND SERIALIZER
# ==========================================

class RefundSerializer(serializers.ModelSerializer):

    class Meta:
        model = Refund

        fields = [
            "id",
            "order",
            "payment_attempt",
            "initiated_by",
            "amount",
            "razorpay_refund_id",
            "status",
            "reason",
            "failure_reason",
            "created_at",
            "updated_at",
        ]

        read_only_fields = fields


# ==========================================
# 6. MAIN ORDER SERIALIZER
# ==========================================

class OrderSerializer(serializers.ModelSerializer):

    items = OrderItemSerializer(
        many=True,
        read_only=True,
    )

    payment_attempts = PaymentAttemptSerializer(
        many=True,
        read_only=True,
    )

    return_requests = ReturnRequestSerializer(
        many=True,
        read_only=True,
    )

    status_history = OrderStatusHistorySerializer(
        many=True,
        read_only=True,
    )

    refunds = RefundSerializer(
        many=True,
        read_only=True,
    )

    class Meta:
        model = Order

        fields = [
            "id",
            "user",
            "order_number",

            # Shipping details
            "full_name",
            "phone_number",
            "address",
            "city",
            "state",
            "pincode",

            # Price details
            "subtotal",
            "shipping_charge",
            "tax_amount",
            "total_amount",

            # Payment details
            "payment_method",
            "payment_status",

            # Order status
            "status",
            "cancellation_reason",
            "cancelled_at",

            # Related information
            "items",
            "payment_attempts",
            "return_requests",
            "status_history",
            "refunds",

            # Timestamps
            "created_at",
            "updated_at",
        ]

        read_only_fields = fields
