"""Review serializers."""

from rest_framework import serializers

from apps.reviews.models import Review


class ReviewSerializer(serializers.ModelSerializer):
    reviewer_name = serializers.SerializerMethodField()

    class Meta:
        model = Review
        fields = ("id", "reviewer_name", "rating", "comment", "created_at")
        read_only_fields = fields

    def get_reviewer_name(self, obj):
        u = obj.user
        full = f"{u.first_name} {u.last_name}".strip()
        if full:
            # Show first name + last initial for privacy
            parts = full.split()
            return f"{parts[0]} {parts[-1][0]}." if len(parts) > 1 else parts[0]
        return u.email.split("@")[0]
