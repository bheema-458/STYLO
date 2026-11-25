
from django.urls import path

from .views import (
    CreateOrderView,
    VerifyRazorpayPaymentView,
    RazorpayPaymentFailureView,
    RetryRazorpayPaymentView,
    MyOrdersView,
    OrderDetailView,
    CancelOrderView,
    CreateReturnRequestView,
    AdminOrderListView,
    AdminUpdateOrderStatusView,
    OrderInvoiceView,
    OrderTrackingView,
    AdminReturnListView,
    AdminUpdateReturnView,
    AdminCreateRefundView,
)


urlpatterns = [

    # ========================================
    # CHECKOUT
    # ========================================

    path(
        "checkout/",
        CreateOrderView.as_view(),
        name="checkout",
    ),

    # ========================================
    # RAZORPAY PAYMENT
    # ========================================

    path(
        "verify-payment/",
        VerifyRazorpayPaymentView.as_view(),
        name="verify-payment",
    ),

    path(
        "payment-failed/",
        RazorpayPaymentFailureView.as_view(),
        name="payment-failed",
    ),

    path(
        "retry-payment/<int:pk>/",
        RetryRazorpayPaymentView.as_view(),
        name="retry-payment",
    ),

    # ========================================
    # CUSTOMER ORDERS
    # ========================================

    path(
        "my-orders/",
        MyOrdersView.as_view(),
        name="my-orders",
    ),

    path(
        "detail/<int:pk>/",
        OrderDetailView.as_view(),
        name="order-detail",
    ),

    # ========================================
    # INVOICE
    # ========================================

    path(
        "detail/<int:pk>/invoice/",
        OrderInvoiceView.as_view(),
        name="order-invoice",
    ),

    # ========================================
    # ORDER TRACKING
    # ========================================

    path(
        "detail/<int:pk>/tracking/",
        OrderTrackingView.as_view(),
        name="order-tracking",
    ),

    # ========================================
    # CUSTOMER CANCELLATION & RETURN
    # ========================================

    path(
        "cancel/<int:pk>/",
        CancelOrderView.as_view(),
        name="cancel-order",
    ),

    path(
        "return/<int:pk>/",
        CreateReturnRequestView.as_view(),
        name="return-request",
    ),

    # ========================================
    # ADMIN ORDER MANAGEMENT
    # ========================================

    path(
        "admin/all/",
        AdminOrderListView.as_view(),
        name="admin-orders",
    ),

    path(
        "admin/update-status/<int:pk>/",
        AdminUpdateOrderStatusView.as_view(),
        name="admin-update-order-status",
    ),

    # ========================================
    # ADMIN RETURN MANAGEMENT
    # ========================================

    path(
        "admin/returns/",
        AdminReturnListView.as_view(),
        name="admin-return-list",
    ),

    path(
        "admin/returns/<int:pk>/",
        AdminUpdateReturnView.as_view(),
        name="admin-update-return",
    ),

    # ========================================
    # ADMIN REFUND MANAGEMENT
    # ========================================

    path(
        "admin/refund/<int:pk>/",
        AdminCreateRefundView.as_view(),
        name="admin-create-refund",
    ),

]
