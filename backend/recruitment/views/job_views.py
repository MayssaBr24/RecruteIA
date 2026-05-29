from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from ..models import JobOffer
from ..serializers import JobOfferSerializer
from ..permissions import IsRHUser
from rest_framework.permissions import AllowAny, IsAuthenticated
import requests
from rest_framework.decorators import api_view
from rest_framework.response import Response


class JobOfferListCreateView(generics.ListCreateAPIView):
    """GET: Liste publique offres | POST: Création offre (RH)"""
    serializer_class = JobOfferSerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [permissions.IsAuthenticated(), IsRHUser()]
        return [permissions.AllowAny()]

    def get_queryset(self):
        # Public : toutes les offres actives
        return JobOffer.objects.filter(is_active=True)

    def perform_create(self, serializer):
        serializer.save(
            created_by=self.request.user,
            company=self.request.user.company  # ← AJOUT
        )


class JobOfferDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = JobOfferSerializer

    def get_permissions(self):
        if self.request.method == 'GET':
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated(), IsRHUser(), CompanyObjectPermission()]

    def get_queryset(self):
        if self.request.method in ['PUT', 'PATCH', 'DELETE']:
            user = self.request.user
            # SUPERADMIN voit tout
            if user.role == 'SUPERADMIN' or user.is_superuser:
                return JobOffer.objects.all()
            # RH voit uniquement les offres de sa company
            return JobOffer.objects.filter(company=user.company)
        return JobOffer.objects.filter(is_active=True)


class RHJobOfferListView(generics.ListCreateAPIView):
    """GET: Offres du RH connecté uniquement | POST: Créer offre"""
    serializer_class = JobOfferSerializer
    permission_classes = [permissions.IsAuthenticated, IsRHUser]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'SUPERADMIN' or user.is_superuser:
            return JobOffer.objects.all()
        # ← Filtre par company
        return JobOffer.objects.filter(company=user.company)

    def perform_create(self, serializer):
        serializer.save(
            created_by=self.request.user,
            company=self.request.user.company  # ← AJOUT
        )
class JobOfferWeightsUpdateView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsRHUser]

    def post(self, request, pk):
        user = request.user
        try:
            # SUPERADMIN accès total, sinon filtre par company
            if user.role == 'SUPERADMIN' or user.is_superuser:
                job_offer = JobOffer.objects.get(pk=pk)
            else:
                job_offer = JobOffer.objects.get(pk=pk, company=user.company)
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





@api_view(['POST'])
def linkedin_search(request):
    data = request.data
    response = requests.post(
        'http://localhost:5678/webhook-test/linkedin-search',
        json={
            'JobTitle':        data.get('JobTitle'),
            'CompanyIndustry': data.get('CompanyIndustry'),
            'Location':        data.get('Location'),
        }
    )
    return Response(response.json())
