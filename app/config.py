import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///data/assistant.db")
    UPLOAD_DIR: str = "uploads"
    DATA_DIR: str = "data"
    CHUNK_SIZE: int = 800
    CHUNK_OVERLAP: int = 150

    class Config:
        env_file = ".env"

settings = Settings()

# Ensure target directories exist
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs(settings.DATA_DIR, exist_ok=True)
