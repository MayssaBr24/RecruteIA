from rest_framework import permissions
from rest_framework.permissions import BasePermission

class IsRHUser(permissions.BasePermission):
    """RH, ADMIN et SUPERADMIN peuvent accéder"""
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.role in ['RH', 'ADMIN', 'SUPERADMIN']
        )

class IsAdminUser(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.role in ['ADMIN', 'SUPERADMIN']
        )

class IsRHOrAdmin(BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.role in ['RH', 'ADMIN', 'SUPERADMIN']
        )

class IsSuperAdmin(BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.role == 'SUPERADMIN'
        )

class IsAdminRH(BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.role in ['ADMIN', 'SUPERADMIN']
        )

class IsSuperAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'SUPERADMIN'

class CompanyIsolationMixin:
    """
    Mixin à ajouter sur toutes les vues RH.
    Filtre automatiquement par company de l'utilisateur connecté.
    """
    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user

        if not user.is_authenticated:
            return qs.none()

        # SUPERADMIN voit tout
        if user.role == 'SUPERADMIN' or user.is_superuser:
            return qs

        # RH et ADMIN voient uniquement leur company
        if user.company:
            return self._filter_by_company(qs, user.company)

        return qs.none()

    def _filter_by_company(self, qs, company):
        """Filtre intelligent selon le modèle"""
        model = qs.model

        if hasattr(model, 'company'):
            return qs.filter(company=company)
        if hasattr(model, 'job_offer'):
            return qs.filter(job_offer__company=company)
        if hasattr(model, 'application'):
            return qs.filter(application__job_offer__company=company)
        return qs.none()


class CompanyObjectPermission(BasePermission):
    """
    Vérifie qu'un objet appartient bien à la company de l'utilisateur.
    À ajouter sur les vues detail (retrieve, update, destroy).
    """
    def has_object_permission(self, request, view, obj):
        user = request.user

        if user.role == 'SUPERADMIN' or user.is_superuser:
            return True

        if not user.company:
            return False

        # Remonter à la company selon le type d'objet
        if hasattr(obj, 'company'):
            return obj.company == user.company
        if hasattr(obj, 'job_offer'):
            return obj.job_offer.company == user.company
        if hasattr(obj, 'application'):
            return obj.application.job_offer.company == user.company

        return False