"""
groq_client.py
==============
Clients HTTP Groq partagés — JSON et TEXT.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Dict

import requests

logger = logging.getLogger(__name__)

GROQ_API_URL: str = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL: str   = "llama-3.3-70b-versatile"

_SYS_JSON = (
    "Tu es un recruteur expert RH avec 20 ans d'expérience. "
    "Tu conduis des entretiens professionnels rigoureux en français. "
    "Tu réponds UNIQUEMENT en JSON valide, sans texte autour, sans balises markdown."
)

_SYS_TEXT = (
    "Tu es un recruteur expert RH. "
    "Tes questions sont précises, directes, ancrées dans le profil réel du candidat. "
    "Tu ne poses JAMAIS de question générique. "
    "Chaque question DOIT mentionner un élément concret du profil "
    "(nom de projet exact, technologie précise, expérience datée, ville, université, certification). "
    "Réponds UNIQUEMENT avec la question — sans introduction, sans ponctuation inutile."
)


def _call_groq_json(
    prompt: str,
    max_tokens: int = 1500,
    temperature: float = 0.3,
) -> Dict[str, Any]:
    try:
        resp = requests.post(
            GROQ_API_URL,
            headers={
                "Authorization": f"Bearer {os.getenv('GROQ_API_KEY')}",
                "Content-Type":  "application/json",
            },
            json={
                "model":   GROQ_MODEL,
                "messages": [
                    {"role": "system", "content": _SYS_JSON},
                    {"role": "user",   "content": prompt},
                ],
                "temperature":     temperature,
                "max_tokens":      max_tokens,
                "response_format": {"type": "json_object"},
            },
            timeout=45,
        )
        resp.raise_for_status()
        return json.loads(resp.json()["choices"][0]["message"]["content"])
    except Exception as exc:
        logger.error("[Groq-JSON] %s", exc)
        return {}


def _call_groq_text(prompt: str, max_tokens: int = 300) -> str:
    try:
        resp = requests.post(
            GROQ_API_URL,
            headers={
                "Authorization": f"Bearer {os.getenv('GROQ_API_KEY')}",
                "Content-Type":  "application/json",
            },
            json={
                "model":   GROQ_MODEL,
                "messages": [
                    {"role": "system", "content": _SYS_TEXT},
                    {"role": "user",   "content": prompt},
                ],
                "temperature": 0.5,
                "max_tokens":  max_tokens,
            },
            timeout=30,
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"].strip()
    except Exception as exc:
        logger.error("[Groq-TEXT] %s", exc)
        return ""