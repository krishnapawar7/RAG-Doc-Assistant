/**
 * Type Definitions for RAG Document Assistant
 */

export interface DocumentSummary {
  overview: string;
  highlights: string[];
  suggestedQuestions: string[];
}

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  pageCount: number;
  uploadedAt: string;
  status: 'processing' | 'ready' | 'error';
  chunkCount?: number;
  error?: string;
  summary?: DocumentSummary;
}

export interface DocChunk {
  id: string;
  documentId: string;
  documentName: string;
  text: string;
  pageIndex: number; // 1-based page index
  chunkIndex: number; // Index within the document chunks
}

export interface VectorDbItem {
  id: string;
  documentId: string;
  documentName: string;
  text: string;
  pageIndex: number;
  chunkIndex: number;
  embedding: number[];
}

export interface SearchResult {
  chunk: Omit<VectorDbItem, 'embedding'>;
  similarity: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  sources?: SearchResult[];
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  documentIds: string[];
  createdAt: string;
}

export interface AppState {
  files: UploadedFile[];
  sessions: ChatSession[];
  activeSessionId: string | null;
  loading: boolean;
  isStreaming: boolean;
}
