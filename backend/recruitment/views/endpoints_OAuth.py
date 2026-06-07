
import requests
import secrets
import json
from django.conf import settings
from django.shortcuts import redirect
from rest_framework.decorators import api_view
from rest_framework.response import Response
from urllib.parse import urlencode
# ─── LinkedIn OAuth ────────────────────────────────────────────

@api_view(['GET'])
def linkedin_login(request):

    state = secrets.token_urlsafe(16)
    request.session['oauth_state'] = state
    params = {
        'response_type': 'code',
        'client_id': settings.SOCIAL_AUTH_LINKEDIN_OAUTH2_KEY,
        'redirect_uri': 'http://localhost:8888/api/recruitment/auth/linkedin/callback/',
        'scope': 'openid profile email',
        # ✅ maintenant autorisé
    }
    url = 'https://www.linkedin.com/oauth/v2/authorization?' + urlencode(params)
    return redirect(url)


# ─── GitHub OAuth ──────────────────────────────────────────────

@api_view(['GET'])
def github_login(request):
    job_id = request.GET.get('job_id')
    if job_id:
        request.session['pending_job_id'] = job_id
        request.session.modified = True # Important bech t-sauvi fel session

    state = secrets.token_urlsafe(16)
    request.session['oauth_state'] = state
    params = {
        'client_id': settings.SOCIAL_AUTH_GITHUB_KEY,
        'redirect_uri': 'http://localhost:8888/api/recruitment/auth/github/callback/',        'scope': 'read:user user:email',
        'state': state,
    }
    url = 'https://github.com/login/oauth/authorize?' + urlencode(params)
    return redirect(url)


@api_view(['GET'])
def github_callback(request):
    code = request.GET.get('code')
    if not code:
        return Response({'error': 'Code manquant'}, status=400)

    # 1. Exchange code for token
    token_res = requests.post(
        'https://github.com/login/oauth/access_token',
        headers={'Accept': 'application/json'},
        data={
            'client_id': settings.SOCIAL_AUTH_GITHUB_KEY,
            'client_secret': settings.SOCIAL_AUTH_GITHUB_SECRET,
            'code': code,
            'redirect_uri': 'http://localhost:8888/api/recruitment/auth/github/callback/',
        }
    )
    access_token = token_res.json().get('access_token')
    if not access_token:
        return Response({'error': 'Token invalide'}, status=400)

    # 2. Get User Profile
    profile_res = requests.get(
        'https://api.github.com/user',
        headers={'Authorization': f'Bearer {access_token}'}
    )
    profile = profile_res.json()
    username = profile.get('login', '')

    # 3. Fetch enriched data
    github_data = {
        'id': profile.get('id'),
        'username': username,
        'url': profile.get('html_url'),
        'name': profile.get('name'),
        'company': profile.get('company'),
        'blog': profile.get('blog'),
        'location': profile.get('location'),
        'bio': profile.get('bio'),
        'twitter_username': profile.get('twitter_username'),
        'followers': profile.get('followers'),
        'following': profile.get('following'),
        'public_repos': profile.get('public_repos'),
        'public_gists': profile.get('public_gists'),
        'hireable': profile.get('hireable'),
        'created_at': profile.get('created_at'),
    }

    # 4. Fetch repositories (top 30 sorted by stars)
    repos_res = requests.get(
        f'https://api.github.com/users/{username}/repos',
        headers={'Authorization': f'Bearer {access_token}'},
        params={'sort': 'stars', 'per_page': 30}
    )
    if repos_res.status_code == 200:
        repos = repos_res.json()
        github_data['repositories'] = []
        languages_set = set()

        for repo in repos:
            repo_data = {
                'name': repo.get('name'),
                'full_name': repo.get('full_name'),
                'description': repo.get('description'),
                'url': repo.get('html_url'),
                'stars': repo.get('stargazers_count'),
                'forks': repo.get('forks_count'),
                'language': repo.get('language'),
                'topics': repo.get('topics', []),
                'created_at': repo.get('created_at'),
                'pushed_at': repo.get('pushed_at'),
                'homepage': repo.get('homepage'),
                'license': repo.get('license', {}).get('name') if repo.get('license') else None,
            }
            github_data['repositories'].append(repo_data)

            # Collect languages
            if repo.get('language'):
                languages_set.add(repo['language'])

        github_data['languages'] = list(languages_set)
        github_data['total_stars'] = sum(r['stars'] for r in github_data['repositories'])

    # 5. Fetch contributions (last year)
    events_res = requests.get(
        f'https://api.github.com/users/{username}/events',
        headers={'Authorization': f'Bearer {access_token}'},
        params={'per_page': 100}
    )
    if events_res.status_code == 200:
        events = events_res.json()
        contributions = {
            'commits': 0,
            'pr_opened': 0,
            'pr_merged': 0,
            'issues_opened': 0,
            'repos_starred': 0,
        }
        for event in events:
            event_type = event.get('type')
            if event_type == 'PushEvent':
                contributions['commits'] += event.get('payload', {}).get('commits', []) and len(
                    event['payload']['commits']) or 0
            elif event_type == 'PullRequestEvent':
                if event.get('payload', {}).get('action') == 'opened':
                    contributions['pr_opened'] += 1
                elif event.get('payload', {}).get('action') == 'closed' and event.get('payload', {}).get('merged'):
                    contributions['pr_merged'] += 1
            elif event_type == 'IssuesEvent':
                if event.get('payload', {}).get('action') == 'opened':
                    contributions['issues_opened'] += 1

        github_data['recent_contributions'] = contributions

    # 6. Fetch starred repos count
    starred_res = requests.get(
        f'https://api.github.com/users/{username}/starred',
        headers={'Authorization': f'Bearer {access_token}'},
        params={'per_page': 1}
    )
    if starred_res.status_code == 200:
        github_data['starred_repos'] = int(
            starred_res.headers.get('Link', '').split('page=')[-1].split('>')[0].split(';')[
                0]) if 'rel="last"' in starred_res.headers.get('Link', '') else 0

    # 7. Get email if not public
    email = profile.get('email', '')
    if not email:
        emails_res = requests.get(
            'https://api.github.com/user/emails',
            headers={'Authorization': f'Bearer {access_token}'}
        )
        if emails_res.status_code == 200:
            primary = next((e for e in emails_res.json() if e.get('primary')), {})
            email = primary.get('email', '')

    job_id = request.session.get('pending_job_id', '')

    # 8. Redirect avec toutes les données enrichies
    params = urlencode({
        'github_id': profile.get('id', ''),
        'github_username': username,
        'github_url': profile.get('html_url', ''),
        'github_data': json.dumps(github_data),  # ← DONNÉES ENRICHIES

        'github_verified': 'true',
    })
    return redirect(f'http://localhost:3000/apply/{job_id}?{params}')


@api_view(['GET'])
def linkedin_callback(request):
    code = request.GET.get('code')
    # ✅ Jib el Job ID mel session
    job_id = request.session.get('pending_job_id', '')

    if not code:
        return Response({'error': 'Code manquant'}, status=400)

    # 1. Exchange code for token
    token_res = requests.post(
        'https://www.linkedin.com/oauth/v2/accessToken',
        data={
            'grant_type': 'authorization_code',
            'code': code,
            'redirect_uri': 'http://localhost:8888/api/recruitment/auth/linkedin/callback/',
            'client_id': settings.SOCIAL_AUTH_LINKEDIN_OAUTH2_KEY,
            'client_secret': settings.SOCIAL_AUTH_LINKEDIN_OAUTH2_SECRET,
        }
    )
    access_token = token_res.json().get('access_token')

    # 2. Get User Profile (Using OpenID Connect endpoint - Recommended)
    profile_res = requests.get(
        'https://api.linkedin.com/v2/userinfo',
        headers={'Authorization': f'Bearer {access_token}'}
    )
    profile = profile_res.json()


    linkedin_id = profile.get('sub', '')

    linkedin_url = f"https://www.linkedin.com/nm/{linkedin_id}"

    params = urlencode({
        'linkedin_verified': 'true',
        'linkedin_url': linkedin_url,
    })

    return redirect(f'http://localhost:3000/apply/{job_id}?{params}')