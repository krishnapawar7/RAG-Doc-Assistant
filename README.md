# AI Document Assistant

A production-ready, dual-architecture **AI-powered Document Q&A Assistant** supporting multi-document RAG (Retrieval-Augmented Generation) with Server-Sent Events (SSE) streaming answers, inline citations, and conversational history.

The workspace is pre-configured with a **Dual-Stack** setup:
1. **TypeScript Stack (Vite + React + Express + SQLite)**: Powers the live browser preview running on Port 3000.
2. **Python Stack (FastAPI + LangChain + SQLite + HTML5/CSS/JS)**: Available in `/app` and `/frontend` for local Python development, Docker environments, or production deployments.

Both stacks leverage the state-of-the-art **Google GenAI SDK** using **Gemini 3.5 Flash** for content synthesis and **Gemini Embedding-2-Preview** for 3072-dimensional vector representations.

---

## 🛠️ Development Plan & Architecture Mapping

The application is structured to satisfy all stages of the system lifecycle:

### Phase 1 — Project Setup
* **Structure**: Clean separation between server controllers, React components, and Python API handlers.
* **Environments**: Configured `.env` loader with automated dependency configurations for Node (`package.json`) and Python (`requirements.txt`).
* **Runtime**: Express server running natively inside the live developer sandbox on Port 3000; FastAPI server prepared in `/app`.

### Phase 2 — Multi-Format Uploads (`POST /api/files/upload`)
* **Formats Supported**: Uploads and parses **PDF**, **TXT**, and **DOCX** files safely.
* **Validation**: Restricts upload buffers based on file extensions, matching content-types, and file sizes up to 15MB.
* **Ingestion State**: Saves raw files into in-memory streams to bypass disk read bottlenecking, and marks processing state inside the database.

### Phase 3 — Text Extraction
* **Engines**: Leverages `pdf-parse` (TypeScript) and `pypdf` (Python) to extract text page-by-page.
* **Citations Metadata**: Retains exact page indices and file metadata mapping, ensuring all citations map to the exact page numbers of the source material.

### Phase 4 — Overlapping Chunking
* **Method**: Utilizes a highly stable, word-boundary-preserving **Sliding Overlap Chunker** (`RecursiveCharacterTextSplitter` equivalent).
* **Metrics**: Segments extracted pages into text blocks of maximum **800-1000 characters** with a **150-character sliding overlap** to prevent context clipping between adjacent segments.

### Phase 5 — High-Dimensional Embeddings
* **Model**: Generates premium embeddings with **Gemini Embedding-2-Preview** (defaulting to 3072 dimensions for rich semantic representation).
* **Rate Limits Protection**: Implements a serialized batch chunking engine to send blocks in parallel windows of 5 concurrent requests with slight pacing delays, fully mitigating API throttling (`HTTP 429`).

### Phase 6 — Vector Storage & Cosine Similarity
* **Database**: Persists high-dimensional float arrays in standard SQLite stores as serialized float vectors.
* **Similarity Score**: Performs cosine similarity calculations (`(A • B) / (||A|| * ||B||)`) in database query-time, filtering out low-relevance results beneath a `>0.15` similarity threshold.

### Phase 7 — Question Answering Pipeline
1. Client issues a prompt.
2. The query text is transformed into a 3072-dimensional query vector.
3. Candidate vectors are retrieved and scored against the query vector.
4. The **Top 4-5 text chunks** are structured into a system instruction context block.
5. Gemini synthesizes the final response with strict safety anchors.

### Phase 8 & 9 — Chat API & Historical Memory
* **Endpoint**: `POST /api/chat/stream` or `/api/sessions`.
* **State Management**: Conversational dialogue exchanges, uploaded documents, and active search session objects are persisted securely inside SQLite.
* **History Retrieve**: `GET /api/sessions` or `GET /api/chat/history/{session_id}` dynamically re-hydrates historical message streams on the client.

### Phase 10 — Swiss-Minimalist Frontend
* **Visual Theme**: High-contrast, dark cosmic visual aesthetics utilizing deep grays, rich silvers, and elegant negative space.
* **Interactive Elements**:
  * **File Drawer**: Drag-and-drop or select multi-format document uploads.
  * **Interactive Console**: RAG Architecture Flowchart, dynamic endpoint documentation, and real-time **Vector Similarity Inspector** to search and debug raw embeddings.
  * **Chat Engine**: SSE typing animations, direct inline source references mapping to files/pages, and chat session persistence.

---

## 📂 Project Directory Structure

```
ai-document-assistant/
│
├── app/                  # Python FastAPI Backend
│   ├── main.py           # FastAPI entry point, routing, and CORS
│   ├── config.py         # Environment variables and settings
│   ├── models.py         # Pydantic state schemas
│   ├── database.py       # SQLite connection and CRUD managers
│   ├── rag.py            # Extraction, chunking, and Gemini streaming
│   ├── auth.py           # Authentication middleware simulator
│   └── utils.py          # Math formulas & chunking algorithms
│
├── src/                  # React Frontend (Live Preview Stack)
│   ├── components/       
│   │   ├── Sidebar.tsx         # Document list, session manager, and uploads
│   │   ├── ChatInterface.tsx   # SSE listener, source citations, and dialogue
│   │   └── ArchitectureDoc.tsx # Technical RAG diagram and Vector inspector
│   ├── App.tsx           # Main state orchestrator
│   ├── types.ts          # Shared TypeScript contracts
│   └── index.css         # Tailwind global stylesheet
│
├── frontend/             # Python HTML/CSS Static Frontend Client
│   ├── index.html        # Clean dashboard interface
│   ├── style.css         # Dark theme aesthetic styles
│   └── script.js         # Event-source listeners & uploads
│
├── data/                 # Shared local SQLite database storage
├── uploads/              # Buffered raw documents directory
├── requirements.txt      # Python production dependencies
├── server.ts             # Express + Vite SSR entrypoint (TypeScript Stack)
├── Dockerfile            # Optimized deployment file
├── docker-compose.yml    # Full local container configuration specs
└── API_DOCUMENTATION.md  # Deep API endpoint references
```

---

## 🚀 Getting Started

### Option A: TypeScript Live Stack (Pre-configured in AI Studio Preview)
The preview environment is running on port **3000** automatically. If you want to run it locally:
```bash
# Install dependencies
npm install

# Start the interactive dev server
npm run dev
```

### Option B: Python FastAPI Stack
To boot the FastAPI + LangChain-style pipeline:
```bash
# 1. Initialize and activate a virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# 2. Install Python requirements
pip install -r requirements.txt

# 3. Boot the FastAPI server on port 3000
uvicorn app.main:app --host 0.0.0.0 --port 3000 --reload
```
You can now open the static client in `/frontend/index.html` or through your local browser!

---

## 💎 Bonus Features Included Natively
* **Multi-document context constraints**: Bound queries to specific sets of documents, filtering out noise.
* **Full streaming output**: Dynamic, token-by-token server streams for lower perceived latency.
* **Auth Placeholders**: Standard security hooks (`HTTPBearer`) structured for simple production authorization swaps.
* **Vector Inspector Console**: Deep debug suite allowing search queries to test embedding results directly from the browser.