from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch
from app.main import app

client = TestClient(app)

def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}

@patch("app.routes.api.DocumentationScraper.crawl", new_callable=AsyncMock)
@patch("app.routes.api.APIIntegrationGenerator.generate_all", new_callable=AsyncMock)
@patch("app.routes.api.detect_authentication")
@patch("app.routes.api.RAGPipeline.clear_integration_vectors")
@patch("app.routes.api.RAGPipeline.process_and_store")
def test_analyze(mock_process_store, mock_clear_vectors, mock_detect_auth, mock_generate_all, mock_crawl):
    # Setup mocks
    mock_crawl.return_value = [
        {
            "url": "https://testdocs.com/api", 
            "title": "Test Docs", 
            "content": "POST /v1/charges\nGET /v1/charges/{id}\nAPI Key required: X-API-Key"
        }
    ]
    
    mock_detect_auth.return_value = {
        "auth_method": "API Key",
        "all_detected_methods": ["API Key"],
        "details": {},
        "json_summary": '{"primary": "API Key"}'
    }
    
    mock_generate_all.return_value = {
        "auth_summary": "Test Auth Summary",
        "endpoints_json": '[{"path": "/v1/charges", "method": "POST", "description": "Create charge"}]',
        "sdk_recommendation": "Use REST API wrapper.",
        "integration_steps": "1. Import client",
        "generated_code": "class Client:\n    pass",
        "sample_requests": "client.create_charge()",
        "sample_responses": "{'status': 'success'}"
    }
    
    # Call endpoint
    response = client.post("/analyze", json={
        "url": "https://testdocs.com/api",
        "use_case": "create charges",
        "language": "python"
    })
    
    assert response.status_code == 200
    data = response.json()
    assert data["auth_method"] == "API Key"
    assert len(data["relevant_endpoints"]) == 1
    assert data["relevant_endpoints"][0]["path"] == "/v1/charges"
    assert "class Client" in data["wrapper_class"]

@patch("app.routes.api.APIIntegrationGenerator._generate_wrapper_and_docs", new_callable=AsyncMock)
def test_generate_sdk(mock_generate_wrapper):
    mock_generate_wrapper.return_value = {
        "generated_code": "class NewLanguageClient:\n    pass",
        "integration_steps": "Install package",
        "sample_requests": "client.call()",
        "sample_responses": "response"
    }
    
    # Test on-the-fly generation
    response = client.post("/generate-sdk", json={
        "url": "https://testdocs.com/api",
        "use_case": "create charges",
        "language": "typescript",
        "auth_method": "Bearer Token",
        "endpoints": [{"path": "/v1/charges", "method": "POST", "description": "create charge"}]
    })
    
    assert response.status_code == 200
    data = response.json()
    assert data["language"] == "typescript"
    assert "class NewLanguageClient" in data["wrapper_class"]

def test_export_code_zip():
    from app.database import SessionLocal
    from app.models import Integration
    import io
    import zipfile
    
    db = SessionLocal()
    dummy = Integration(
        url="https://example.com/api-docs",
        use_case="test usecase",
        language="Python",
        generated_code="class DummyClient:\n    def __init__(self):\n        pass",
        integration_steps="1. Run dummy",
        sample_requests="```python\nprint('requests')\n```",
        sample_responses="```json\n{}\n```",
        status="completed"
    )
    db.add(dummy)
    db.commit()
    db.refresh(dummy)
    
    try:
        response = client.get(f"/integrations/{dummy.id}/export/code")
        assert response.status_code == 200
        assert response.headers["content-disposition"] == f"attachment; filename=sdk_client_{dummy.id}.zip"
        assert response.headers["content-type"] == "application/zip"
        
        # Verify the ZIP contents
        zip_file = zipfile.ZipFile(io.BytesIO(response.content))
        file_list = zip_file.namelist()
        assert "api_client.py" in file_list
        assert "example.py" in file_list
        assert "README.md" in file_list
        
        # Verify contents of files inside ZIP
        readme = zip_file.read("README.md").decode("utf-8")
        assert "example.py" in readme
        assert "api_client.py" in readme
        assert "1. Run dummy" in readme
        
        example = zip_file.read("example.py").decode("utf-8")
        assert "print('requests')" in example
        
    finally:
        # Clean up database
        db.delete(dummy)
        db.commit()
        db.close()

