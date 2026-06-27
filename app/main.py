import os
import json
from datetime import datetime
from typing import Optional, List
from fastapi import FastAPI, UploadFile, File, Form, BackgroundTasks, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from app.config import settings
from app.models import (
    UploadedFileSchema,
    ChatSessionSchema,
    ChatMessageSchema,
    SessionCreateSchema,
    QueryRequestSchema,
    SearchRequestSchema,
    SearchResultSchema
)
from app.database import init_db, Database
from app.rag import process_and_index_pdf, query_vector_db, get_genai_client
from google.genai import types

# Initialize DB on start
init_db()

app = FastAPI(
    title="AI Document Assistant API",
    description="Full-stack PDF RAG pipeline leveraging the Gemini 3.5 Flash and Gemini Embedding-2-Preview models.",
    version="1.0.0"
)

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Core background processing task
def background_process_pdf(file_id: str, file_name: str, file_bytes: bytes):
    try:
        page_count, chunk_count = process_and_index_pdf(file_id, file_name, file_bytes)
        Database.update_file_status(file_id, "ready", page_count, chunk_count)
    except Exception as e:
        print(f"Error processing PDF in background: {e}")
        Database.update_file_status(file_id, "error", 0, 0, str(e))

@app.get("/api/files", response_model=List[UploadedFileSchema])
async def list_files():
    """Retrieves all uploaded files metadata."""
    return Database.get_files()

@app.post("/api/files/upload", response_model=UploadedFileSchema)
async def upload_file(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    """Uploads a PDF file and queues background parsing, chunking, and indexing."""
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
        
    file_bytes = await file.read()
    file_size = len(file_bytes)
    file_id = f"file_{int(datetime.utcnow().timestamp() * 1000)}"
    
    new_file = UploadedFileSchema(
        id=file_id,
        name=file.filename,
        size=file_size,
        type="application/pdf",
        pageCount=0,
        uploadedAt=datetime.utcnow().isoformat() + "Z",
        status="processing"
    )
    
    # Save preliminary state
    Database.insert_file(new_file)
    
    # Dispatch processing task
    background_tasks.add_task(background_process_pdf, file_id, file.filename, file_bytes)
    
    return new_file

@app.delete("/api/files/{file_id}")
async def delete_file(file_id: str):
    """Deletes a file, its text segments, and its vector embeddings."""
    Database.delete_file(file_id)
    return {"success": True, "message": "File and embeddings deleted successfully."}

@app.get("/api/sessions", response_model=List[ChatSessionSchema])
async def list_sessions():
    """Retrieves all chat sessions."""
    return Database.get_sessions()

@app.post("/api/sessions", response_model=ChatSessionSchema)
async def create_session(payload: SessionCreateSchema):
    """Creates a new conversational chat session."""
    session_id = f"session_{int(datetime.utcnow().timestamp() * 1000)}"
    new_session = ChatSessionSchema(
        id=session_id,
        title=payload.title or "New Conversation",
        messages=[],
        documentIds=payload.documentIds or [],
        createdAt=datetime.utcnow().isoformat() + "Z"
    )
    Database.insert_session(new_session)
    return new_session

@app.delete("/api/sessions/{session_id}")
async def delete_session(session_id: str):
    """Deletes a conversational chat session."""
    Database.delete_session(session_id)
    return {"success": True}

@app.post("/api/sessions/{session_id}/bindings")
async def update_session_bindings(session_id: str, document_ids: List[str]):
    """Updates document restrictions for a given chat session."""
    Database.update_session_bindings(session_id, document_ids)
    return {"success": True}

@app.post("/api/chat/stream")
async def chat_stream(payload: QueryRequestSchema):
    """Streams RAG-synthesized Gemini chat answers using Server-Sent Events (SSE)."""
    session = Database.get_session(payload.sessionId)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
        
    async def sse_generator():
        try:
            # 1. Retrieve most similar text chunks
            retrieved_sources = query_vector_db(payload.message, session.documentIds)
            
            # Format sources and send immediately to client
            sources_json = json.dumps([src.dict() for src in retrieved_sources])
            yield f"event: sources\ndata: {sources_json}\n\n"
            
            # 2. Build contextual prompt
            if retrieved_sources:
                context_str = "\n\n".join(
                    f"[Source {i+1}] Document: {src.chunk.documentName}, Page: {src.chunk.pageIndex}\nContent: {src.chunk.text}"
                    for i, src in enumerate(retrieved_sources)
                )
            else:
                context_str = "No matching document context was found. The user is asking a general question."
                
            system_instruction = (
                "You are an expert Document Q&A Assistant. Answer the user's question accurately based ONLY on the provided context document chunks.\n"
                "If the context does not contain the answer, state clearly that the information is not available in the uploaded documents.\n"
                "Always refer to the specific source document and page number when answering using inline citations (e.g. [Source 1], [Source 2]). Do not cite sources that are not in the context.\n"
                "Keep your answers clear, professional, and well-structured, formatted in elegant Markdown."
            )
            
            user_prompt = f"Context Chunks:\n{context_str}\n\nQuestion: {payload.message}"
            
            # 3. Stream from Gemini 3.5 Flash
            client = get_genai_client()
            response_stream = client.models.generate_content_stream(
                model="gemini-3.5-flash",
                contents=user_prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    temperature=0.2
                )
            )
            
            full_answer = ""
            for chunk in response_stream:
                token = chunk.text or ""
                full_answer += token
                yield f"event: token\ndata: {json.dumps({'text': token})}\n\n"
                
            # 4. Save QA dialogue exchange to SQLite store
            user_msg_id = f"msg_{int(datetime.utcnow().timestamp() * 1000)}_user"
            ass_msg_id = f"msg_{int(datetime.utcnow().timestamp() * 1000) + 1}_assistant"
            
            user_msg = ChatMessageSchema(
                id=user_msg_id,
                role="user",
                content=payload.message,
                timestamp=datetime.utcnow().isoformat() + "Z"
            )
            
            assistant_msg = ChatMessageSchema(
                id=ass_msg_id,
                role="assistant",
                content=full_answer,
                timestamp=datetime.utcnow().isoformat() + "Z",
                sources=retrieved_sources
            )
            
            Database.insert_message(payload.sessionId, user_msg)
            Database.insert_message(payload.sessionId, assistant_msg)
            
            yield f"event: done\ndata: {json.dumps({'userMessage': user_msg.dict(), 'assistantMessage': assistant_msg.dict()})}\n\n"
            
        except Exception as e:
            print(f"SSE Chat Generation failed: {e}")
            yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"
            
    return StreamingResponse(sse_generator(), media_type="text/event-stream")

@app.post("/api/dev/reset")
async def dev_reset():
    """Wipes all documents, chunks, chat histories, and sessions (development purge tool)."""
    Database.clear_all_data()
    return {"success": True, "message": "All database entries reset successfully."}

@app.post("/api/dev/search", response_model=List[SearchResultSchema])
async def dev_search(payload: SearchRequestSchema):
    """Queries raw similarity score matches for debugging embeddings directly."""
    return query_vector_db(payload.query, payload.documentIds)

@app.get("/api/files/{file_id}/chunks")
async def get_file_chunks(file_id: str):
    """Retrieves chunks list for a document (Vector inspector aid)."""
    chunks = Database.get_chunks([file_id])
    return [
        {
            "id": c["id"],
            "text": c["text"],
            "pageIndex": c["pageIndex"],
            "chunkIndex": c["chunkIndex"]
        }
        for c in chunks
    ]
