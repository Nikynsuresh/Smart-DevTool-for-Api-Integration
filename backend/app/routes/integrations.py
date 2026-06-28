import logging
import asyncio
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Integration
from app.schemas import IntegrationCreate, IntegrationResponse, IntegrationDetailResponse
from app.services.scraper import DocumentationScraper
from app.services.rag import RAGPipeline
from app.services.generator import APIIntegrationGenerator

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/integrations", tags=["Integrations"])

async def run_api_analysis_pipeline(integration_id: int, db_session_factory):
    """Background task running the scraper, RAG indexer, and code wrapper generator asynchronously."""
    # Obtain a fresh DB session for the background execution
    db = db_session_factory()
    integration = await asyncio.to_thread(
        lambda: db.query(Integration).filter(Integration.id == integration_id).first()
    )
    if not integration:
        await asyncio.to_thread(db.close)
        return

    async def update_progress(progress: int, status_msg: str):
        """Helper to write status and progress logs to SQLite asynchronously."""
        def sync_update():
            db.refresh(integration)
            integration.progress = progress
            integration.status = status_msg
            db.commit()
        await asyncio.to_thread(sync_update)
        logger.info(f"Integration {integration_id} progress: {progress}% - {status_msg}")

    try:
        await update_progress(5, "Initializing scraper browser...")
        
        # 1. Scrape Pages asynchronously
        scraper = DocumentationScraper()
        pages = await scraper.crawl(integration.url, progress_callback=update_progress)
        
        if not pages:
            raise ValueError("No pages could be crawled from the provided URL. Ensure the URL is accessible.")

        # 2. RAG Chunking & Storing in a worker thread
        await update_progress(40, "Vectorizing scraped content...")
        try:
            def run_rag():
                rag = RAGPipeline()
                rag.clear_integration_vectors(integration_id)
                
                def rag_callback(pct, msg):
                    integration.progress = pct
                    integration.status = msg
                    db.commit()
                    
                rag.process_and_store(integration_id, pages, progress_callback=rag_callback)
            
            await asyncio.to_thread(run_rag)
        except Exception as rag_err:
            logger.warning(f"RAG Vectorization skipped/failed: {rag_err}. Proceeding with SDK generation.")

        # 3. Code & Asset Generation
        await update_progress(70, "Analyzing API structure and generating assets...")
        generator = APIIntegrationGenerator()
        results = await generator.generate_all(
            integration_id=integration_id,
            url=integration.url,
            use_case=integration.use_case,
            language=integration.language,
            progress_callback=update_progress,
            pages=pages
        )

        # Update integration values in database asynchronously
        def sync_finalize():
            integration.auth_summary = results["auth_summary"]
            integration.endpoints_json = results["endpoints_json"]
            integration.sdk_recommendation = results["sdk_recommendation"]
            integration.integration_steps = results["integration_steps"]
            integration.generated_code = results["generated_code"]
            integration.sample_requests = results["sample_requests"]
            integration.sample_responses = results["sample_responses"]
            
            # Auto-detect subscription from scraped pages
            try:
                from app.services.extractor import detect_authentication
                combined_text = "\n\n".join([p["content"] for p in pages])
                detected_auth = detect_authentication(combined_text)
                if detected_auth.get("requires_subscription"):
                    integration.requires_subscription = True
            except Exception as ex:
                logger.warning(f"Subscription auto-detect failed: {ex}")
            
            integration.progress = 100
            integration.status = "completed"
            db.commit()
            
        await asyncio.to_thread(sync_finalize)
        logger.info(f"Integration {integration_id} completed successfully!")

    except Exception as e:
        logger.exception(f"Error executing pipeline for integration {integration_id}: {e}")
        def sync_fail():
            db.refresh(integration)
            integration.status = "failed"
            integration.progress = 100
            integration.error_message = str(e)
            db.commit()
        await asyncio.to_thread(sync_fail)
    finally:
        await asyncio.to_thread(db.close)

@router.post("", response_model=IntegrationResponse)
async def create_integration(
    payload: IntegrationCreate, 
    background_tasks: BackgroundTasks, 
    db: Session = Depends(get_db)
):
    """Start analyzing an API documentation URL."""
    def sync_create_entry():
        new_int = Integration(
            url=payload.url,
            use_case=payload.use_case,
            language=payload.language,
            requires_subscription=payload.requires_subscription,
            status="pending",
            progress=0
        )
        db.add(new_int)
        db.commit()
        db.refresh(new_int)
        return new_int

    new_integration = await asyncio.to_thread(sync_create_entry)
    
    # Run the scraping/embedding/LLM pipeline in background
    from app.database import SessionLocal
    background_tasks.add_task(run_api_analysis_pipeline, new_integration.id, SessionLocal)
    
    return new_integration

@router.get("", response_model=list[IntegrationResponse])
def list_integrations(db: Session = Depends(get_db)):
    """List all past integrations and analysis statuses."""
    return db.query(Integration).order_by(Integration.created_at.desc()).all()

@router.get("/{id}", response_model=IntegrationDetailResponse)
def get_integration(id: int, db: Session = Depends(get_db)):
    """Retrieve all data matching a specific integration."""
    integration = db.query(Integration).filter(Integration.id == id).first()
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")
    return integration

@router.delete("/{id}")
def delete_integration(id: int, db: Session = Depends(get_db)):
    """Delete an integration, cleaning up both database entries and RAG vectors."""
    integration = db.query(Integration).filter(Integration.id == id).first()
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")
        
    # Clear vectors in Chroma DB
    try:
        rag = RAGPipeline()
        rag.clear_integration_vectors(id)
    except Exception as e:
        logger.error(f"Error deleting Chroma vectors for integration {id}: {e}")
        
    db.delete(integration)
    db.commit()
    return {"status": "success", "message": f"Integration {id} deleted successfully."}
