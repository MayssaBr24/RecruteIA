from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date
from enum import Enum
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# TYPES D'INCOHÉRENCES DE PROFIL
# ─────────────────────────────────────────────────────────────────────────────

class ProfileInconsistencyType(str, Enum):
    LOCATION_MISMATCH              = "LOCALISATION_DIFFÉRENTE"
    NATIONALITY_ADMIN              = "SITUATION_ADMINISTRATIVE"
    DIPLOMA_DOMAIN_MISMATCH        = "DIPLÔME_HORS_DOMAINE"
    DIPLOMA_UNIVERSITY_INCOHERENCE = "INCOHÉRENCE_UNIVERSITÉ"
    AGE_EXPERIENCE_INCOHERENCE     = "INCOHÉRENCE_ÂGE_EXPÉRIENCE"
    SALARY_ANOMALY                 = "ANOMALIE_SALAIRE"
    MISSING_CERTIFICATION          = "CERTIFICATION_NON_VÉRIFIÉE"
    ABSENT_EXPERIENCE              = "EXPÉRIENCE_ABSENTE_CV"
    CV_GIT_DISCREPANCY             = "DISCORDANCE_CV_GIT"
    CV_LETTER_DISCREPANCY          = "DISCORDANCE_CV_LETTRE"
    CURRENT_POSITION_MISMATCH      = "POSTE_ACTUEL_INCOHÉRENT"
    TECHNICAL_WEAKNESS             = "FAIBLESSE_TECHNIQUE"
    UNVERIFIED_CLAIM               = "DÉCLARATION_NON_VÉRIFIABLE"


@dataclass
class ProfileInconsistency:
    """
    Une incohérence détectée dans le profil candidat.

    NE PÉNALISE PAS le score.
    Génère une question pour l'entretien et une note pour le RH.
    """
    type: ProfileInconsistencyType
    description: str
    severity: str               # "low" | "medium" | "high"
    suggested_question: Optional[str] = None   # injectée en phase comm/clarif
    rh_note: Optional[str] = None              # note pour le rapport RH


# ─────────────────────────────────────────────────────────────────────────────
# DÉTECTION DES INCOHÉRENCES
# ─────────────────────────────────────────────────────────────────────────────

def detect_profile_inconsistencies(
    profile: Dict,
    rag_cv: str = "",
    rag_cert: str = "",
) -> List[ProfileInconsistency]:
    """
    Analyse croisée du profil candidat.
    Retourne une liste d'incohérences à explorer en entretien.

    Ces incohérences NE bloquent pas et NE pénalisent pas le score.
    """
    inconsistencies: List[ProfileInconsistency] = []

    # ── 1. LOCALISATION ────────────────────────────────────────────────────────
    if not profile.get("same_city") and profile.get("city") and profile.get("job_city"):
        inconsistencies.append(ProfileInconsistency(
            type=ProfileInconsistencyType.LOCATION_MISMATCH,
            description=f"Candidat basé à {profile['city']}, poste à {profile['job_city']}.",
            severity="medium",
            suggested_question=(
                f"Vous résidez actuellement à {profile['city']} alors que le poste est basé à {profile['job_city']}. "
                f"Comment envisagez-vous concrètement ce déplacement au quotidien — avez-vous déjà calculé "
                f"le temps de trajet ou envisagez-vous une relocalisation ?"
            ),
            rh_note="À clarifier : mobilité, transport, relocalisation envisagée.",
        ))

    # ── 2. NATIONALITÉ / SITUATION ADMINISTRATIVE ──────────────────────────────
    nationality_lower = (profile.get("nationality") or "").lower()
    job_country_lower = (profile.get("job_country") or "").lower()
    nationality_suggests_non_eu = bool(
        profile.get("nationality")
        and job_country_lower == "france"
        and not any(n in nationality_lower for n in (
            "français", "française", "french",
            "belge", "suisse", "allemand", "espagnol", "italien",
            "portugais", "néerlandais", "luxembourgeois",
            "autrichien", "grec", "polonais", "roumain",
            # Pays avec accords franco-* fréquents — flag inutile
            "tunisien", "tunisienne", "marocain", "marocaine",
            "algérien", "algérienne",
        ))
    )
    if nationality_suggests_non_eu:
        inconsistencies.append(ProfileInconsistency(
            type=ProfileInconsistencyType.NATIONALITY_ADMIN,
            description=f"Nationalité {profile['nationality']} — poste en France. Titre de séjour à vérifier.",
            severity="high",
            suggested_question=(
                f"Votre nationalité est {profile['nationality']} et le poste est basé en {profile['job_country']}. "
                f"Pouvez-vous nous préciser votre situation administrative actuelle — "
                f"disposez-vous d'un titre de séjour valide autorisant le travail ?"
            ),
            rh_note="Vérification obligatoire du titre de travail avant toute offre.",
        ))

    # ── 3. DIPLÔME ≠ DOMAINE OFFRE ─────────────────────────────────────────────
    diploma_text = (profile.get("diploma", "") + " " + profile.get("diploma_domain", "")).lower()
    domain_text  = (profile.get("job_domain") or "").lower()
    domain_words = [w for w in domain_text.split() if len(w) > 3]
    if diploma_text and domain_words and not any(w in diploma_text for w in domain_words):
        inconsistencies.append(ProfileInconsistency(
            type=ProfileInconsistencyType.DIPLOMA_DOMAIN_MISMATCH,
            description=f"Diplôme en {profile.get('diploma_domain') or profile.get('diploma')} pour un poste en {profile.get('job_domain')}.",
            severity="medium",
            suggested_question=(
                f"Votre diplôme est en {profile.get('diploma_domain') or profile.get('diploma')} "
                f"(obtenu à {profile.get('university')}), mais vous postulez pour un poste de "
                f"{profile.get('job_title')} dans le domaine {profile.get('job_domain')}. "
                f"Quel a été l'élément déclencheur de cette reconversion ?"
            ),
            rh_note="Vérifier la solidité de la reconversion lors de l'entretien humain.",
        ))

    # ── 4. INCOHÉRENCE ÂGE / DIPLÔME / EXPÉRIENCE ─────────────────────────────
    if profile.get("graduation_year") and profile.get("experience_years") is not None:
        current_year        = date.today().year
        years_since_diploma = current_year - int(profile["graduation_year"])
        declared_exp        = int(profile["experience_years"])
        if declared_exp > years_since_diploma + 2:
            inconsistencies.append(ProfileInconsistency(
                type=ProfileInconsistencyType.AGE_EXPERIENCE_INCOHERENCE,
                description=(
                    f"{declared_exp} ans d'expérience déclarés, diplômé en {profile['graduation_year']} "
                    f"({years_since_diploma} ans max possible)."
                ),
                severity="high",
                suggested_question=(
                    f"Votre CV mentionne {declared_exp} années d'expérience professionnelle, "
                    f"mais votre diplôme date de {profile['graduation_year']}, soit {years_since_diploma} ans. "
                    f"Pouvez-vous me détailler votre parcours chronologique depuis l'obtention de votre diplôme ?"
                ),
                rh_note="Vérification chronologique obligatoire du parcours.",
            ))

    # ── 5. SALAIRE ANORMAL ─────────────────────────────────────────────────────
    if profile.get("salary_monthly") is not None:
        try:
            sal = float(str(profile["salary_monthly"]).replace(" ", "").replace("€", "").replace(",", "."))
            sal_annual = sal * 12
            if sal < 1000:
                inconsistencies.append(ProfileInconsistency(
                    type=ProfileInconsistencyType.SALARY_ANOMALY,
                    description=f"Prétention très basse : {sal:.0f} €/mois ({sal_annual:.0f} €/an).",
                    severity="medium",
                    suggested_question=(
                        f"Vous mentionnez une prétention salariale de {sal:.0f} €/mois. "
                        f"Ce montant est en dessous des grilles habituelles pour un poste de {profile.get('job_title')}. "
                        f"Comment êtes-vous arrivé à cette estimation ?"
                    ),
                    rh_note="Vérifier si la valeur est une erreur de saisie (mensuel vs annuel).",
                ))
            elif sal > 15_000:
                inconsistencies.append(ProfileInconsistency(
                    type=ProfileInconsistencyType.SALARY_ANOMALY,
                    description=f"Prétention très élevée : {sal:.0f} €/mois ({sal_annual:.0f} €/an).",
                    severity="medium",
                    suggested_question=(
                        f"Vos prétentions s'élèvent à {sal:.0f} €/mois ({sal_annual:.0f} €/an). "
                        f"Sur quels éléments basez-vous cette demande — avez-vous actuellement "
                        f"une rémunération équivalente dans votre poste de {profile.get('current_position') or 'votre poste actuel'} ?"
                    ),
                    rh_note="Comparer avec la grille salariale interne avant l'entretien humain.",
                ))
        except (ValueError, TypeError):
            pass

    # ── 6. CERTIFICATIONS NON VÉRIFIÉES ───────────────────────────────────────
    for cert in (profile.get("certifications") or []):
        cert_words = [w for w in cert.lower().split() if len(w) > 3]
        cert_found = any(w in rag_cert.lower() for w in cert_words)
        if cert and rag_cert and not cert_found:            inconsistencies.append(ProfileInconsistency(
                type=ProfileInconsistencyType.MISSING_CERTIFICATION,
                description=f"Certification « {cert} » déclarée sans document vérifié.",
                severity="medium",
                suggested_question=(
                    f"Votre profil mentionne la certification {cert}. "
                    f"Pouvez-vous nous indiquer la date exacte d'obtention, "
                    f"l'organisme certificateur et votre numéro de certification ?"
                ),
                rh_note=f"Demander le justificatif officiel de la certification {cert}.",
            ))

    # ── 7. PROJETS LETTRE ABSENTS DU CV ───────────────────────────────────────
    for proj in (profile.get("cover_letter_projects") or []):
        proj_str = str(proj)
        if proj_str and rag_cv and proj_str.lower() not in rag_cv.lower():
            inconsistencies.append(ProfileInconsistency(
                type=ProfileInconsistencyType.ABSENT_EXPERIENCE,
                description=f"Projet « {proj_str} » mentionné en lettre, absent du CV.",
                severity="medium",
                suggested_question=(
                    f"Dans votre lettre de motivation vous mentionnez le projet « {proj_str} », "
                    f"mais il n'apparaît pas dans votre CV. "
                    f"Quelle était précisément votre contribution et pourquoi ne figure-t-il pas dans votre CV ?"
                ),
                rh_note=f"Vérifier l'existence et la nature du projet '{proj_str}'.",
            ))

    # ── 8. DISCORDANCE CV vs GITHUB ────────────────────────────────────────────
    # APRÈS
    missing_repos = [
        repo for repo in (profile.get("github_repos_names") or [])[:5]
        if repo.lower() not in (rag_cv or "").lower()
    ]
    if missing_repos:
        repo = missing_repos[0]  # seulement le premier
        inconsistencies.append(ProfileInconsistency(
            type=ProfileInconsistencyType.CV_GIT_DISCREPANCY,
            description=f"{len(missing_repos)} repo(s) GitHub non mentionné(s) dans le CV (ex: « {repo} »).",
            severity="low",
            suggested_question=(
                f"Votre GitHub contient le projet « {repo} » qui n'est pas référencé dans votre CV. "
                f"De quoi s'agit-il et pour quelle raison ne l'avez-vous pas inclus ?"
            ),
            rh_note=f"Explorer les repos non mentionnés : {', '.join(missing_repos)}.",
        ))

    # ── 9. POSTE ACTUEL MANQUANT ───────────────────────────────────────────────
    if profile.get("experience_years") and not (profile.get("current_position") or "").strip():
        inconsistencies.append(ProfileInconsistency(
            type=ProfileInconsistencyType.CURRENT_POSITION_MISMATCH,
            description=f"{profile['experience_years']} ans d'exp. déclarés mais poste actuel non précisé.",
            severity="low",
            suggested_question=(
                f"Vous déclarez {profile['experience_years']} années d'expérience mais votre poste "
                f"actuel n'est pas renseigné. Exercez-vous actuellement une activité professionnelle ?"
            ),
            rh_note="Vérifier si le candidat est en poste ou en recherche active.",
        ))

    logger.info(
        "[ProfileInconsistencies] %d incohérences détectées.",
        len(inconsistencies),
    )
    return inconsistencies


def format_inconsistencies_for_report(inconsistencies: List[ProfileInconsistency]) -> str:
    """Bloc texte pour le rapport RH — section incohérences de profil."""
    if not inconsistencies:
        return "  ✓ Aucune incohérence de profil détectée."

    lines = []
    for inc in inconsistencies:
        sev_icon = {"high": "🔴", "medium": "🟡", "low": "🔵"}.get(inc.severity, "⚪")
        lines.append(f"  {sev_icon} [{inc.type.value}] {inc.description}")
        if inc.rh_note:
            lines.append(f"     → Note RH : {inc.rh_note}")

    lines.append(
        "\n  ℹ️  Ces incohérences sont à explorer lors de l'entretien humain de suivi."
        "\n      Elles N'ont PAS impacté le score automatique."
    )
    return "\n".join(lines)