import logging
import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from urllib.parse import urlparse

from app.database import get_db
from app.models import Integration
from app.services.scraper import DocumentationScraper
from app.services.rag import RAGPipeline
from app.services.generator import APIIntegrationGenerator
from app.services.extractor import extract_endpoints_with_regex, detect_authentication

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Developer Tool Endpoints"])

# Schemas
class AnalyzeRequest(BaseModel):
    url: str
    use_case: str
    language: str
    requires_subscription: Optional[bool] = False

class AnalyzeResponse(BaseModel):
    auth_method: str
    relevant_endpoints: List[Dict[str, Any]]
    sdk_recommendation: str
    wrapper_class: str
    ready_to_use_code: str
    requires_subscription: bool

class GenerateSDKRequest(BaseModel):
    integration_id: Optional[int] = None
    url: Optional[str] = None
    use_case: Optional[str] = None
    language: str
    auth_method: Optional[str] = None
    endpoints: Optional[List[Dict[str, Any]]] = None

class GenerateSDKResponse(BaseModel):
    language: str
    wrapper_class: str
    ready_to_use_code: str

@router.get("/health")
def health_check():
    """Simple API health check endpoint."""
    return {"status": "healthy"}

@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_api(payload: AnalyzeRequest, db: Session = Depends(get_db)):
    """
    Step 9: Backend Endpoint
    Accepts: API doc URL, use case, preferred programming language.
    Workflow:
      1. Downloads page using requests and BeautifulSoup.
      2. Extracts API endpoints and authentication patterns using regex/heuristics.
      3. Vectorizes content to ChromaDB.
      4. Generates code SDK wrapper, recommendations, and integration samples.
      5. Saves the integration run to DB.
      6. Returns the structured analysis response.
    """
    logger.info(f"Received /analyze request for URL: {payload.url}")
    
    # 1. Documentation Fetching & Parsing
    scraper = DocumentationScraper()
    try:
        pages = await scraper.crawl(payload.url)
    except Exception as e:
        logger.error(f"Scraper crawling failed: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to crawl the documentation URL: {str(e)}")
        
    if not pages:
        raise HTTPException(status_code=400, detail="No documentation content could be scraped from the provided URL.")
        
    # Create DB entry for tracking in the Dashboard UI
    new_integration = Integration(
        url=payload.url,
        use_case=payload.use_case,
        language=payload.language,
        requires_subscription=payload.requires_subscription,
        status="scraping",
        progress=20
    )
    db.add(new_integration)
    db.commit()
    db.refresh(new_integration)
    
    try:
        # 2. Extract Candidate Endpoints & Auth via Python Regex
        combined_text = "\n\n".join([p["content"] for p in pages])
        detected_auth = detect_authentication(combined_text)
        
        # Check if subscription required was detected from crawled pages
        is_sub_required = payload.requires_subscription or detected_auth.get("requires_subscription", False)
        if is_sub_required:
            new_integration.requires_subscription = True
            db.commit()
            
        # 3. Vectorize and index pages in ChromaDB
        db.refresh(new_integration)
        new_integration.status = "vectorizing"
        new_integration.progress = 50
        db.commit()
        
        try:
            rag = RAGPipeline()
            rag.clear_integration_vectors(new_integration.id)
            rag.process_and_store(new_integration.id, pages)
        except Exception as rag_err:
            logger.warning(f"RAG Vectorization skipped/failed: {rag_err}. Proceeding with SDK generation.")
        
        # 4. Run generator with candidate context
        db.refresh(new_integration)
        new_integration.status = "generating"
        new_integration.progress = 80
        db.commit()
        
        generator = APIIntegrationGenerator()
        results = await generator.generate_all(
            integration_id=new_integration.id,
            url=payload.url,
            use_case=payload.use_case,
            language=payload.language,
            pages=pages
        )
        
        # Update SQLite DB model
        db.refresh(new_integration)
        new_integration.auth_summary = results["auth_summary"]
        new_integration.endpoints_json = results["endpoints_json"]
        new_integration.sdk_recommendation = results["sdk_recommendation"]
        new_integration.integration_steps = results["integration_steps"]
        new_integration.generated_code = results["generated_code"]
        new_integration.sample_requests = results["sample_requests"]
        new_integration.sample_responses = results["sample_responses"]
        new_integration.progress = 100
        new_integration.status = "completed"
        db.commit()
        
        # Format outputs for Response model
        endpoints_list = json.loads(results["endpoints_json"]) if results["endpoints_json"] else []
        
        # Ready to use code is a combination of sample requests and instructions
        ready_to_use = f"{results['integration_steps']}\n\n{results['sample_requests']}"
        
        return AnalyzeResponse(
            auth_method=detected_auth["auth_method"],
            relevant_endpoints=endpoints_list,
            sdk_recommendation=results["sdk_recommendation"],
            wrapper_class=results["generated_code"],
            ready_to_use_code=ready_to_use,
            requires_subscription=new_integration.requires_subscription or False
        )
        
    except Exception as e:
        logger.exception(f"Error during API analysis pipeline: {e}")
        db.refresh(new_integration)
        new_integration.status = "failed"
        new_integration.progress = 100
        new_integration.error_message = str(e)
        db.commit()
        raise HTTPException(status_code=500, detail=f"API Analysis pipeline failed: {str(e)}")

@router.post("/generate-sdk", response_model=GenerateSDKResponse)
async def generate_sdk(payload: GenerateSDKRequest, db: Session = Depends(get_db)):
    """
    Step 9: Backend Endpoint
    Accepts: Either integration_id to load details, or raw endpoint/auth list directly.
    Returns: Wrapper class and ready-to-use code in preferred target language.
    """
    generator = APIIntegrationGenerator()
    
    # Path A: Load from SQLite DB
    if payload.integration_id is not None:
        integration = db.query(Integration).filter(Integration.id == payload.integration_id).first()
        if not integration:
            raise HTTPException(status_code=404, detail=f"Integration ID {payload.integration_id} not found.")
            
        try:
            endpoints = json.loads(integration.endpoints_json) if integration.endpoints_json else []
        except Exception:
            endpoints = []
            
        auth_summary = integration.auth_summary or "Authentication credentials configuration required."
        use_case = integration.use_case
        url = integration.url
        
    # Path B: On-the-fly generation from payload arguments
    else:
        if not payload.url or not payload.use_case:
            raise HTTPException(
                status_code=400, 
                detail="Must provide either integration_id, or base url and use_case."
            )
        endpoints = payload.endpoints or []
        auth_summary = payload.auth_method or "API Key auth required."
        use_case = payload.use_case
        url = payload.url

    # Ask the LLM to generate the code wrapper based on structured schemas
    try:
        code_and_docs = await generator._generate_wrapper_and_docs(
            integration_id=payload.integration_id or 0,
            url=url,
            use_case=use_case,
            language=payload.language,
            auth_info=auth_summary,
            endpoints=endpoints
        )
        
        # If loaded from DB, we can optionally save this new language client back to DB
        # if language matches, or just return it.
        ready_to_use = f"{code_and_docs['integration_steps']}\n\n{code_and_docs['sample_requests']}"
        
        return GenerateSDKResponse(
            language=payload.language,
            wrapper_class=code_and_docs["generated_code"],
            ready_to_use_code=ready_to_use
        )
    except Exception as e:
        logger.exception(f"Error generating wrapper SDK: {e}")
        raise HTTPException(status_code=500, detail=f"SDK Wrapper generation failed: {str(e)}")
