"""Auth endpoints."""

from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.users.serializers import (
    ChangePasswordSerializer,
    RegisterSerializer,
    UpdateProfileSerializer,
    UserSerializer,
)


class RegisterView(generics.CreateAPIView):
    """POST /api/auth/register"""

    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(
            UserSerializer(user).data,
            status=status.HTTP_201_CREATED,
        )


class MeView(APIView):
    """GET /api/auth/me  — current user profile.
    PATCH /api/auth/me/ — update first_name / last_name.
    """

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        serializer = UpdateProfileSerializer(
            request.user,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(UserSerializer(user).data)


class ChangePasswordView(APIView):
    """POST /api/auth/change-password/ — change the authenticated user's password."""

    def post(self, request):
        serializer = ChangePasswordSerializer(
            data=request.data,
            context={'request': request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({'detail': 'Password updated successfully.'}, status=status.HTTP_200_OK)
