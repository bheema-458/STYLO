
from rest_framework import serializers
from .models import Order, OrderItem


class OrderItemSerializer(serializers.ModelSerializer):

    class Meta:
        model = OrderItem
        fields = [
            'id',
            'product',
            'variant',
            'product_name',
            'size',
            'color',
            'quantity',
            'price',
            'total_price',
        ]

        read_only_fields = fields


class OrderSerializer(serializers.ModelSerializer):

    items = OrderItemSerializer(many=True, read_only=True)

    class Meta:
        model = Order
        fields = [
            'id',
            'order_number',
            'user',
            'full_name',
            'phone_number',
            'address',
            'city',
            'state',
            'pincode',
            'subtotal',
            'shipping_charge',
            'total_amount',
            'status',
            'payment_status',
            'items',
            'created_at',
            'updated_at',
        ]

        read_only_fields = fields
