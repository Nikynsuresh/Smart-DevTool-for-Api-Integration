import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PORT: int = 8000
    DATABASE_URL: str = "sqlite:///./app.db"
    
    # LLM Settings
    GEMINI_API_KEY: str | None = None
    OPENAI_API_KEY: str | None = None
    
    # Scraping & Vector DB
    CHROMA_PERSIST_DIR: str = "./data/chroma"
    MAX_CRAWL_PAGES: int = 2
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"

settings = Settings()

# Make sure data directories exist
os.makedirs("./data", exist_ok=True)
os.makedirs(settings.CHROMA_PERSIST_DIR, exist_ok=True)
