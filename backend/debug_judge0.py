#!/usr/bin/env python3
"""
debug_judge0.py — Diagnostique le 500 sur /submissions
Lance : python debug_judge0.py
"""
import requests
import json

JUDGE0_URL = "http://localhost:2358"

print("=" * 55)
print("  DIAGNOSTIC JUDGE0 — Erreur 500 submissions")
print("=" * 55)

# ── 1. Voir le body exact du 500 ──────────────────────────
print("\n📋 Détail de l'erreur 500 :")
try:
    r = requests.post(
        f"{JUDGE0_URL}/submissions",
        headers={"Content-Type": "application/json"},
        json={
            "source_code": 'print("test")',
            "language_id": 71,
            "stdin": "",
        },
        timeout=10
    )
    print(f"   HTTP Status : {r.status_code}")
    print(f"   Body complet : {r.text[:500]}")
except Exception as e:
    print(f"   Exception : {e}")

# ── 2. Tester sans base64 ─────────────────────────────────
print("\n📋 Test avec base64_encoded=false en paramètre :")
try:
    r2 = requests.post(
        f"{JUDGE0_URL}/submissions?base64_encoded=false&wait=false",
        headers={"Content-Type": "application/json"},
        json={
            "source_code": 'print("test")',
            "language_id": 71,
        },
        timeout=10
    )
    print(f"   HTTP Status : {r2.status_code}")
    print(f"   Body : {r2.text[:300]}")
except Exception as e:
    print(f"   Exception : {e}")

# ── 3. Tester avec base64 encodé (mode par défaut Judge0) ─
import base64
print("\n📋 Test avec source_code en base64 :")
try:
    code_b64 = base64.b64encode(b'print("hello")').decode()
    r3 = requests.post(
        f"{JUDGE0_URL}/submissions?base64_encoded=true",
        headers={"Content-Type": "application/json"},
        json={
            "source_code": code_b64,
            "language_id": 71,
            "stdin": "",
        },
        timeout=10
    )
    print(f"   HTTP Status : {r3.status_code}")
    print(f"   Body : {r3.text[:300]}")
except Exception as e:
    print(f"   Exception : {e}")

# ── 4. Config Judge0 ──────────────────────────────────────
print("\n📋 Config Judge0 (/config_info) :")
try:
    r4 = requests.get(f"{JUDGE0_URL}/config_info", timeout=5)
    print(f"   HTTP : {r4.status_code}")
    if r4.status_code == 200:
        print(f"   {r4.text[:400]}")
except Exception as e:
    print(f"   {e}")

# ── 5. Stats workers ──────────────────────────────────────
print("\n📋 Workers (/workers) :")
try:
    r5 = requests.get(f"{JUDGE0_URL}/workers", timeout=5)
    print(f"   HTTP : {r5.status_code}")
    print(f"   {r5.text[:400]}")
except Exception as e:
    print(f"   {e}")

print("\n" + "=" * 55)
print("  Copie tout ce output et partage-le")
print("=" * 55)