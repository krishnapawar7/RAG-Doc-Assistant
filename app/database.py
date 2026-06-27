import sqlite3
import json
import os
from typing import List, Optional, Dict, Any
from app.config import settings
from app.models import UploadedFileSchema, ChatSessionSchema, ChatMessageSchema, ChunkMetadata

DB_PATH = "data/assistant.db"

def get_db_connection():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Files Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS files (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        size INTEGER NOT NULL,
        type TEXT NOT NULL,
        page_count INTEGER DEFAULT 0,
        chunk_count INTEGER,
        uploaded_at TEXT NOT NULL,
        status TEXT NOT NULL,
        error TEXT
    )
    """)
    
    # 2. Chunks Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS chunks (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        document_name TEXT NOT NULL,
        text TEXT NOT NULL,
        page_index INTEGER NOT NULL,
        chunk_index INTEGER NOT NULL,
        embedding TEXT NOT NULL, -- Stored as JSON array of floats
        FOREIGN KEY (document_id) REFERENCES files (id) ON DELETE CASCADE
    )
    """)
    
    # 3. Chat Sessions Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        document_ids TEXT NOT NULL, -- Stored as JSON list of file IDs
        created_at TEXT NOT NULL
    )
    """)
    
    # 4. Chat Messages Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        sources TEXT, -- Stored as JSON list of sources
        FOREIGN KEY (session_id) REFERENCES sessions (id) ON DELETE CASCADE
    )
    """)
    
    conn.commit()
    conn.close()

# Database CRUD Operations
class Database:
    @staticmethod
    def get_files() -> List[UploadedFileSchema]:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM files ORDER BY uploaded_at DESC")
        rows = cursor.fetchall()
        conn.close()
        
        return [
            UploadedFileSchema(
                id=row["id"],
                name=row["name"],
                size=row["size"],
                type=row["type"],
                pageCount=row["page_count"],
                chunkCount=row["chunk_count"],
                uploadedAt=row["uploaded_at"],
                status=row["status"],
                error=row["error"]
            )
            for row in rows
        ]

    @staticmethod
    def insert_file(file: UploadedFileSchema):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO files (id, name, size, type, page_count, chunk_count, uploaded_at, status, error) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (file.id, file.name, file.size, file.type, file.pageCount, file.chunkCount, file.uploadedAt, file.status, file.error)
        )
        conn.commit()
        conn.close()

    @staticmethod
    def update_file_status(file_id: str, status: str, page_count: int, chunk_count: int, error: Optional[str] = None):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE files SET status = ?, page_count = ?, chunk_count = ?, error = ? WHERE id = ?",
            (status, page_count, chunk_count, error, file_id)
        )
        conn.commit()
        conn.close()

    @staticmethod
    def delete_file(file_id: str):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM files WHERE id = ?", (file_id,))
        cursor.execute("DELETE FROM chunks WHERE document_id = ?", (file_id,))
        conn.commit()
        conn.close()

    @staticmethod
    def insert_chunks(chunks: List[Dict[str, Any]]):
        conn = get_db_connection()
        cursor = conn.cursor()
        for chunk in chunks:
            cursor.execute(
                "INSERT INTO chunks (id, document_id, document_name, text, page_index, chunk_index, embedding) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (chunk["id"], chunk["documentId"], chunk["documentName"], chunk["text"], chunk["pageIndex"], chunk["chunkIndex"], json.dumps(chunk["embedding"]))
            )
        conn.commit()
        conn.close()

    @staticmethod
    def get_chunks(document_ids: Optional[List[str]] = None) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        if document_ids:
            placeholders = ",".join("?" for _ in document_ids)
            cursor.execute(f"SELECT * FROM chunks WHERE document_id IN ({placeholders})", tuple(document_ids))
        else:
            cursor.execute("SELECT * FROM chunks")
            
        rows = cursor.fetchall()
        conn.close()
        
        return [
            {
                "id": row["id"],
                "documentId": row["document_id"],
                "documentName": row["document_name"],
                "text": row["text"],
                "pageIndex": row["page_index"],
                "chunkIndex": row["chunk_index"],
                "embedding": json.loads(row["embedding"])
            }
            for row in rows
        ]

    @staticmethod
    def get_sessions() -> List[ChatSessionSchema]:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM sessions ORDER BY created_at DESC")
        session_rows = cursor.fetchall()
        
        sessions = []
        for s_row in session_rows:
            cursor.execute("SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp ASC", (s_row["id"],))
            msg_rows = cursor.fetchall()
            
            messages = [
                ChatMessageSchema(
                    id=m_row["id"],
                    role=m_row["role"],
                    content=m_row["content"],
                    timestamp=m_row["timestamp"],
                    sources=json.loads(m_row["sources"]) if m_row["sources"] else None
                )
                for m_row in msg_rows
            ]
            
            sessions.append(
                ChatSessionSchema(
                    id=s_row["id"],
                    title=s_row["title"],
                    messages=messages,
                    documentIds=json.loads(s_row["document_ids"]),
                    createdAt=s_row["created_at"]
                )
            )
            
        conn.close()
        return sessions

    @staticmethod
    def get_session(session_id: str) -> Optional[ChatSessionSchema]:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM sessions WHERE id = ?", (session_id,))
        s_row = cursor.fetchone()
        
        if not s_row:
            conn.close()
            return None
            
        cursor.execute("SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp ASC", (session_id,))
        msg_rows = cursor.fetchall()
        
        messages = [
            ChatMessageSchema(
                id=m_row["id"],
                role=m_row["role"],
                content=m_row["content"],
                timestamp=m_row["timestamp"],
                sources=json.loads(m_row["sources"]) if m_row["sources"] else None
            )
            for m_row in msg_rows
        ]
        
        session = ChatSessionSchema(
            id=s_row["id"],
            title=s_row["title"],
            messages=messages,
            documentIds=json.loads(s_row["document_ids"]),
            createdAt=s_row["created_at"]
        )
        conn.close()
        return session

    @staticmethod
    def insert_session(session: ChatSessionSchema):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO sessions (id, title, document_ids, created_at) VALUES (?, ?, ?, ?)",
            (session.id, session.title, json.dumps(session.documentIds), session.createdAt)
        )
        conn.commit()
        conn.close()

    @staticmethod
    def update_session_bindings(session_id: str, document_ids: List[str]):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE sessions SET document_ids = ? WHERE id = ?",
            (json.dumps(document_ids), session_id)
        )
        conn.commit()
        conn.close()

    @staticmethod
    def delete_session(session_id: str):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
        cursor.execute("DELETE FROM messages WHERE session_id = ?", (session_id,))
        conn.commit()
        conn.close()

    @staticmethod
    def insert_message(session_id: str, message: ChatMessageSchema):
        conn = get_db_connection()
        cursor = conn.cursor()
        sources_json = json.dumps([src.dict() for src in message.sources]) if message.sources else None
        cursor.execute(
            "INSERT INTO messages (id, session_id, role, content, timestamp, sources) VALUES (?, ?, ?, ?, ?, ?)",
            (message.id, session_id, message.role, message.content, message.timestamp, sources_json)
        )
        conn.commit()
        conn.close()

    @staticmethod
    def clear_all_data():
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM files")
        cursor.execute("DELETE FROM chunks")
        cursor.execute("DELETE FROM sessions")
        cursor.execute("DELETE FROM messages")
        conn.commit()
        conn.close()
