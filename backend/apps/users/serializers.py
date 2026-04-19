"""User registration and profile serializers."""

from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from apps.users.models import User


class UserSerializer(serializers.ModelSerializer):
    """Public user fields (read-only)."""

    class Meta:
        model = User
        fields = ('id', 'email', 'first_name', 'last_name', 'role', 'date_joined')
        read_only_fields = fields


class UpdateProfileSerializer(serializers.ModelSerializer):
    """Allow the authenticated user to update their display name."""

    class Meta:
        model = User
        fields = ('first_name', 'last_name')

    def update(self, instance, validated_data):
        instance.first_name = validated_data.get('first_name', instance.first_name)
        instance.last_name = validated_data.get('last_name', instance.last_name)
        instance.save(update_fields=['first_name', 'last_name'])
        return instance


class ChangePasswordSerializer(serializers.Serializer):
    """Validate and apply a password change for the authenticated user."""

    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError('Current password is incorrect.')
        return value

    def validate_new_password(self, value):
        validate_password(value, self.context['request'].user)
        return value

    def save(self, **kwargs):
        user = self.context['request'].user
        user.set_password(self.validated_data['new_password'])
        user.save(update_fields=['password'])
        return user


class RegisterSerializer(serializers.ModelSerializer):
    """Sign-up with password validation."""

    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ('email', 'password', 'first_name', 'last_name')

    def validate_password(self, value):
        validate_password(value)
        return value

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.username = user.email
        user.set_password(password)
        user.save()
        return user
