from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from ..models import JobOffer
from ..serializers import JobOfferSerializer
from ..permissions import IsRHUser
from rest_framework.permissions import AllowAny, IsAuthenticated

class JobOfferListCreateView(generics.ListCreateAPIView):
    """GET: Liste publique offres | POST: Création offre (RH)"""
    queryset = JobOffer.objects.filter(is_active=True)
    permission_classes = [AllowAny]  # ✅ public, pas besoin de token
    serializer_class = JobOfferSerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [permissions.IsAuthenticated(), IsRHUser()]
        return [permissions.AllowAny()]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


# Modifie ta classe JobOfferDetailView comme ceci :
class JobOfferDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET: Détail | PUT/PATCH: Modifier | DELETE: Supprimer"""
    queryset = JobOffer.objects.all()  # Enlever le filtre is_active ici pour permettre au RH d'y accéder
    serializer_class = JobOfferSerializer

    def get_permissions(self):
        # Tout le monde peut voir le détail (GET)
        if self.request.method == 'GET':
            return [permissions.AllowAny()]
        # Seul le créateur (RH) peut modifier ou supprimer
        return [permissions.IsAuthenticated(), IsRHUser()]

    def get_queryset(self):
        # Pour les méthodes de modification/suppression, on vérifie que c'est bien l'auteur
        if self.request.method in ['PUT', 'PATCH', 'DELETE']:
            return JobOffer.objects.filter(created_by=self.request.user)
        return JobOffer.objects.filter(is_active=True)

class RHJobOfferListView(generics.ListCreateAPIView):
    """GET: Offres du RH | POST: Créer offre (RH)"""
    serializer_class = JobOfferSerializer
    permission_classes = [permissions.IsAuthenticated, IsRHUser]

    def get_queryset(self):
        return JobOffer.objects.filter(created_by=self.request.user)

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class JobOfferWeightsUpdateView(APIView):
    """POST: Mettre à jour les poids IA d'une offre"""
    permission_classes = [permissions.IsAuthenticated, IsRHUser]

    def post(self, request, pk):
        try:
            job_offer = JobOffer.objects.get(pk=pk, created_by=request.user)
        except JobOffer.DoesNotExist:
            return Response({'error': 'Offre non trouvée'}, status=404)

        weights = request.data.get('weights', {})

        # Mise à jour des poids
        if 'cv' in weights:
            job_offer.weight_cv = float(weights['cv'])
        if 'motivation' in weights:
            job_offer.weight_motivation = float(weights['motivation'])
        if 'softskills' in weights:
            job_offer.weight_softskills = float(weights['softskills'])
        if 'github' in weights:
            job_offer.weight_github = float(weights['github'])

        # Validation somme = 1
        total = (job_offer.weight_cv + job_offer.weight_motivation +
                 job_offer.weight_softskills + job_offer.weight_github)

        if abs(total - 1.0) > 0.01:
            return Response({'error': f'Somme des poids = {total} (doit être 1)'}, status=400)

        job_offer.save()
        return Response({'success': True, 'weights': {
            'cv': job_offer.weight_cv,
            'motivation': job_offer.weight_motivation,
            'softskills': job_offer.weight_softskills,
            'github': job_offer.weight_github
        }})