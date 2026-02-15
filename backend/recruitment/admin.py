from django.contrib import admin
from .models import JobOffer, Application, User, Interview, RHAvailability, RHSettings

@admin.register(JobOffer)
class JobOfferAdmin(admin.ModelAdmin):
    # On vérifie que ces noms correspondent EXACTEMENT aux champs dans models.py
    list_display = ('title', 'created_by', 'created_at', 'is_active')
    list_filter = ('is_active', 'created_at')
    search_fields = ('title', 'description')
    # On retire updated_at s'il posait problème avant
    readonly_fields = ('created_at',)

# Enregistre aussi les autres modèles pour pouvoir les voir dans l'admin
admin.site.register(User)
admin.site.register(Application)
admin.site.register(Interview)
admin.site.register(RHAvailability)
admin.site.register(RHSettings)