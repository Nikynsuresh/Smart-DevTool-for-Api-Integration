import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response, StreamingResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Integration
from app.services.exporter import ExporterService

router = APIRouter(prefix="/integrations", tags=["Exports"])

@router.get("/{id}/export/code")
def export_code(id: int, db: Session = Depends(get_db)):
    """Export and download the generated wrapper code file."""
    integration = db.query(Integration).filter(Integration.id == id).first()
    if not integration or not integration.generated_code:
        raise HTTPException(status_code=404, detail="Code not generated or integration not found")
        
    lang = integration.language.lower()
    
    # Determine correct file extension and filename
    if "python" in lang:
        filename = "api_client.py"
        media_type = "text/x-python"
    elif "typescript" in lang or "ts" in lang:
        filename = "apiClient.ts"
        media_type = "text/typescript"
    elif "javascript" in lang or "js" in lang:
        filename = "apiClient.js"
        media_type = "text/javascript"
    elif "go" in lang:
        filename = "apiclient.go"
        media_type = "text/x-go"
    elif "java" in lang:
        filename = "ApiClient.java"
        media_type = "text/x-java-source"
    else:
        filename = "api_client.txt"
        media_type = "text/plain"

    return Response(
        content=integration.generated_code,
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/{id}/export/postman")
def export_postman(id: int, db: Session = Depends(get_db)):
    """Export and download Postman Collection JSON."""
    integration = db.query(Integration).filter(Integration.id == id).first()
    if not integration or not integration.endpoints_json:
        raise HTTPException(status_code=404, detail="Endpoints not extracted or integration not found")
        
    try:
        endpoints = json.loads(integration.endpoints_json)
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to parse saved endpoint details")
        
    auth_summary = integration.auth_summary or ""
    
    # Parse base URL from original url
    from urllib.parse import urlparse
    parsed = urlparse(integration.url)
    base_url = f"{parsed.scheme}://{parsed.netloc}"
    
    collection = ExporterService.generate_postman_collection(
        integration_name=f"{parsed.netloc} API",
        base_url=base_url,
        endpoints=endpoints,
        auth_summary=auth_summary
    )
    
    collection_str = json.dumps(collection, indent=2)
    
    return Response(
        content=collection_str,
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename=postman_collection_{id}.json"}
    )

@router.get("/{id}/export/pdf")
def export_pdf(id: int, db: Session = Depends(get_db)):
    """Export and download a formatted PDF API report."""
    integration = db.query(Integration).filter(Integration.id == id).first()
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")
        
    if not integration.endpoints_json or not integration.generated_code:
        raise HTTPException(status_code=400, detail="Integration analysis is incomplete")
        
    try:
        endpoints = json.loads(integration.endpoints_json)
    except Exception:
        endpoints = []
        
    # Generate PDF bytes
    pdf_bytes = ExporterService.generate_openapi_pdf(
        url=integration.url,
        use_case=integration.use_case,
        auth_summary=integration.auth_summary or "",
        endpoints=endpoints,
        generated_code=integration.generated_code
    )
    
    # Return as download stream
    import io
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=api_report_{id}.pdf"}
    )
