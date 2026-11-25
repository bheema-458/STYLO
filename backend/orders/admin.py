
from django.contrib import admin

from .models import (
    Order,
    OrderItem,
    PaymentAttempt,
    ReturnRequest,
    OrderStatusHistory,
    Refund,
)


# ==========================================
# 1. ORDER ITEM INLINE
# ==========================================

class OrderItemInline(admin.TabularInline):

    model = OrderItem
    extra = 0
    can_delete = False

    readonly_fields = (
        "product",
        "variant",
        "product_name",
        "size",
        "color",
        "quantity",
        "price",
        "total_price",
    )


# ==========================================
# 2. PAYMENT ATTEMPT INLINE
# ==========================================

class PaymentAttemptInline(admin.TabularInline):

    model = PaymentAttempt
    extra = 0
    can_delete = False
    show_change_link = True

    readonly_fields = (
        "amount",
        "currency",
        "razorpay_order_id",
        "razorpay_payment_id",
        "status",
        "failure_reason",
        "created_at",
        "updated_at",
    )


# ==========================================
# 3. ORDER STATUS HISTORY INLINE
# ==========================================

class OrderStatusHistoryInline(admin.TabularInline):

    model = OrderStatusHistory
    extra = 0
    can_delete = False

    readonly_fields = (
        "status",
        "description",
        "changed_by",
        "created_at",
    )


# ==========================================
# 4. ORDER ADMIN
# ==========================================

@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):

    list_display = (
        "order_number",
        "user",
        "full_name",
        "total_amount",
        "payment_method",
        "payment_status",
        "status",
        "created_at",
    )

    list_filter = (
        "status",
        "payment_method",
        "payment_status",
        "created_at",
    )

    search_fields = (
        "order_number",
        "user__email",
        "full_name",
        "phone_number",
    )

    readonly_fields = (
        "order_number",
        "user",
        "full_name",
        "phone_number",
        "address",
        "city",
        "state",
        "pincode",
        "subtotal",
        "shipping_charge",
        "tax_amount",
        "total_amount",
        "payment_method",
        "payment_status",
        "created_at",
        "updated_at",
        "cancelled_at",
    )

    inlines = [
        OrderItemInline,
        PaymentAttemptInline,
        OrderStatusHistoryInline,
    ]

    list_per_page = 20

    date_hierarchy = "created_at"

    ordering = ("-created_at",)


# ==========================================
# 5. PAYMENT ATTEMPT ADMIN
# ==========================================

@admin.register(PaymentAttempt)
class PaymentAttemptAdmin(admin.ModelAdmin):

    list_display = (
        "id",
        "order",
        "amount",
        "currency",
        "status",
        "razorpay_order_id",
        "created_at",
    )

    list_filter = (
        "status",
        "currency",
        "created_at",
    )

    search_fields = (
        "order__order_number",
        "razorpay_order_id",
        "razorpay_payment_id",
    )

    readonly_fields = (
        "order",
        "amount",
        "currency",
        "razorpay_order_id",
        "razorpay_payment_id",
        "razorpay_signature",
        "status",
        "failure_reason",
        "created_at",
        "updated_at",
    )

    list_per_page = 20


# ==========================================
# 6. RETURN REQUEST ADMIN
# ==========================================

@admin.register(ReturnRequest)
class ReturnRequestAdmin(admin.ModelAdmin):

    list_display = (
        "id",
        "order",
        "user",
        "status",
        "requested_at",
        "reviewed_at",
    )

    list_filter = (
        "status",
        "requested_at",
    )

    search_fields = (
        "order__order_number",
        "user__email",
        "reason",
    )

    readonly_fields = (
        "order",
        "user",
        "reason",
        "requested_at",
        "updated_at",
    )

    list_per_page = 20


# ==========================================
# 7. ORDER STATUS HISTORY ADMIN
# ==========================================

@admin.register(OrderStatusHistory)
class OrderStatusHistoryAdmin(admin.ModelAdmin):

    list_display = (
        "order",
        "status",
        "description",
        "changed_by",
        "created_at",
    )

    list_filter = (
        "status",
        "created_at",
    )

    search_fields = (
        "order__order_number",
        "description",
    )

    readonly_fields = (
        "order",
        "status",
        "description",
        "changed_by",
        "created_at",
    )


# ==========================================
# 8. REFUND ADMIN
# ==========================================

@admin.register(Refund)
class RefundAdmin(admin.ModelAdmin):

    list_display = (
        "id",
        "order",
        "amount",
        "status",
        "razorpay_refund_id",
        "initiated_by",
        "created_at",
    )

    list_filter = (
        "status",
        "created_at",
    )

    search_fields = (
        "order__order_number",
        "razorpay_refund_id",
        "payment_attempt__razorpay_payment_id",
    )

    readonly_fields = (
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
    )

    list_per_page = 20
