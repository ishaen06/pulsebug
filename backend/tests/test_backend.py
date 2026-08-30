import pytest
from urllib.parse import urlparse, parse_qs
from httpx import AsyncClient, ASGITransport
from backend.app.main import app

@pytest.mark.anyio
async def test_health_check():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"

@pytest.mark.anyio
async def test_auth_login_and_me():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login_resp = await client.post("/api/v1/auth/login", json={
            "email": "rahul@pulsebug.io",
            "password": "password123"
        })
        assert login_resp.status_code == 200
        token_data = login_resp.json()
        assert "access_token" in token_data
        token = token_data["access_token"]
        
        me_resp = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert me_resp.status_code == 200
        assert me_resp.json()["email"] == "rahul@pulsebug.io"
        assert me_resp.json()["role"] == "DEVELOPER"

@pytest.mark.anyio
async def test_password_reset_flow():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Request password reset
        forgot_resp = await client.post("/api/v1/auth/forgot-password", json={
            "email": "rahul@pulsebug.io"
        })
        assert forgot_resp.status_code == 200
        data = forgot_resp.json()
        assert "If an account exists for this email" in data["message"]
        assert "simulated_reset_link" in data
        assert data["simulated_reset_link"] is not None

        # Extract token from simulated link
        parsed_url = urlparse(data["simulated_reset_link"])
        token = parse_qs(parsed_url.query)["token"][0]
        assert len(token) > 20

        # 2. Verify token validity
        verify_resp = await client.post("/api/v1/auth/verify-reset-token", json={
            "token": token
        })
        assert verify_resp.status_code == 200
        v_data = verify_resp.json()
        assert v_data["valid"] is True
        assert v_data["status"] == "VALID"
        assert v_data["email"] == "rahul@pulsebug.io"

        # 3. Perform Password Reset
        reset_resp = await client.post("/api/v1/auth/reset-password", json={
            "token": token,
            "new_password": "NewSecurePassword123!"
        })
        assert reset_resp.status_code == 200
        r_data = reset_resp.json()
        assert r_data["success"] is True
        assert "Password updated successfully" in r_data["message"]

        # 4. Token must now be invalid/used (single-use enforcement)
        verify_after_resp = await client.post("/api/v1/auth/verify-reset-token", json={
            "token": token
        })
        assert verify_after_resp.status_code == 200
        assert verify_after_resp.json()["valid"] is False
        assert verify_after_resp.json()["status"] == "USED"

        # 5. Login with new password
        login_resp = await client.post("/api/v1/auth/login", json={
            "email": "rahul@pulsebug.io",
            "password": "NewSecurePassword123!"
        })
        assert login_resp.status_code == 200
        assert "access_token" in login_resp.json()

        # 6. Reset password back for other tests
        reset_back_resp = await client.post("/api/v1/auth/forgot-password", json={
            "email": "rahul@pulsebug.io"
        })
        link_back = reset_back_resp.json()["simulated_reset_link"]
        token_back = parse_qs(urlparse(link_back).query)["token"][0]
        await client.post("/api/v1/auth/reset-password", json={
            "token": token_back,
            "new_password": "password123"
        })

@pytest.mark.anyio
async def test_list_projects_and_bugs():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        proj_resp = await client.get("/api/v1/projects")
        assert proj_resp.status_code == 200
        projects = proj_resp.json()
        assert len(projects) >= 4
        
        bugs_resp = await client.get("/api/v1/bugs")
        assert bugs_resp.status_code == 200
        bugs = bugs_resp.json()
        assert len(bugs) >= 50

@pytest.mark.anyio
async def test_ai_triage_engine():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        triage_resp = await client.post("/api/v1/ai/triage", json={
            "title": "Users are randomly logged out after refreshing the dashboard",
            "description": "When refreshing /dashboard/billing, session JWT is wiped."
        })
        assert triage_resp.status_code == 200
        data = triage_resp.json()
        assert data["category"] == "Authentication"
        assert "Session" in data["component"]
        assert data["priority"] in ["P1", "P2"]
        assert data["confidence_score"] >= 0.85

@pytest.mark.anyio
async def test_ai_duplicate_detection():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        dup_resp = await client.post("/api/v1/ai/duplicate-check", json={
            "title": "Session terminates when reloading dashboard view",
            "description": "Users get logged out suddenly when hitting refresh."
        })
        assert dup_resp.status_code == 200
        data = dup_resp.json()
        assert len(data["duplicates"]) > 0
        assert data["highest_similarity"] >= 60

@pytest.mark.anyio
async def test_ai_quality_analyzer():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        quality_resp = await client.post("/api/v1/ai/quality-score", json={
            "title": "Bad bug",
            "description": "Doesn't work"
        })
        assert quality_resp.status_code == 200
        data = quality_resp.json()
        assert data["score"] < 50
        assert len(data["missing_elements"]) > 0
        assert len(data["improvement_suggestions"]) > 0

@pytest.mark.anyio
async def test_ai_reproduction_step_generator():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        steps_resp = await client.post("/api/v1/ai/reproduction-steps", json={
            "messy_description": "I opened the site and login worked but when I refreshed the dashboard it logged me out."
        })
        assert steps_resp.status_code == 200
        data = steps_resp.json()
        assert len(data["structured_steps"]) >= 3
        assert len(data["expected_behavior"]) > 10
        assert len(data["actual_behavior"]) > 10

@pytest.mark.anyio
async def test_git_pr_simulation_and_workflow():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        bugs_resp = await client.get("/api/v1/bugs?limit=1")
        bug = bugs_resp.json()[0]
        bug_id = bug["id"]
        
        git_resp = await client.post(f"/api/v1/git/simulate/{bug_id}", json={
            "event_type": "pr_merged",
            "pr_number": 999,
            "pr_title": "Fix critical bug in payment module"
        })
        assert git_resp.status_code == 200
        data = git_resp.json()
        assert data["success"] is True
        assert data["new_status"] == "TESTING"

@pytest.mark.anyio
async def test_project_health_analytics():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        proj_resp = await client.get("/api/v1/projects")
        proj_id = proj_resp.json()[0]["id"]
        
        health_resp = await client.get(f"/api/v1/analytics/project/{proj_id}/health")
        assert health_resp.status_code == 200
        health = health_resp.json()
        assert 0 <= health["overall_health_score"] <= 100
        assert len(health["health_factors"]) > 0

@pytest.mark.anyio
async def test_threaded_comments_flow():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login_res = await client.post("/api/v1/auth/login", json={"email": "rahul@pulsebug.io", "password": "password123"})
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Post root comment
        post_resp = await client.post("/api/v1/bugs/1/comments", json={"content": "Root discussion note on bug"}, headers=headers)
        assert post_resp.status_code == 200
        root_comment = post_resp.json()
        assert root_comment["content"] == "Root discussion note on bug"
        assert root_comment["author"]["email"] == "rahul@pulsebug.io"
        
        # Post reply
        reply_resp = await client.post("/api/v1/bugs/1/comments", json={"content": "Nested reply in thread", "parent_id": root_comment["id"]}, headers=headers)
        assert reply_resp.status_code == 200
        reply = reply_resp.json()
        assert reply["parent_id"] == root_comment["id"]
        
        # Get comments
        get_resp = await client.get("/api/v1/bugs/1/comments", headers=headers)
        assert get_resp.status_code == 200
        comments = get_resp.json()
        assert len(comments) > 0
        matched = next((c for c in comments if c["id"] == root_comment["id"]), None)
        assert matched is not None
        assert len(matched["replies"]) >= 1

