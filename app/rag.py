import io
import time
from typing import List, Dict, Any, Tuple
from pypdf import PdfReader
from google import genai
from google.genai import types

from app.config import settings
from app.database import Database
from app.utils import chunk_text, cosine_similarity
from app.models import ChunkMetadata, SearchResultSchema

def get_genai_client() -> genai.Client:
    """Initializes and returns the modern GenAI Client."""
    if not settings.GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY environment variable is not configured.")
    return genai.Client(api_key=settings.GEMINI_API_KEY)

def extract_pdf_pages(pdf_bytes: bytes) -> Tuple[int, List[Dict[str, Any]]]:
    """Parses PDF binary content page-by-page, returning pageCount and extracted pages."""
    pdf_file = io.BytesIO(pdf_bytes)
    reader = PdfReader(pdf_file)
    page_count = len(reader.pages)
    
    pages = []
    for i, page in enumerate(reader.pages):
        text = page.extract_text() or ""
        pages.append({
            "pageNum": i + 1,
            "text": text.strip()
        })
        
    return page_count, pages

def generate_embeddings_in_batches(texts: List[str], batch_size: int = 5) -> List[List[float]]:
    """Generates 768-dimensional float embeddings using the gemini-embedding-2-preview model."""
    if not texts:
        return []
        
    client = get_genai_client()
    embeddings = []
    
    # Process in small chunks to adhere to model rate limits elegantly
    for i in range(0, len(texts), batch_size):
        batch = texts[i : i + batch_size]
        response = client.models.embed_content(
            model="gemini-embedding-2-preview",
            contents=batch
        )
        
        # Parse output list of embeddings
        for emb in response.embeddings:
            embeddings.append(emb.values)
            
        time.sleep(0.5)  # Respect rate limits
        
    return embeddings

def process_and_index_pdf(file_id: str, file_name: str, pdf_bytes: bytes) -> Tuple[int, int]:
    """Processes PDF: extracts pages, chunks, generates embeddings in background, and inserts to DB."""
    # 1. Extract text page-by-page
    page_count, pages = extract_pdf_pages(pdf_bytes)
    
    all_chunks = []
    for page in pages:
        chunks = chunk_text(page["text"], settings.CHUNK_SIZE, settings.CHUNK_OVERLAP)
        for idx, text in enumerate(chunks):
            all_chunks.append({
                "text": text,
                "pageNum": page["pageNum"],
                "chunkIdx": idx
            })
            
    # 2. Embed content chunks in batches
    texts_to_embed = [c["text"] for c in all_chunks]
    vectors = generate_embeddings_in_batches(texts_to_embed, batch_size=5)
    
    # 3. Save chunks and embeddings into SQLite Store
    db_items = []
    for i, c in enumerate(all_chunks):
        db_items.append({
            "id": f"chunk_{file_id}_{i}",
            "documentId": file_id,
            "documentName": file_name,
            "text": c["text"],
            "pageIndex": c["pageNum"],
            "chunkIndex": c["chunkIdx"],
            "embedding": vectors[i]
        })
        
    Database.insert_chunks(db_items)
    return page_count, len(db_items)

def query_vector_db(query: str, document_ids: Optional[List[str]] = None) -> List[SearchResultSchema]:
    """Retrieves top matching document context chunks using Cosine Similarity above 0.15."""
    # 1. Get candidate chunks
    active_chunks = Database.get_chunks(document_ids)
    if not active_chunks:
        return []
        
    # 2. Embed user question
    client = get_genai_client()
    query_embed_res = client.models.embed_content(
        model="gemini-embedding-2-preview",
        contents=query
    )
    query_vector = query_embed_res.embeddings[0].values
    
    # 3. Calculate similarity score
    results = []
    for chunk in active_chunks:
        similarity = cosine_similarity(query_vector, chunk["embedding"])
        if similarity > 0.15:
            metadata = ChunkMetadata(
                id=chunk["id"],
                documentId=chunk["documentId"],
                documentName=chunk["documentName"],
                text=chunk["text"],
                pageIndex=chunk["pageIndex"],
                chunkIndex=chunk["chunkIndex"]
            )
            results.append(SearchResultSchema(chunk=metadata, similarity=similarity))
            
    # 4. Sort and return Top 4 chunks
    results.sort(key=lambda x: x.similarity, reverse=True)
    return results[:4]
