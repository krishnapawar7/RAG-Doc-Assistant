import React, { useState, useEffect } from 'react';
import { Play, Database, BookOpen, Layers, Server, Code, Trash2, ArrowRight, Search, Activity, HelpCircle, X, Sparkles, FileText, CheckCircle, RefreshCw } from 'lucide-react';
import { UploadedFile, SearchResult } from '../types';

interface ArchitectureDocProps {
  files: UploadedFile[];
  onResetAll: () => Promise<void>;
  theme: 'dark' | 'light';
  onClose?: () => void;
  onGenerateSummary?: (fileId: string) => Promise<void>;
  onAskQuestion?: (question: string) => void;
}

export default function ArchitectureDoc({ files, onResetAll, theme, onClose, onGenerateSummary, onAskQuestion }: ArchitectureDocProps) {
  const [activeTab, setActiveTab] = useState<'diagram' | 'api' | 'inspector' | 'insights'>('diagram');
  const [selectedNode, setSelectedNode] = useState<string>('upload');
  const [rawQuery, setRawQuery] = useState('');
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedEndpoint, setSelectedEndpoint] = useState<string>('stream');
  const [selectedSummaryFileId, setSelectedSummaryFileId] = useState<string>('');
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

  useEffect(() => {
    if (!selectedSummaryFileId && files.length > 0) {
      const firstReady = files.find(f => f.status === 'ready');
      if (firstReady) {
        setSelectedSummaryFileId(firstReady.id);
      }
    }
  }, [files, selectedSummaryFileId]);

  // Multi-document selection for the vector inspector
  const handleDocToggle = (id: string) => {
    setSelectedDocs(prev => 
      prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
    );
  };

  const runVectorSearch = async () => {
    if (!rawQuery.trim()) return;
    setIsSearching(true);
    try {
      const res = await fetch('/api/dev/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: rawQuery,
          documentIds: selectedDocs
        })
      });
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  const resetDB = async () => {
    if (confirm('Are you sure you want to completely wipe all processed files, vector embeddings, and chat history? This cannot be undone.')) {
      await onResetAll();
      setSearchResults([]);
      setRawQuery('');
    }
  };

  // Node descriptions for the architecture diagram
  const nodeDescriptions: Record<string, { title: string; subtitle: string; body: string; code: string }> = {
    upload: {
      title: '1. PDF Upload & Stream Ingestion',
      subtitle: 'EXPRESS ROUTER & MULTER MEMORY STORAGE',
      body: 'The client uploads a PDF document via a standard `multipart/form-data` POST request. Multer intercepts the request and buffers the file streams into memory. This bypasses disk reads, providing extremely fast, stateless execution.',
      code: 'app.post("/api/files/upload", upload.single("file"), async (req, res) => { ... })'
    },
    parser: {
      title: '2. Page-Level Text Extraction',
      subtitle: 'PDF-PARSE PAGE RENDERING & NORMALIZATION',
      body: 'Utilizes pdf-parse with custom page render hooks to extract characters page-by-page. Maintaining page boundaries is essential for RAG, so that subsequent retrieved search citations can map back to exact page numbers.',
      code: 'pdf(buffer, { pagerender: (pageData) => { ... } })'
    },
    chunker: {
      title: '3. Sliding-Overlap Chunker',
      subtitle: 'TOKEN BOUNDARY PRESERVATION CHUNKER',
      body: 'Splits raw page text into chunks of maximum 800 characters with a sliding overlap of 150 characters. Slicing happens on word boundaries (whitespace) to preserve syntactic coherence, preventing information clipping between chunk edges.',
      code: 'function chunkText(text, maxChunkSize = 800, overlap = 150) { ... }'
    },
    embeddings: {
      title: '4. Batch Embedding Generation',
      subtitle: 'GEMINI-EMBEDDING-2-PREVIEW API',
      body: 'Transforms textual chunks into 768-dimensional floating point vector representation using the state-of-the-art embedding model. To avoid triggering rate limits (429), our pipeline schedules calls in chunks of 5 using asynchronous batch concurrency.',
      code: 'ai.models.embedContent({ model: "gemini-embedding-2-preview", contents: chunkText })'
    },
    vector: {
      title: '5. In-Memory Vector DB & Indexing',
      subtitle: 'HIGH-PERFORMANCE COSINE SIMILARITY MATCHER',
      body: 'Stores the extracted vectors, chunks, and page indexes securely. In query-time, computes the cosine similarity between the question vector and document vectors. It filters out low-quality matches and selects the Top K highest scores.',
      code: 'similarity = (A • B) / (||A|| * ||B||)'
    },
    prompt: {
      title: '6. Contextual Prompt Assembly',
      subtitle: 'SYSTEM INSTRUCTIONS & SAFETY ANCHORING',
      body: 'Assembles retrieved Top K text chunks into a cohesive context prompt. The prompt includes strict system guidelines directing Gemini to rely ONLY on the verified context, cite references, and decline to answer if the context contains no facts.',
      code: 'systemInstruction: "Answer based ONLY on context..."'
    },
    llm: {
      title: '7. Gemini Q&A Synthesis',
      subtitle: 'GEMINI-3.5-FLASH TEXT GENERATION',
      body: 'Leverages the incredibly fast Gemini 3.5 Flash model. It processes the context block and generates a highly accurate, structured answer containing inline citations mapping to our sources.',
      code: 'ai.models.generateContentStream({ model: "gemini-3.5-flash", contents })'
    },
    sse: {
      title: '8. Server-Sent Events (SSE) Streaming',
      subtitle: 'HTTP CHUNKED-TRANSFER-ENCODING',
      body: 'Sends response stream to the client token-by-token. This keeps latency down to milliseconds and provides a polished typing effect. The stream first flushes the source references, then streams the answer, and finally saves history.',
      code: 'res.writeHead(200, { "Content-Type": "text/event-stream" })'
    }
  };

  return (
    <div className={`flex flex-col h-full rounded-md overflow-hidden border ${
      theme === 'dark' ? 'bg-[#0a0a0a] border-white/5' : 'bg-[#fcfcfc] border-zinc-200 shadow-sm'
    }`}>
      {/* Tab bar */}
      <div className={`flex items-center justify-between px-5 py-3 border-b ${
        theme === 'dark' ? 'border-white/5 bg-[#0a0a0a]' : 'border-zinc-200/80 bg-[#fbfbfb]'
      }`}>
        <div className="flex items-center space-x-2.5">
          <Layers className={`w-4 h-4 ${theme === 'dark' ? 'text-white' : 'text-zinc-800'}`} />
          <span className={`text-[10px] font-bold uppercase tracking-[0.2em] ${theme === 'dark' ? 'text-[#8a8a8a]' : 'text-zinc-500'}`}>Technical Console</span>
          {onClose && (
            <button
              onClick={onClose}
              className={`lg:hidden p-1 rounded border transition-all cursor-pointer ${
                theme === 'dark'
                  ? 'border-white/10 text-zinc-400 hover:text-white hover:bg-white/5'
                  : 'border-zinc-200 text-zinc-500 hover:text-zinc-900 bg-white shadow-sm'
              }`}
              title="Close Console"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        <div className={`flex p-0.5 rounded border ${
          theme === 'dark' ? 'bg-[#0a0a0a] border-white/5' : 'bg-zinc-100/80 border-zinc-200'
        }`}>
          <button
            onClick={() => setActiveTab('diagram')}
            className={`px-3 py-1.5 text-[10px] rounded transition-all font-serif italic flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'diagram' 
                ? theme === 'dark'
                  ? 'bg-[#161616] text-white border border-white/10 shadow-sm' 
                  : 'bg-white text-zinc-950 border border-zinc-300/60 shadow-sm'
                : theme === 'dark' ? 'text-[#8a8a8a] hover:text-white' : 'text-zinc-500 hover:text-zinc-950'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>RAG Architecture</span>
          </button>
          <button
            onClick={() => setActiveTab('api')}
            className={`px-3 py-1.5 text-[10px] rounded transition-all font-serif italic flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'api' 
                ? theme === 'dark'
                  ? 'bg-[#161616] text-white border border-white/10 shadow-sm' 
                  : 'bg-white text-zinc-950 border border-zinc-300/60 shadow-sm'
                : theme === 'dark' ? 'text-[#8a8a8a] hover:text-white' : 'text-zinc-500 hover:text-zinc-950'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>API Docs</span>
          </button>
          <button
            onClick={() => setActiveTab('inspector')}
            className={`px-3 py-1.5 text-[10px] rounded transition-all font-serif italic flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'inspector' 
                ? theme === 'dark'
                  ? 'bg-[#161616] text-white border border-white/10 shadow-sm' 
                  : 'bg-white text-zinc-950 border border-zinc-300/60 shadow-sm'
                : theme === 'dark' ? 'text-[#8a8a8a] hover:text-white' : 'text-zinc-500 hover:text-zinc-950'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Vector Inspector</span>
          </button>
          <button
            onClick={() => setActiveTab('insights')}
            className={`px-3 py-1.5 text-[10px] rounded transition-all font-serif italic flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'insights' 
                ? theme === 'dark'
                  ? 'bg-[#161616] text-white border border-white/10 shadow-sm' 
                  : 'bg-white text-zinc-950 border border-zinc-300/60 shadow-sm'
                : theme === 'dark' ? 'text-[#8a8a8a] hover:text-white' : 'text-zinc-500 hover:text-zinc-950'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>AI Insights</span>
          </button>
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-5 md:p-6">
        {activeTab === 'diagram' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h3 className={`text-sm font-serif italic ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>Interactive Processing Diagram</h3>
              <span className={`text-[8px] font-mono tracking-wider border px-2.5 py-0.5 rounded uppercase ${
                theme === 'dark' ? 'bg-white/5 text-[#8a8a8a] border-white/5' : 'bg-zinc-100 text-zinc-500 border-zinc-200'
              }`}>Click nodes to inspect</span>
            </div>

            {/* Architecture Flow SVG */}
            <div className={`p-4 rounded-md border flex justify-center ${
              theme === 'dark' ? 'bg-[#0a0a0a] border-white/5' : 'bg-zinc-50 border-zinc-200/80 shadow-inner'
            }`}>
              <svg viewBox="0 0 700 280" className="w-full max-w-2xl text-slate-400 font-medium text-xs leading-none select-none">
                {/* Connections */}
                <path d="M 75 70 L 175 70" stroke={
                  theme === 'dark'
                    ? (selectedNode === 'upload' || selectedNode === 'parser' ? '#ffffff' : '#222222')
                    : (selectedNode === 'upload' || selectedNode === 'parser' ? '#18181b' : '#e4e4e7')
                } strokeWidth="1.5" fill="none" strokeDasharray="4" />
                <path d="M 225 70 L 325 70" stroke={
                  theme === 'dark'
                    ? (selectedNode === 'parser' || selectedNode === 'chunker' ? '#ffffff' : '#222222')
                    : (selectedNode === 'parser' || selectedNode === 'chunker' ? '#18181b' : '#e4e4e7')
                } strokeWidth="1.5" fill="none" strokeDasharray="4" />
                <path d="M 375 70 L 475 70" stroke={
                  theme === 'dark'
                    ? (selectedNode === 'chunker' || selectedNode === 'embeddings' ? '#ffffff' : '#222222')
                    : (selectedNode === 'chunker' || selectedNode === 'embeddings' ? '#18181b' : '#e4e4e7')
                } strokeWidth="1.5" fill="none" strokeDasharray="4" />
                
                {/* Downward step to Database */}
                <path d="M 525 95 L 525 155" stroke={theme === 'dark' ? '#ffffff' : '#18181b'} strokeWidth="1.5" fill="none" strokeDasharray="2" />
                
                {/* Bottom row connections */}
                <path d="M 475 180 L 375 180" stroke={
                  theme === 'dark'
                    ? (selectedNode === 'vector' || selectedNode === 'prompt' ? '#ffffff' : '#222222')
                    : (selectedNode === 'vector' || selectedNode === 'prompt' ? '#18181b' : '#e4e4e7')
                } strokeWidth="1.5" fill="none" strokeDasharray="4" />
                <path d="M 325 180 L 225 180" stroke={
                  theme === 'dark'
                    ? (selectedNode === 'prompt' || selectedNode === 'llm' ? '#ffffff' : '#222222')
                    : (selectedNode === 'prompt' || selectedNode === 'llm' ? '#18181b' : '#e4e4e7')
                } strokeWidth="1.5" fill="none" strokeDasharray="4" />
                <path d="M 175 180 L 75 180" stroke={
                  theme === 'dark'
                    ? (selectedNode === 'llm' || selectedNode === 'sse' ? '#ffffff' : '#222222')
                    : (selectedNode === 'llm' || selectedNode === 'sse' ? '#18181b' : '#e4e4e7')
                } strokeWidth="1.5" fill="none" strokeDasharray="4" />

                {/* Nodes Top Row */}
                {/* Upload */}
                <g onClick={() => setSelectedNode('upload')} className="cursor-pointer">
                  <rect x="15" y="45" width="110" height="50" rx="3" 
                    fill={selectedNode === 'upload' ? (theme === 'dark' ? '#ffffff' : '#18181b') : (theme === 'dark' ? '#0f0f0f' : '#ffffff')} 
                    stroke={selectedNode === 'upload' ? (theme === 'dark' ? '#ffffff' : '#18181b') : (theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)')} 
                    strokeWidth="1.5" 
                  />
                  <text x="70" y="70" fill={selectedNode === 'upload' ? (theme === 'dark' ? '#000000' : '#ffffff') : (theme === 'dark' ? '#8a8a8a' : '#52525b')} textAnchor="middle" className="text-[9px] font-mono tracking-wider font-bold">1. PDF UPLOAD</text>
                  <text x="70" y="83" fill={selectedNode === 'upload' ? (theme === 'dark' ? '#222222' : '#a1a1aa') : (theme === 'dark' ? '#555555' : '#71717a')} textAnchor="middle" className="text-[8px] font-serif italic">Multer & Memory</text>
                </g>

                {/* Parser */}
                <g onClick={() => setSelectedNode('parser')} className="cursor-pointer">
                  <rect x="165" y="45" width="110" height="50" rx="3" 
                    fill={selectedNode === 'parser' ? (theme === 'dark' ? '#ffffff' : '#18181b') : (theme === 'dark' ? '#0f0f0f' : '#ffffff')} 
                    stroke={selectedNode === 'parser' ? (theme === 'dark' ? '#ffffff' : '#18181b') : (theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)')} 
                    strokeWidth="1.5" 
                  />
                  <text x="220" y="70" fill={selectedNode === 'parser' ? (theme === 'dark' ? '#000000' : '#ffffff') : (theme === 'dark' ? '#8a8a8a' : '#52525b')} textAnchor="middle" className="text-[9px] font-mono tracking-wider font-bold">2. TEXT PARSER</text>
                  <text x="220" y="83" fill={selectedNode === 'parser' ? (theme === 'dark' ? '#222222' : '#a1a1aa') : (theme === 'dark' ? '#555555' : '#71717a')} textAnchor="middle" className="text-[8px] font-serif italic">pdf-parse Pages</text>
                </g>

                {/* Chunker */}
                <g onClick={() => setSelectedNode('chunker')} className="cursor-pointer">
                  <rect x="315" y="45" width="110" height="50" rx="3" 
                    fill={selectedNode === 'chunker' ? (theme === 'dark' ? '#ffffff' : '#18181b') : (theme === 'dark' ? '#0f0f0f' : '#ffffff')} 
                    stroke={selectedNode === 'chunker' ? (theme === 'dark' ? '#ffffff' : '#18181b') : (theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)')} 
                    strokeWidth="1.5" 
                  />
                  <text x="370" y="70" fill={selectedNode === 'chunker' ? (theme === 'dark' ? '#000000' : '#ffffff') : (theme === 'dark' ? '#8a8a8a' : '#52525b')} textAnchor="middle" className="text-[9px] font-mono tracking-wider font-bold">3. CHUNKER</text>
                  <text x="370" y="83" fill={selectedNode === 'chunker' ? (theme === 'dark' ? '#222222' : '#a1a1aa') : (theme === 'dark' ? '#555555' : '#71717a')} textAnchor="middle" className="text-[8px] font-serif italic">Overlap (800 Ch)</text>
                </g>

                {/* Embeddings */}
                <g onClick={() => setSelectedNode('embeddings')} className="cursor-pointer">
                  <rect x="465" y="45" width="110" height="50" rx="3" 
                    fill={selectedNode === 'embeddings' ? (theme === 'dark' ? '#ffffff' : '#18181b') : (theme === 'dark' ? '#0f0f0f' : '#ffffff')} 
                    stroke={selectedNode === 'embeddings' ? (theme === 'dark' ? '#ffffff' : '#18181b') : (theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)')} 
                    strokeWidth="1.5" 
                  />
                  <text x="520" y="70" fill={selectedNode === 'embeddings' ? (theme === 'dark' ? '#000000' : '#ffffff') : (theme === 'dark' ? '#8a8a8a' : '#52525b')} textAnchor="middle" className="text-[9px] font-mono tracking-wider font-bold">4. AI EMBEDDING</text>
                  <text x="520" y="83" fill={selectedNode === 'embeddings' ? (theme === 'dark' ? '#222222' : '#a1a1aa') : (theme === 'dark' ? '#555555' : '#71717a')} textAnchor="middle" className="text-[8px] font-serif italic">Gemini Embed-2</text>
                </g>

                {/* DB Node - Center Right */}
                <g onClick={() => setSelectedNode('vector')} className="cursor-pointer">
                  <rect x="465" y="155" width="110" height="50" rx="3" 
                    fill={selectedNode === 'vector' ? (theme === 'dark' ? '#ffffff' : '#18181b') : (theme === 'dark' ? '#0f0f0f' : '#ffffff')} 
                    stroke={selectedNode === 'vector' ? (theme === 'dark' ? '#ffffff' : '#18181b') : (theme === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)')} 
                    strokeWidth="1.5" 
                  />
                  <text x="520" y="178" fill={selectedNode === 'vector' ? (theme === 'dark' ? '#000000' : '#ffffff') : (theme === 'dark' ? '#a5b4fc' : '#4f46e5')} textAnchor="middle" className="text-[9px] font-mono tracking-wider font-bold">5. VECTOR STORE</text>
                  <text x="520" y="191" fill={selectedNode === 'vector' ? (theme === 'dark' ? '#222222' : '#e2e8f0') : (theme === 'dark' ? '#818cf8' : '#6366f1')} textAnchor="middle" className="text-[8px] font-serif italic">Cosine Similarity</text>
                </g>

                {/* Prompt Assembly */}
                <g onClick={() => setSelectedNode('prompt')} className="cursor-pointer">
                  <rect x="315" y="155" width="110" height="50" rx="3" 
                    fill={selectedNode === 'prompt' ? (theme === 'dark' ? '#ffffff' : '#18181b') : (theme === 'dark' ? '#0f0f0f' : '#ffffff')} 
                    stroke={selectedNode === 'prompt' ? (theme === 'dark' ? '#ffffff' : '#18181b') : (theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)')} 
                    strokeWidth="1.5" 
                  />
                  <text x="370" y="180" fill={selectedNode === 'prompt' ? (theme === 'dark' ? '#000000' : '#ffffff') : (theme === 'dark' ? '#8a8a8a' : '#52525b')} textAnchor="middle" className="text-[9px] font-mono tracking-wider font-bold">6. ASSEMBLER</text>
                  <text x="370" y="193" fill={selectedNode === 'prompt' ? (theme === 'dark' ? '#222222' : '#a1a1aa') : (theme === 'dark' ? '#555555' : '#71717a')} textAnchor="middle" className="text-[8px] font-serif italic">Context Injection</text>
                </g>

                {/* LLM */}
                <g onClick={() => setSelectedNode('llm')} className="cursor-pointer">
                  <rect x="165" y="155" width="110" height="50" rx="3" 
                    fill={selectedNode === 'llm' ? (theme === 'dark' ? '#ffffff' : '#18181b') : (theme === 'dark' ? '#0f0f0f' : '#ffffff')} 
                    stroke={selectedNode === 'llm' ? (theme === 'dark' ? '#ffffff' : '#18181b') : (theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)')} 
                    strokeWidth="1.5" 
                  />
                  <text x="220" y="180" fill={selectedNode === 'llm' ? (theme === 'dark' ? '#000000' : '#ffffff') : (theme === 'dark' ? '#8a8a8a' : '#52525b')} textAnchor="middle" className="text-[9px] font-mono tracking-wider font-bold">7. GEMINI LLM</text>
                  <text x="220" y="193" fill={selectedNode === 'llm' ? (theme === 'dark' ? '#222222' : '#a1a1aa') : (theme === 'dark' ? '#555555' : '#71717a')} textAnchor="middle" className="text-[8px] font-serif italic">gemini-3.5-flash</text>
                </g>

                {/* SSE Stream */}
                <g onClick={() => setSelectedNode('sse')} className="cursor-pointer">
                  <rect x="15" y="155" width="110" height="50" rx="3" 
                    fill={selectedNode === 'sse' ? (theme === 'dark' ? '#ffffff' : '#18181b') : (theme === 'dark' ? '#0f0f0f' : '#ffffff')} 
                    stroke={selectedNode === 'sse' ? (theme === 'dark' ? '#ffffff' : '#18181b') : (theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)')} 
                    strokeWidth="1.5" 
                  />
                  <text x="70" y="180" fill={selectedNode === 'sse' ? (theme === 'dark' ? '#000000' : '#ffffff') : (theme === 'dark' ? '#8a8a8a' : '#52525b')} textAnchor="middle" className="text-[9px] font-mono tracking-wider font-bold">8. SSE STREAM</text>
                  <text x="70" y="193" fill={selectedNode === 'sse' ? (theme === 'dark' ? '#222222' : '#a1a1aa') : (theme === 'dark' ? '#555555' : '#71717a')} textAnchor="middle" className="text-[8px] font-serif italic">Token-by-Token</text>
                </g>
              </svg>
            </div>

            {/* Dynamic Node Detail Panel */}
            <div className={`rounded p-4.5 space-y-3.5 border ${
              theme === 'dark' ? 'bg-[#0a0a0a] border-white/5' : 'bg-white border-zinc-200 shadow-sm'
            }`}>
              <div className="flex items-center justify-between">
                <span className={`text-[8px] font-mono tracking-[0.25em] border px-2 py-0.5 rounded uppercase ${
                  theme === 'dark' ? 'text-[#8a8a8a] bg-white/5 border-white/10' : 'text-zinc-500 bg-zinc-100 border-zinc-200'
                }`}>
                  SYSTEM CORE INTERFACES
                </span>
                <span className={`text-[9px] font-mono uppercase tracking-wider ${theme === 'dark' ? 'text-[#555]' : 'text-zinc-400'}`}>NODE ID: {selectedNode}</span>
              </div>
              <div className="space-y-0.5">
                <h4 className={`text-base font-serif italic ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>{nodeDescriptions[selectedNode].title}</h4>
                <p className={`text-[9px] font-mono tracking-wider uppercase ${theme === 'dark' ? 'text-[#8a8a8a]' : 'text-indigo-600'}`}>{nodeDescriptions[selectedNode].subtitle}</p>
              </div>
              <p className={`text-xs leading-relaxed font-serif italic ${theme === 'dark' ? 'text-[#8a8a8a]' : 'text-zinc-600'}`}>{nodeDescriptions[selectedNode].body}</p>
              <div className={`p-3 rounded border font-mono text-[10px] overflow-x-auto select-all ${
                theme === 'dark' ? 'bg-[#121212] border-white/5 text-white' : 'bg-zinc-50 border-zinc-200 text-zinc-800'
              }`}>
                <code className="whitespace-nowrap">{nodeDescriptions[selectedNode].code}</code>
              </div>
            </div>

            {/* Core RAG metrics info */}
            <div className="grid grid-cols-2 gap-3.5">
              <div className={`p-4 rounded border ${theme === 'dark' ? 'bg-[#0f0f0f] border-white/5' : 'bg-white border-zinc-200 shadow-sm'}`}>
                <span className={`text-[9px] uppercase font-mono tracking-[0.15em] block mb-1 ${theme === 'dark' ? 'text-[#555]' : 'text-zinc-400'}`}>Embedding Dimensions</span>
                <span className={`text-sm font-serif italic ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>768 Float32 Dimensions</span>
              </div>
              <div className={`p-4 rounded border ${theme === 'dark' ? 'bg-[#0f0f0f] border-white/5' : 'bg-white border-zinc-200 shadow-sm'}`}>
                <span className={`text-[9px] uppercase font-mono tracking-[0.15em] block mb-1 ${theme === 'dark' ? 'text-[#555]' : 'text-zinc-400'}`}>Similarity Score Range</span>
                <span className={`text-sm font-serif italic ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>[0.00, 1.00] Cosine Index</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'api' && (
          <div className="space-y-5">
            <h3 className={`text-sm font-serif italic ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>Interactive API Reference</h3>
            
            {/* API Endpoints selector */}
            <div className={`flex space-x-1.5 pb-2.5 overflow-x-auto border-b ${theme === 'dark' ? 'border-white/5' : 'border-zinc-200/80'}`}>
              {[
                { id: 'upload', verb: 'POST', path: '/api/files/upload' },
                { id: 'stream', verb: 'POST', path: '/api/chat/stream' },
                { id: 'search', verb: 'POST', path: '/api/dev/search' },
                { id: 'files', verb: 'GET', path: '/api/files' }
              ].map(ep => (
                <button
                  key={ep.id}
                  onClick={() => setSelectedEndpoint(ep.id)}
                  className={`px-3 py-1.5 rounded text-[10px] font-mono whitespace-nowrap transition-all cursor-pointer border ${
                    selectedEndpoint === ep.id 
                      ? theme === 'dark'
                        ? 'bg-[#161616] text-white border-white/15'
                        : 'bg-zinc-900 text-white border-transparent shadow-sm' 
                      : theme === 'dark'
                        ? 'text-[#8a8a8a] hover:text-white border-transparent'
                        : 'text-zinc-500 hover:text-zinc-900 border-transparent'
                  }`}
                >
                  <span className={`mr-1.5 font-bold text-[9px] ${
                    selectedEndpoint === ep.id 
                      ? 'text-white' 
                      : ep.verb === 'POST' ? 'text-indigo-500/90' : 'text-[#8a8a8a]'
                  }`}>
                    {ep.verb}
                  </span>
                  {ep.path}
                </button>
              ))}
            </div>

            {selectedEndpoint === 'upload' && (
              <div className="space-y-3.5 text-xs">
                <div className={`p-4 rounded border space-y-3 ${
                  theme === 'dark' ? 'bg-[#0a0a0a] border-white/5' : 'bg-white border-zinc-200 shadow-sm'
                }`}>
                  <div className="flex justify-between items-center">
                    <span className={`font-serif italic text-sm ${theme === 'dark' ? 'text-white' : 'text-zinc-900 font-bold'}`}>POST /api/files/upload</span>
                    <span className={`text-[9px] font-mono uppercase tracking-widest ${theme === 'dark' ? 'text-[#555]' : 'text-zinc-400'}`}>MULTIPART/FORM-DATA</span>
                  </div>
                  <p className={`font-serif italic leading-relaxed ${theme === 'dark' ? 'text-[#8a8a8a]' : 'text-zinc-600'}`}>Uploads a PDF file, parses its text, runs sliding overlapping chunking, generates embeddings, and indexes them in the vector database.</p>
                  <h4 className={`text-[9px] uppercase tracking-widest font-bold pt-1 ${theme === 'dark' ? 'text-[#555]' : 'text-zinc-400'}`}>Payload Fields:</h4>
                  <ul className={`list-disc pl-4 space-y-1 font-serif italic ${theme === 'dark' ? 'text-[#8a8a8a]' : 'text-zinc-600'}`}>
                    <li><code className={`font-mono text-[10px] px-1 py-0.5 rounded ${theme === 'dark' ? 'text-white bg-white/5' : 'text-zinc-800 bg-zinc-100 border border-zinc-200'}`}>file</code>: PDF file binary (Max 15MB)</li>
                  </ul>
                  <h4 className={`text-[9px] uppercase tracking-widest font-bold pt-1 ${theme === 'dark' ? 'text-[#555]' : 'text-zinc-400'}`}>Response JSON Structure:</h4>
                  <pre className={`p-3.5 rounded border text-[11px] font-mono overflow-x-auto ${
                    theme === 'dark' ? 'bg-[#121212] border-white/5 text-[#d1d1d1]' : 'bg-zinc-50 border-zinc-200 text-zinc-800'
                  }`}>
{`{
  "id": "file_1687640203010",
  "name": "manual.pdf",
  "size": 245102,
  "type": "application/pdf",
  "pageCount": 4,
  "uploadedAt": "2026-06-26T12:28:18.000Z",
  "status": "processing"
}`}
                  </pre>
                </div>
              </div>
            )}

            {selectedEndpoint === 'stream' && (
              <div className="space-y-3.5 text-xs">
                <div className={`p-4 rounded border space-y-3 ${
                  theme === 'dark' ? 'bg-[#0a0a0a] border-white/5' : 'bg-white border-zinc-200 shadow-sm'
                }`}>
                  <div className="flex justify-between items-center">
                    <span className={`font-serif italic text-sm ${theme === 'dark' ? 'text-white' : 'text-zinc-900 font-bold'}`}>POST /api/chat/stream</span>
                    <span className={`text-[9px] font-mono uppercase tracking-widest ${theme === 'dark' ? 'text-[#555]' : 'text-zinc-400'}`}>TEXT/EVENT-STREAM</span>
                  </div>
                  <p className={`font-serif italic leading-relaxed ${theme === 'dark' ? 'text-[#8a8a8a]' : 'text-zinc-600'}`}>Sends a chat question to RAG pipeline. It conducts a semantic vector search first, outputs matching source citations, and streams the synthesized Gemini answer in real time.</p>
                  <h4 className={`text-[9px] uppercase tracking-widest font-bold pt-1 ${theme === 'dark' ? 'text-[#555]' : 'text-zinc-400'}`}>Request Body JSON:</h4>
                  <pre className={`p-3.5 rounded border text-[11px] font-mono overflow-x-auto ${
                    theme === 'dark' ? 'bg-[#121212] border-white/5 text-white' : 'bg-zinc-50 border-zinc-200 text-zinc-800'
                  }`}>
{`{
  "sessionId": "session_1687640203200",
  "message": "What is the warranty period of this device?"
}`}
                  </pre>
                  <h4 className={`text-[9px] uppercase tracking-widest font-bold pt-1 ${theme === 'dark' ? 'text-[#555]' : 'text-zinc-400'}`}>SSE Stream Events Flow:</h4>
                  <div className={`space-y-2 font-mono text-[10px] p-3.5 rounded border overflow-x-auto ${
                    theme === 'dark' ? 'bg-[#121212] border-white/5 text-[#d1d1d1]' : 'bg-zinc-50 border-zinc-200 text-zinc-700'
                  }`}>
                    <div><span className={theme === 'dark' ? 'text-white font-bold' : 'text-zinc-950 font-bold'}>event: sources</span> - Returns list of retrieved Top-K chunks</div>
                    <div><span className={theme === 'dark' ? 'text-white font-bold' : 'text-zinc-950 font-bold'}>event: token</span> - Streams individual synthesized word tokens</div>
                    <div><span className={theme === 'dark' ? 'text-white font-bold' : 'text-zinc-950 font-bold'}>event: done</span> - Returns completed structured session details</div>
                  </div>
                </div>
              </div>
            )}

            {selectedEndpoint === 'search' && (
              <div className="space-y-3.5 text-xs">
                <div className={`p-4 rounded border space-y-3 ${
                  theme === 'dark' ? 'bg-[#0a0a0a] border-white/5' : 'bg-white border-zinc-200 shadow-sm'
                }`}>
                  <div className="flex justify-between items-center">
                    <span className={`font-serif italic text-sm ${theme === 'dark' ? 'text-white' : 'text-zinc-900 font-bold'}`}>POST /api/dev/search</span>
                    <span className={`text-[9px] font-mono uppercase tracking-widest ${theme === 'dark' ? 'text-[#555]' : 'text-zinc-400'}`}>APPLICATION/JSON</span>
                  </div>
                  <p className={`font-serif italic leading-relaxed ${theme === 'dark' ? 'text-[#8a8a8a]' : 'text-zinc-600'}`}>A developer API to query raw document embeddings in the vector index directly, calculating Cosine Similarity.</p>
                  <h4 className={`text-[9px] uppercase tracking-widest font-bold pt-1 ${theme === 'dark' ? 'text-[#555]' : 'text-zinc-400'}`}>Request Body JSON:</h4>
                  <pre className={`p-3.5 rounded border text-[11px] font-mono overflow-x-auto ${
                    theme === 'dark' ? 'bg-[#121212] border-white/5 text-white' : 'bg-zinc-50 border-zinc-200 text-zinc-800'
                  }`}>
{`{
  "query": "solar orbit details",
  "documentIds": ["file_1687640203010"] // Optional filter
}`}
                  </pre>
                </div>
              </div>
            )}

            {selectedEndpoint === 'files' && (
              <div className="space-y-3.5 text-xs">
                <div className={`p-4 rounded border space-y-3 ${
                  theme === 'dark' ? 'bg-[#0a0a0a] border-white/5' : 'bg-white border-zinc-200 shadow-sm'
                }`}>
                  <div className="flex justify-between items-center">
                    <span className={`font-serif italic text-sm ${theme === 'dark' ? 'text-white' : 'text-zinc-900 font-bold'}`}>GET /api/files</span>
                    <span className={`text-[9px] font-mono uppercase tracking-widest ${theme === 'dark' ? 'text-[#555]' : 'text-zinc-400'}`}>APPLICATION/JSON</span>
                  </div>
                  <p className={`font-serif italic leading-relaxed ${theme === 'dark' ? 'text-[#8a8a8a]' : 'text-zinc-600'}`}>Retrieves the metadata status for all uploaded and parsed documents.</p>
                  <h4 className={`text-[9px] uppercase tracking-widest font-bold pt-1 ${theme === 'dark' ? 'text-[#555]' : 'text-zinc-400'}`}>Response JSON Array:</h4>
                  <pre className={`p-3.5 rounded border text-[11px] font-mono overflow-x-auto ${
                    theme === 'dark' ? 'bg-[#121212] border-white/5 text-[#d1d1d1]' : 'bg-zinc-50 border-zinc-200 text-zinc-800'
                  }`}>
{`[
  {
    "id": "file_1687640203010",
    "name": "manual.pdf",
    "size": 245102,
    "pageCount": 4,
    "uploadedAt": "2026-06-26T12:28:18.000Z",
    "status": "ready",
    "chunkCount": 24
  }
]`}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'inspector' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h3 className={`text-sm font-serif italic ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>Vector Database Inspector</h3>
              <button
                onClick={resetDB}
                className={`px-3 py-1.5 text-[9px] font-mono tracking-widest rounded transition-all flex items-center space-x-1.5 cursor-pointer uppercase border ${
                  theme === 'dark'
                    ? 'text-[#ff6b6b] border-[#ff6b6b]/20 hover:border-[#ff6b6b]/40 hover:bg-[#ff6b6b]/5'
                    : 'text-red-600 border-red-200 hover:border-red-400 hover:bg-red-50 bg-white shadow-sm'
                }`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>System Wipe</span>
              </button>
            </div>

            {/* Custom vector tester form */}
            <div className={`p-4.5 rounded border space-y-4 ${
              theme === 'dark' ? 'bg-[#0a0a0a] border-white/5' : 'bg-white border-zinc-200 shadow-sm'
            }`}>
              <span className={`text-[9px] uppercase tracking-[0.2em] font-bold ${theme === 'dark' ? 'text-[#555]' : 'text-zinc-400'}`}>Query Embedding Tester</span>
              
              {files.length === 0 ? (
                <p className={`text-xs font-serif italic ${theme === 'dark' ? 'text-[#8a8a8a]' : 'text-zinc-500'}`}>Upload a PDF to make the database active and run test queries.</p>
              ) : (
                <div className="space-y-4">
                  {/* Select filters */}
                  <div className="space-y-2">
                    <span className={`text-[9px] font-mono tracking-wider uppercase ${theme === 'dark' ? 'text-[#8a8a8a]' : 'text-zinc-500'}`}>Restrict to document(s):</span>
                    <div className="flex flex-wrap gap-1.5">
                      {files.map(file => {
                        const isSelected = selectedDocs.includes(file.id);
                        return (
                          <button
                            key={file.id}
                            onClick={() => handleDocToggle(file.id)}
                            className={`px-2 py-1 rounded text-[9px] font-mono uppercase tracking-wider border transition-all cursor-pointer ${
                              isSelected
                                ? theme === 'dark'
                                  ? 'bg-[#161616] text-white border-white/35'
                                  : 'bg-zinc-900 text-white border-transparent shadow-sm'
                                : theme === 'dark'
                                  ? 'bg-transparent text-[#555] border-white/5 hover:text-[#8a8a8a]'
                                  : 'bg-zinc-50 text-zinc-400 border-zinc-200 hover:text-zinc-700'
                            }`}
                          >
                            {file.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={rawQuery}
                      onChange={(e) => setRawQuery(e.target.value)}
                      placeholder="Type a query string to find matching chunks..."
                      className={`flex-1 text-xs px-3.5 py-2.5 rounded border font-mono transition-all focus:outline-none ${
                        theme === 'dark'
                          ? 'bg-[#121212] text-white border-white/5 focus:border-white/20'
                          : 'bg-white text-zinc-900 border-zinc-200 focus:border-zinc-400 shadow-inner'
                      }`}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') runVectorSearch();
                      }}
                    />
                    <button
                      onClick={runVectorSearch}
                      disabled={isSearching || !rawQuery.trim()}
                      className={`px-4 py-2.5 text-xs font-semibold rounded transition-colors flex items-center space-x-1.5 cursor-pointer shrink-0 disabled:opacity-35 ${
                        theme === 'dark'
                          ? 'bg-white hover:bg-[#e1e1e1] text-black'
                          : 'bg-zinc-900 hover:bg-zinc-800 text-white shadow-sm'
                      }`}
                    >
                      {isSearching ? (
                        <div className={`w-3.5 h-3.5 border-2 rounded-full animate-spin ${
                          theme === 'dark' ? 'border-black/30 border-t-black' : 'border-white/30 border-t-white'
                        }`} />
                      ) : (
                        <Search className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Results list */}
            {searchResults.length > 0 && (
              <div className="space-y-3.5">
                <span className={`text-[9px] uppercase tracking-[0.2em] font-bold ${theme === 'dark' ? 'text-[#555]' : 'text-zinc-400'}`}>Matches ({searchResults.length})</span>
                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                  {searchResults.map((result, idx) => (
                    <div key={result.chunk.id} className={`border rounded p-4 space-y-3 text-xs ${
                      theme === 'dark' ? 'bg-[#0a0a0a] border-white/5' : 'bg-white border-zinc-200 shadow-sm'
                    }`}>
                      <div className="flex items-center justify-between">
                        <span className={`font-mono font-bold tracking-wider uppercase text-[9px] ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>MATCH #{idx + 1}</span>
                        <span className={`font-mono border px-2 py-0.5 rounded text-[9px] uppercase ${
                          theme === 'dark' ? 'text-white border-white/10' : 'text-zinc-700 border-zinc-200 bg-zinc-50'
                        }`}>
                          SIMILARITY: {result.similarity.toFixed(4)}
                        </span>
                      </div>
                      <p className={`font-serif italic text-xs leading-relaxed p-3.5 rounded border ${
                        theme === 'dark' ? 'text-[#d1d1d1] bg-[#121212] border-white/5' : 'text-zinc-800 bg-zinc-50 border-zinc-200 shadow-inner'
                      }`}>
                        "{result.chunk.text}"
                      </p>
                      <div className={`flex items-center justify-between text-[9px] font-mono uppercase tracking-wider pt-1 ${
                        theme === 'dark' ? 'text-[#555]' : 'text-zinc-400'
                      }`}>
                        <span>Doc: {result.chunk.documentName}</span>
                        <span>Page {result.chunk.pageIndex} • Chunk {result.chunk.chunkIndex}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'insights' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-zinc-200/50 dark:border-white/5">
              <div>
                <h3 className={`text-sm font-serif italic ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>AI Document Insights</h3>
                <p className={`text-[10px] mt-0.5 ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400'}`}>Generate automated overviews and questions via Gemini</p>
              </div>
              
              {/* Document selection dropdown */}
              {files.filter(f => f.status === 'ready').length > 0 && (
                <select
                  value={selectedSummaryFileId}
                  onChange={(e) => setSelectedSummaryFileId(e.target.value)}
                  className={`text-xs px-2.5 py-1.5 rounded border focus:outline-none cursor-pointer max-w-[200px] truncate font-serif italic ${
                    theme === 'dark'
                      ? 'bg-[#121212] text-white border-white/10 focus:border-white/20'
                      : 'bg-white text-zinc-800 border-zinc-200 focus:border-zinc-400 shadow-xs'
                  }`}
                >
                  <option value="" disabled>Select Document...</option>
                  {files.filter(f => f.status === 'ready').map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              )}
            </div>

            {(() => {
              const file = files.find(f => f.id === selectedSummaryFileId);
              if (!selectedSummaryFileId || !file) {
                return (
                  <div className={`p-8 text-center rounded border border-dashed flex flex-col items-center justify-center space-y-3 ${
                    theme === 'dark' ? 'bg-[#0e0e0e]/50 border-white/5' : 'bg-zinc-50/50 border-zinc-200'
                  }`}>
                    <FileText className={`w-8 h-8 opacity-30 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`} />
                    <p className={`text-xs font-serif italic ${theme === 'dark' ? 'text-[#8a8a8a]' : 'text-zinc-500'}`}>
                      {files.length === 0 ? "Upload a document to view AI Insights." : "Select an indexed document to begin."}
                    </p>
                  </div>
                );
              }

              // File is ready, check if summary is generated
              if (file.summary) {
                const s = file.summary;
                return (
                  <div className="space-y-6">
                    {/* Overview */}
                    <div className="space-y-2">
                      <span className={`text-[9px] uppercase tracking-[0.2em] font-mono font-bold block ${theme === 'dark' ? 'text-[#8a8a8a]' : 'text-zinc-400'}`}>
                        Document Overview
                      </span>
                      <p className={`text-xs md:text-sm leading-relaxed font-serif p-4 rounded-md border ${
                        theme === 'dark' ? 'text-[#d1d1d1] bg-[#121212]/40 border-white/5' : 'text-zinc-800 bg-zinc-50 border-zinc-200 shadow-inner'
                      }`}>
                        {s.overview}
                      </p>
                    </div>

                    {/* Key Highlights */}
                    <div className="space-y-2.5">
                      <span className={`text-[9px] uppercase tracking-[0.2em] font-mono font-bold block ${theme === 'dark' ? 'text-[#8a8a8a]' : 'text-zinc-400'}`}>
                        Key Highlights
                      </span>
                      <ul className="space-y-2">
                        {s.highlights.map((highlight, index) => (
                          <li
                            key={index}
                            className={`flex items-start text-xs leading-relaxed p-2.5 rounded border ${
                              theme === 'dark' 
                                ? 'bg-[#0f0f0f] border-white/5 text-[#d1d1d1]' 
                                : 'bg-white border-zinc-150 text-zinc-800 shadow-2xs'
                            }`}
                          >
                            <CheckCircle className="w-4 h-4 text-emerald-500 mr-2.5 shrink-0 mt-0.5" />
                            <span>{highlight}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Suggested Questions */}
                    <div className="space-y-3 pt-2">
                      <div>
                        <span className={`text-[9px] uppercase tracking-[0.2em] font-mono font-bold block ${theme === 'dark' ? 'text-[#8a8a8a]' : 'text-zinc-400'}`}>
                          Suggested Interactive Queries
                        </span>
                        <span className="text-[9px] text-zinc-400 dark:text-zinc-500 block mt-0.5">Click any question below to immediately send it to the active chat thread</span>
                      </div>
                      
                      <div className="flex flex-col gap-2">
                        {s.suggestedQuestions.map((question, index) => (
                          <button
                            key={index}
                            onClick={() => onAskQuestion && onAskQuestion(question)}
                            className={`group text-left px-4 py-3 rounded text-xs transition-all border font-serif italic cursor-pointer flex items-center justify-between ${
                              theme === 'dark'
                                ? 'bg-[#121212] hover:bg-white hover:text-black border-white/5 hover:border-white text-[#d1d1d1]'
                                : 'bg-white hover:bg-zinc-950 hover:text-white border-zinc-200 hover:border-zinc-950 text-zinc-700 shadow-sm'
                            }`}
                          >
                            <span className="flex-1 pr-4">{question}</span>
                            <ArrowRight className="w-3.5 h-3.5 shrink-0 transform transition-transform group-hover:translate-x-1" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              }

              // No summary, check if summary is currently generating
              const handleTriggerSummary = async () => {
                if (!onGenerateSummary) return;
                setIsGeneratingSummary(true);
                try {
                  await onGenerateSummary(file.id);
                } finally {
                  setIsGeneratingSummary(false);
                }
              };

              return (
                <div className={`p-8 rounded border text-center flex flex-col items-center justify-center space-y-4 ${
                  theme === 'dark' ? 'bg-[#121212]/30 border-white/5' : 'bg-zinc-50/50 border-zinc-200'
                }`}>
                  {isGeneratingSummary ? (
                    <div className="flex flex-col items-center space-y-3.5 py-4">
                      <RefreshCw className="w-7 h-7 text-amber-500 animate-spin" />
                      <div className="space-y-1">
                        <p className={`text-xs font-serif font-bold ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>Analyzing PDF Chunks...</p>
                        <p className={`text-[10px] ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400'}`}>Synthesizing text using gemini-3.5-flash...</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4 max-w-sm mx-auto">
                      <Sparkles className="w-8 h-8 text-amber-500 mx-auto" />
                      <div className="space-y-1.5">
                        <h4 className={`text-xs font-serif italic font-bold ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>Generate AI Insights</h4>
                        <p className={`text-[11px] leading-relaxed ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>
                          Process <strong>{file.name}</strong> to produce a high-level executive summary, key semantic highlights, and customized sample Q&A questions.
                        </p>
                      </div>
                      <button
                        onClick={handleTriggerSummary}
                        className={`px-4 py-2 text-xs font-semibold rounded transition-all flex items-center space-x-2 mx-auto cursor-pointer border ${
                          theme === 'dark'
                            ? 'bg-white hover:bg-zinc-100 text-black border-transparent shadow-sm'
                            : 'bg-zinc-900 hover:bg-zinc-800 text-white border-transparent shadow-md'
                        }`}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Generate Highlights</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
