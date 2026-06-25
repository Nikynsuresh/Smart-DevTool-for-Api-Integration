from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_read_root():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "online"

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}

def test_get_nonexistent_integration():
    response = client.get("/integrations/99999")
    assert response.status_code == 404
    assert response.json()["detail"] == "Integration not found"

def test_invalid_create_integration():
    # Send empty payload to check verification error
    response = client.post("/integrations", json={})
    assert response.status_code == 422

def test_chat_nonexistent_integration():
    response = client.post("/integrations/99999/chat", json={"message": "hello"})
    assert response.status_code == 404

def test_export_nonexistent_integration():
    response = client.get("/integrations/99999/export/code")
    assert response.status_code == 404
