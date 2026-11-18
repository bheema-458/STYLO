
from django.urls import path

from .views import (
    CreateOrderView,
    MyOrdersView,
    OrderDetailView,
    CancelOrderView,
    AdminOrderListView,
    AdminUpdateOrderStatusView,
)

urlpatterns = [

    # Customer
    path('checkout/', CreateOrderView.as_view(), name='checkout'),

    path('my-orders/', MyOrdersView.as_view(), name='my-orders'),

    path(
        'detail/<int:pk>/',
        OrderDetailView.as_view(),
        name='order-detail'
    ),

    path(
        'cancel/<int:pk>/',
        CancelOrderView.as_view(),
        name='cancel-order'
    ),

    # Admin
    path(
        'admin/all/',
        AdminOrderListView.as_view(),
        name='admin-orders'
    ),

    path(
        'admin/update-status/<int:pk>/',
        AdminUpdateOrderStatusView.as_view(),
        name='admin-update-order-status'
    ),
]
