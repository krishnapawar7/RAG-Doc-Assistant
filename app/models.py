from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class UploadedFileSchema(BaseModel):
    id: str
    name: str
    size: int
    type: str = "application/pdf"
    pageCount: int = 0
    chunkCount: Optional[int] = None
    uploadedAt: str
    status: str  # 'processing' | 'ready' | 'error'
    error: Optional[str] = None

class ChunkMetadata(BaseModel):
    id: str
    documentId: str
    documentName: str
    text: str
    pageIndex: int
    chunkIndex: int

class SearchResultSchema(BaseModel):
    chunk: ChunkMetadata
    similarity: float

class ChatMessageSchema(BaseModel):
    id: str
    role: str  # 'user' | 'assistant'
    content: str
    timestamp: str
    sources: Optional[List[SearchResultSchema]] = None

class ChatSessionSchema(BaseModel):
    id: str
    title: str
    messages: List[ChatMessageSchema] = []
    documentIds: List[str] = []
    createdAt: str

class SessionCreateSchema(BaseModel):
    title: Optional[str] = None
    documentIds: Optional[List[str]] = None

class QueryRequestSchema(BaseModel):
    sessionId: str
    message: str

class SearchRequestSchema(BaseModel):
    query: str
    documentIds: Optional[List[str]] = None
