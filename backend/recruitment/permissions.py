from rest_framework import permissions


class IsRHUser(permissions.BasePermission):
    """Permission pour vérifier si l'utilisateur est RH"""

    def has_permission(self, request, view):
        # Support pour les deux implémentations (groups ou role)
        if hasattr(request.user, 'role'):
            return bool(
                request.user and
                request.user.is_authenticated and
                request.user.role == 'RH'
            )
        else:
            return bool(
                request.user and
                request.user.is_authenticated and
                hasattr(request.user, 'groups') and
                request.user.groups.filter(name='RH').exists()
            )


class IsAdminUser(permissions.BasePermission):
    """Permission pour vérifier si l'utilisateur est Admin"""

    def has_permission(self, request, view):
        # Support pour les deux implémentations
        if hasattr(request.user, 'role'):
            return bool(
                request.user and
                request.user.is_authenticated and
                request.user.role == 'ADMIN'
            )
        else:
            return bool(
                request.user and
                request.user.is_authenticated and
                (request.user.is_staff or
                 request.user.groups.filter(name='ADMIN').exists())
            )


class IsRHOrAdmin(permissions.BasePermission):
    """Permission pour vérifier si l'utilisateur est RH ou Admin"""

    def has_permission(self, request, view):
        # Support pour les deux implémentations
        if hasattr(request.user, 'role'):
            return bool(
                request.user and
                request.user.is_authenticated and
                request.user.role in ['RH', 'ADMIN']
            )
        else:
            return bool(
                request.user and
                request.user.is_authenticated and
                (request.user.is_staff or
                 request.user.groups.filter(name__in=['RH', 'ADMIN']).exists())
            )


class IsCandidateUser(permissions.BasePermission):
    """Permission pour vérifier si l'utilisateur est Candidat"""

    def has_permission(self, request, view):
        if hasattr(request.user, 'role'):
            return bool(
                request.user and
                request.user.is_authenticated and
                request.user.role == 'CANDIDATE'
            )
        return False


class IsOwnerOrAdmin(permissions.BasePermission):
    """Permission pour vérifier si l'utilisateur est le propriétaire ou un admin"""

    def has_object_permission(self, request, view, obj):
        # Admin a tous les droits
        if hasattr(request.user, 'role'):
            is_admin = request.user.role == 'ADMIN'
        else:
            is_admin = request.user.is_staff or request.user.groups.filter(name='ADMIN').exists()

        if is_admin:
            return True

        # Vérifier si l'utilisateur est le propriétaire
        if hasattr(obj, 'created_by'):
            return obj.created_by == request.user
        elif hasattr(obj, 'user'):
            return obj.user == request.user
        elif hasattr(obj, 'author'):
            return obj.author == request.user

        return False