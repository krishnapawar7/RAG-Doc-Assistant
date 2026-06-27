import React, { useRef, useState } from 'react';
import { UploadCloud, FileText, Trash2, Plus, MessageSquare, CheckSquare, Square, AlertCircle, RefreshCw, X, Pencil, Check } from 'lucide-react';
import { UploadedFile, ChatSession } from '../types';

interface SidebarProps {
  files: UploadedFile[];
  sessions: ChatSession[];
  activeSessionId: string | null;
  selectedDocIds: string[];
  onUpload: (file: File) => Promise<void>;
  onDeleteFile: (id: string) => Promise<void>;
  onSelectDoc: (id: string) => void;
  onSelectAllDocs: () => void;
  onDeselectAllDocs: () => void;
  onCreateSession: (title?: string) => Promise<void>;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => Promise<void>;
  onRenameSession?: (id: string, newTitle: string) => Promise<void>;
  theme: 'dark' | 'light';
  onClose?: () => void;
}

export default function Sidebar({
  files,
  sessions,
  activeSessionId,
  selectedDocIds,
  onUpload,
  onDeleteFile,
  onSelectDoc,
  onSelectAllDocs,
  onDeselectAllDocs,
  onCreateSession,
  onSelectSession,
  onDeleteSession,
  onRenameSession,
  theme,
  onClose
}: SidebarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState<string>('');

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
      setIsUploading(true);
      await onUpload(file);
      setIsUploading(false);
    } else {
      alert('Only PDF files are supported!');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      await onUpload(file);
      setIsUploading(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className={`w-full lg:w-80 flex flex-col h-full overflow-hidden shrink-0 ${
      theme === 'dark' 
        ? 'bg-[#0f0f0f] border-r border-white/5 text-[#d1d1d1]' 
        : 'bg-white border-r border-zinc-200 shadow-sm text-zinc-700'
    }`}>
      {/* Title */}
      <div className={`p-5 border-b shrink-0 flex items-center justify-between ${theme === 'dark' ? 'border-white/5' : 'border-zinc-200/60'}`}>
        <div className="flex items-center space-x-3">
          <div className={`w-8 h-8 rounded-full border flex items-center justify-center text-[11px] font-serif italic shrink-0 ${
            theme === 'dark' ? 'border-white/20 text-white' : 'border-zinc-300 text-zinc-900 bg-zinc-50'
          }`}>
            R
          </div>
          <div>
            <h1 className={`text-base font-serif italic tracking-tight leading-none ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>RAG Document Assistant</h1>
            <span className={`text-[9px] font-medium uppercase tracking-[0.2em] font-mono block mt-1 ${theme === 'dark' ? 'text-[#8a8a8a]' : 'text-zinc-500'}`}>Gemini 3.5 & Embed-2</span>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className={`lg:hidden p-1.5 rounded-md border transition-all cursor-pointer ${
              theme === 'dark'
                ? 'border-white/10 text-zinc-400 hover:text-white hover:bg-white/5'
                : 'border-zinc-200 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 shadow-sm'
            }`}
            title="Close Sidebar"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Main Sections */}
      <div className="flex-1 overflow-y-auto p-5 space-y-7">
        
        {/* Document Ingestion Panel */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-bold uppercase tracking-[0.25em] ${theme === 'dark' ? 'text-[#8a8a8a]' : 'text-zinc-500'}`}>Ingested Documents</span>
            <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full border ${
              theme === 'dark' ? 'bg-white/5 text-[#d1d1d1] border-white/10' : 'bg-zinc-100 text-zinc-600 border-zinc-200'
            }`}>
              {files.length} Total
            </span>
          </div>

          {/* Drag and Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border border-dashed rounded-lg p-5 text-center cursor-pointer transition-all duration-300 flex flex-col items-center justify-center space-y-2.5 ${
              theme === 'dark'
                ? isDragging
                  ? 'border-white bg-white/5'
                  : 'border-white/10 hover:border-white/30 bg-[#161616]/30 hover:bg-[#161616]/80'
                : isDragging
                  ? 'border-zinc-900 bg-zinc-100'
                  : 'border-zinc-300 hover:border-zinc-400 bg-zinc-50/50 hover:bg-[#161616]/5'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="application/pdf"
              className="hidden"
            />
            <UploadCloud className={`w-7 h-7 ${
              isDragging 
                ? theme === 'dark' ? 'text-white animate-pulse' : 'text-zinc-900 animate-pulse'
                : theme === 'dark' ? 'text-[#8a8a8a]' : 'text-zinc-400'
            }`} />
            <div className="space-y-1">
              <p className={`text-xs font-serif italic ${theme === 'dark' ? 'text-[#d1d1d1]' : 'text-zinc-700'}`}>Click or drag PDF here</p>
              <p className={`text-[9px] tracking-wide ${theme === 'dark' ? 'text-[#555]' : 'text-zinc-400'}`}>Supports files up to 15MB</p>
            </div>
            {isUploading && (
              <div className={`flex items-center space-x-1.5 text-[10px] font-medium animate-pulse pt-1 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>
                <RefreshCw className={`w-3 h-3 animate-spin ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`} />
                <span className="font-mono tracking-wider">INDEXING...</span>
              </div>
            )}
          </div>

          {/* List of Files */}
          {files.length > 0 && (
            <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
              {/* Document selection helpers */}
              <div className={`flex items-center justify-between text-[9px] font-semibold uppercase tracking-[0.15em] px-1 shrink-0 pb-1.5 border-b ${
                theme === 'dark' ? 'text-[#555] border-white/5' : 'text-zinc-400 border-zinc-200'
              }`}>
                <span>Scope:</span>
                <div className="flex space-x-2.5 font-bold">
                  <button onClick={onSelectAllDocs} className={`transition-colors ${theme === 'dark' ? 'hover:text-white' : 'hover:text-zinc-900'}`}>All</button>
                  <span className="opacity-35">•</span>
                  <button onClick={onDeselectAllDocs} className={`transition-colors ${theme === 'dark' ? 'hover:text-white' : 'hover:text-zinc-900'}`}>None</button>
                </div>
              </div>

              {files.map((file) => {
                const isSelected = selectedDocIds.includes(file.id);
                return (
                  <div
                    key={file.id}
                    className={`flex items-start justify-between p-2.5 rounded-md border transition-all duration-300 ${
                      theme === 'dark'
                        ? isSelected 
                          ? 'bg-white/5 border-white/20' 
                          : 'bg-[#121212]/40 border-white/5 hover:bg-[#121212]/80 hover:border-white/10'
                        : isSelected
                          ? 'bg-zinc-100 border-zinc-300 text-zinc-900'
                          : 'bg-white border-zinc-200 hover:bg-zinc-50 hover:border-zinc-300'
                    }`}
                  >
                    <div className="flex items-start space-x-2.5 min-w-0 flex-1">
                      {/* Active state toggle box */}
                      <button
                        onClick={() => file.status === 'ready' && onSelectDoc(file.id)}
                        disabled={file.status !== 'ready'}
                        className={`mt-0.5 disabled:opacity-20 transition-colors ${
                          theme === 'dark' ? 'text-[#555] hover:text-white' : 'text-zinc-400 hover:text-zinc-950'
                        }`}
                      >
                        {isSelected ? (
                          <CheckSquare className={`w-3.5 h-3.5 ${theme === 'dark' ? 'text-white fill-white/10' : 'text-zinc-800 fill-zinc-900/10'}`} />
                        ) : (
                          <Square className="w-3.5 h-3.5" />
                        )}
                      </button>

                      <div className="min-w-0 flex-1">
                        <p className={`text-xs font-serif truncate pr-1 ${theme === 'dark' ? 'text-[#d1d1d1]' : 'text-zinc-800'}`} title={file.name}>
                          {file.name}
                        </p>
                        <div className={`flex items-center space-x-2 text-[9px] font-mono mt-0.5 ${theme === 'dark' ? 'text-[#666]' : 'text-zinc-400'}`}>
                          <span>{formatSize(file.size)}</span>
                          <span className="opacity-40">•</span>
                          {file.status === 'processing' && (
                            <span className="text-amber-500/85 animate-pulse flex items-center space-x-1">
                              <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                              <span className="uppercase tracking-widest text-[8px]">Parsing...</span>
                            </span>
                          )}
                          {file.status === 'ready' && (
                            <span className={theme === 'dark' ? 'text-[#8a8a8a]' : 'text-zinc-500'}>{file.pageCount} pages</span>
                          )}
                          {file.status === 'error' && (
                            <span className="text-red-400 flex items-center space-x-1" title={file.error}>
                              <AlertCircle className="w-2.5 h-2.5" />
                              <span className="uppercase tracking-widest text-[8px]">Failed</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => onDeleteFile(file.id)}
                      className={`p-1 rounded transition-colors ml-1 ${theme === 'dark' ? 'text-[#555] hover:text-red-400' : 'text-zinc-400 hover:text-red-600'}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Conversation Sessions List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-bold uppercase tracking-[0.25em] ${theme === 'dark' ? 'text-[#8a8a8a]' : 'text-zinc-500'}`}>Conversations</span>
            <button
              onClick={() => onCreateSession()}
              className={`px-2 py-1 border text-[9px] uppercase tracking-[0.2em] rounded transition-all flex items-center space-x-1 cursor-pointer ${
                theme === 'dark'
                  ? 'border-white/10 hover:border-white/30 hover:bg-white/5 text-[#d1d1d1] hover:text-white'
                  : 'border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 text-zinc-600 hover:text-zinc-900'
              }`}
              title="New Conversation"
            >
              <Plus className={`w-3 h-3 ${theme === 'dark' ? 'text-white' : 'text-zinc-800'}`} />
              <span>New</span>
            </button>
          </div>

          <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
            {sessions.length === 0 ? (
              <p className={`text-xs italic px-1 ${theme === 'dark' ? 'text-[#555]' : 'text-zinc-400'}`}>No sessions. Click "New" to start.</p>
            ) : (
              sessions.map((session) => {
                const isActive = session.id === activeSessionId;
                const isEditing = session.id === editingSessionId;

                const handleSaveEdit = async (e: React.MouseEvent | React.KeyboardEvent) => {
                  e.stopPropagation();
                  if (editTitle.trim() && onRenameSession) {
                    await onRenameSession(session.id, editTitle.trim());
                  }
                  setEditingSessionId(null);
                };

                const handleStartEdit = (e: React.MouseEvent) => {
                  e.stopPropagation();
                  setEditingSessionId(session.id);
                  setEditTitle(session.title);
                };

                return (
                  <div
                    key={session.id}
                    onClick={() => onSelectSession(session.id)}
                    className={`group flex items-center justify-between p-2.5 rounded-md cursor-pointer transition-all duration-300 ${
                      isActive
                        ? theme === 'dark'
                          ? 'bg-white text-black font-semibold shadow-sm'
                          : 'bg-zinc-900 text-white font-semibold shadow-sm'
                        : theme === 'dark'
                          ? 'text-[#8a8a8a] hover:text-[#d1d1d1] hover:bg-[#121212]/60 border border-transparent hover:border-white/5'
                          : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100/50 border border-transparent hover:border-zinc-200'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                      <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${
                        isActive 
                          ? theme === 'dark' ? 'text-black' : 'text-white'
                          : theme === 'dark' ? 'text-[#555]' : 'text-zinc-400'
                      }`} />
                      
                      {isEditing ? (
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit(e);
                            if (e.key === 'Escape') setEditingSessionId(null);
                          }}
                          className={`text-xs px-1.5 py-0.5 rounded border focus:outline-none w-full font-sans ${
                            theme === 'dark'
                              ? 'bg-zinc-800 text-white border-zinc-700'
                              : 'bg-white text-zinc-900 border-zinc-300'
                          }`}
                          autoFocus
                        />
                      ) : (
                        <p 
                          onDoubleClick={handleStartEdit}
                          className={`text-xs truncate flex-1 leading-tight ${isActive ? '' : 'font-serif italic'}`}
                        >
                          {session.title}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center space-x-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      {isEditing ? (
                        <button
                          onClick={handleSaveEdit}
                          className={`p-1 rounded ${
                            isActive
                              ? theme === 'dark' ? 'hover:bg-black/10 text-black' : 'hover:bg-white/10 text-white'
                              : theme === 'dark' ? 'hover:bg-[#1a1a1a] text-emerald-400' : 'hover:bg-zinc-200 text-emerald-600'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={handleStartEdit}
                            title="Rename Session"
                            className={`p-1 rounded ${
                              isActive 
                                ? theme === 'dark' 
                                  ? 'hover:bg-black/10 text-black/60 hover:text-black' 
                                  : 'hover:bg-white/10 text-white/60 hover:text-white'
                                : theme === 'dark' 
                                  ? 'hover:bg-[#1a1a1a] text-[#555] hover:text-[#d1d1d1]' 
                                  : 'hover:bg-zinc-200 text-zinc-400 hover:text-zinc-700'
                            }`}
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteSession(session.id);
                            }}
                            title="Delete Session"
                            className={`p-1 rounded ${
                              isActive 
                                ? theme === 'dark' 
                                  ? 'hover:bg-black/10 text-black/60 hover:text-black' 
                                  : 'hover:bg-white/10 text-white/60 hover:text-white'
                                : theme === 'dark' 
                                  ? 'hover:bg-[#1a1a1a] text-[#555] hover:text-red-400' 
                                  : 'hover:bg-zinc-200 text-zinc-400 hover:text-red-600'
                            }`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
