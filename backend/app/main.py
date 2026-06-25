import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.routes import integrations, chat, exports, api
from app.config import settings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger(__name__)

# Initialize database tables
logger.info("Initializing database tables...")
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Smart DevTool for API Integration Backend",
    description="FastAPI Backend for scraping docs, managing ChromaDB RAG pipelines, and generating API wrappers",
    version="1.0.0"
)

# CORS configurations
# Allow Next.js frontend (standard localhost:3000) and other dev servers
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(integrations.router)
app.include_router(chat.router)
app.include_router(exports.router)
app.include_router(api.router)

@app.get("/")
def read_root():
    return {
        "status": "online",
        "message": "Smart DevTool API Integration Backend is running.",
        "endpoints": {
            "docs": "/docs",
            "health": "/health"
        }
    }

@app.get("/health")
def health_check():
    return {"status": "healthy"}
