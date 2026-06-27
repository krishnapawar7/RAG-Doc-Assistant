# AI Document Assistant — API Documentation

This document describes the API interface endpoints exposed by the backend for handling chat sessions, parsing documents, calculating vector similarities, and streaming synthesized answers.

---

## 1. Document Management

### 1.1 Upload Document
* **URL:** `/api/files/upload`
* **Method:** `POST`
* **Content-Type:** `multipart/form-data`
* **Payload Fields:**
  * `file`: PDF binary file (Max 15MB)
* **Description:** Receives the raw binary stream of a PDF file, extracts text, performs overlapping chunk splits, generates embeddings in small parallel batches to avoid 429 rate limit triggers, and indexes vectors inside the SQLite database.

#### Response:
```json
{
  "id": "file_1687640203010",
  "name": "corporate_guide.pdf",
  "size": 245102,
  "type": "application/pdf",
  "pageCount": 4,
  "uploadedAt": "2026-06-26T13:28:18.000Z",
  "status": "processing"
}
```

---

### 1.2 List Documents
* **URL:** `/api/files`
* **Method:** `GET`
* **Description:** Retrieves all document records stored in the SQLite repository with their active statuses and text chunk count.

#### Response:
```json
[
  {
    "id": "file_1687640203010",
    "name": "corporate_guide.pdf",
    "size": 245102,
    "pageCount": 4,
    "uploadedAt": "2026-06-26T13:28:18.000Z",
    "status": "ready",
    "chunkCount": 24
  }
]
```

---

### 1.3 Delete Document
* **URL:** `/api/files/{id}`
* **Method:** `DELETE`
* **Description:** Unlinks a PDF file from the platform, deleting its metadata, all extracted text blocks, and associated vector indexes.

#### Response:
```json
{
  "success": true,
  "message": "File and embeddings deleted successfully."
}
```

---

## 2. Conversational Sessions

### 2.1 Create Chat Session
* **URL:** `/api/sessions`
* **Method:** `POST`
* **Payload:**
```json
{
  "title": "Corporate Standard Q&A",
  "documentIds": ["file_1687640203010"]
}
```

#### Response:
```json
{
  "id": "session_1687640203200",
  "title": "Corporate Standard Q&A",
  "messages": [],
  "documentIds": ["file_1687640203010"],
  "createdAt": "2026-06-26T13:28:30.000Z"
}
```

---

### 2.2 List Chat Sessions
* **URL:** `/api/sessions`
* **Method:** `GET`
* **Description:** Retrieves all historic chat session threads together with their nested question-answer exchange histories.

---

## 3. Real-Time RAG Pipeline

### 3.1 Stream Chat Q&A (SSE)
* **URL:** `/api/chat/stream`
* **Method:** `POST`
* **Headers:** `Accept: text/event-stream`
* **Payload:**
```json
{
  "sessionId": "session_1687640203200",
  "message": "What is the warranty policy?"
}
```

#### Event Flow:
1. **`event: sources`**: Flushes immediately upon vector retrieval completion, listing matching Top-K context blocks.
   ```
   data: [{"chunk": {"id": "chunk_file_1_3", "text": "Warranty lasts for 2 years...", "pageIndex": 2}, "similarity": 0.8122}]
   ```
2. **`event: token`**: Streams typewriter tokens dynamically.
   ```
   data: {"text": "According"}
   data: {"text": " to"}
   ```
3. **`event: done`**: Sent upon generation stream completion, enclosing final DB-saved objects.
   ```
   data: {"userMessage": {...}, "assistantMessage": {...}}
   ```
