import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import ArchitectureDoc from './components/ArchitectureDoc';
import { UploadedFile, ChatSession, SearchResult, ChatMessage } from './types';
import { Database, Activity, Terminal, Menu } from 'lucide-react';

export default function App() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [showConsole, setShowConsole] = useState<boolean>(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);

  // Theme state supporting dark & light modes
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('theme') as 'dark' | 'light') || 'dark';
  });

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
  };

  // Streaming states
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamedText, setStreamedText] = useState('');
  const [activeSources, setActiveSources] = useState<SearchResult[]>([]);

  // 1. Load initial files and sessions
  const loadFiles = async () => {
    try {
      const res = await fetch('/api/files');
      if (res.ok) {
        const data = await res.json();
        setFiles(data);
      }
    } catch (err) {
      console.error('Error loading files:', err);
    }
  };

  const loadSessions = async () => {
    try {
      const res = await fetch('/api/sessions');
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
        
        // Auto select first session if none active and sessions exist
        if (data.length > 0 && !activeSessionId) {
          const firstSession = data[0];
          setActiveSessionId(firstSession.id);
          setSelectedDocIds(firstSession.documentIds || []);
        }
      }
    } catch (err) {
      console.error('Error loading sessions:', err);
    }
  };

  useEffect(() => {
    loadFiles();
    loadSessions();
  }, []);

  // 2. Poll file statuses if there is a file in "processing"
  useEffect(() => {
    const hasProcessing = files.some(f => f.status === 'processing');
    if (!hasProcessing) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/files');
        if (res.ok) {
          const data = await res.json();
          setFiles(data);
          
          // If any file just transitioned to 'ready', we might want to refresh sessions/DB info
          const anyFinished = data.some((f: UploadedFile) => {
            const old = files.find(o => o.id === f.id);
            return f.status === 'ready' && old?.status === 'processing';
          });
          if (anyFinished) {
            console.log('Document indexing finished.');
          }
        }
      } catch (err) {
        console.error(err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [files]);

  // 3. Document operations
  const handleUpload = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const res = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        const newFile = await res.json();
        setFiles(prev => [...prev, newFile]);
        // Auto select this file for querying
        setSelectedDocIds(prev => [...prev, newFile.id]);
        
        // If an active session is loaded, bind the document to it too
        if (activeSessionId) {
          updateSessionBindings(activeSessionId, [...selectedDocIds, newFile.id]);
        }
      } else {
        const text = await res.text();
        console.error('Upload response error body:', text);
        let errorMsg = 'Upload failed';
        try {
          const parsed = JSON.parse(text);
          errorMsg = parsed.error || errorMsg;
        } catch (_) {
          errorMsg = `Upload failed (Status ${res.status}): ${text.slice(0, 100)}`;
        }
        alert(errorMsg);
      }
    } catch (err) {
      console.error('Upload failed:', err);
      alert('Upload failed due to a network error.');
    }
  };

  const handleDeleteFile = async (id: string) => {
    try {
      const res = await fetch(`/api/files/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setFiles(prev => prev.filter(f => f.id !== id));
        setSelectedDocIds(prev => prev.filter(fId => fId !== id));
        
        // Unbind from session as well
        if (activeSessionId) {
          updateSessionBindings(activeSessionId, selectedDocIds.filter(fId => fId !== id));
        }
      }
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handleSelectDoc = (id: string) => {
    const updated = selectedDocIds.includes(id)
      ? selectedDocIds.filter(fId => fId !== id)
      : [...selectedDocIds, id];
    
    setSelectedDocIds(updated);
    if (activeSessionId) {
      updateSessionBindings(activeSessionId, updated);
    }
  };

  const handleSelectAllDocs = () => {
    const allIds = files.filter(f => f.status === 'ready').map(f => f.id);
    setSelectedDocIds(allIds);
    if (activeSessionId) {
      updateSessionBindings(activeSessionId, allIds);
    }
  };

  const handleDeselectAllDocs = () => {
    setSelectedDocIds([]);
    if (activeSessionId) {
      updateSessionBindings(activeSessionId, []);
    }
  };

  // Helper: Synchronize selected document bindings back to the current active session on the backend
  const updateSessionBindings = async (sessionId: string, docIds: string[]) => {
    // Local state sync first
    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, documentIds: docIds } : s));
  };

  // 4. Session operations
  const handleCreateSession = async (title?: string) => {
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title || `Conversation #${sessions.length + 1}`,
          documentIds: selectedDocIds
        })
      });
      if (res.ok) {
        const data = await res.json();
        setSessions(prev => [data, ...prev]);
        setActiveSessionId(data.id);
        setSelectedDocIds(data.documentIds || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelectSession = (id: string) => {
    setActiveSessionId(id);
    const session = sessions.find(s => s.id === id);
    if (session) {
      setSelectedDocIds(session.documentIds || []);
    }
  };

  const handleDeleteSession = async (id: string) => {
    try {
      const res = await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setSessions(prev => prev.filter(s => s.id !== id));
        if (activeSessionId === id) {
          setActiveSessionId(null);
          setSelectedDocIds([]);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // 5. Question-Answering SSE streaming handler
  const handleSendMessage = async (text: string) => {
    if (!activeSessionId || isStreaming) return;

    setIsStreaming(true);
    setStreamedText('');
    setActiveSources([]);

    // Optimistically insert user message in local state
    const tempUserMsg: ChatMessage = {
      id: 'temp_user_msg_' + Date.now(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString()
    };
    
    setSessions(prev => prev.map(s => {
      if (s.id === activeSessionId) {
        return {
          ...s,
          messages: [...s.messages, tempUserMsg]
        };
      }
      return s;
    }));

    try {
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: activeSessionId,
          message: text
        })
      });

      if (!response.body) {
        throw new Error('ReadableStream not supported or empty body.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let currentEvent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // keep trailing unfinished line

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          // Parse SSE event and data lines
          if (trimmed.startsWith('event:')) {
            currentEvent = trimmed.slice(6).trim();
          } else if (trimmed.startsWith('data:')) {
            const rawData = trimmed.slice(5).trim();
            
            // Check which chunk it was based on the active event state
            if (currentEvent === 'sources') {
              try {
                const parsedSources = JSON.parse(rawData);
                setActiveSources(parsedSources);
              } catch (e) {
                console.error('Error parsing sources:', e);
              }
            } else if (currentEvent === 'token') {
              try {
                const parsedToken = JSON.parse(rawData);
                setStreamedText(prev => prev + (parsedToken.text || ''));
              } catch (e) {
                console.error('Error parsing token:', e);
              }
            } else if (currentEvent === 'done') {
              // Generation successfully completed, replace temp list with final backend output
              try {
                const parsedResult = JSON.parse(rawData);
                setSessions(prev => prev.map(s => {
                  if (s.id === activeSessionId) {
                    // Filter out the temp user message and insert final parsed user/assistant message pair
                    const cleanMessages = s.messages.filter(m => m.id !== tempUserMsg.id);
                    return {
                      ...s,
                      messages: [...cleanMessages, parsedResult.userMessage, parsedResult.assistantMessage]
                    };
                  }
                  return s;
                }));
              } catch (e) {
                console.error('Error parsing done payload:', e);
              }
            } else if (currentEvent === 'error') {
              try {
                const parsedErr = JSON.parse(rawData);
                alert(`Query Error: ${parsedErr.error}`);
              } catch (e) {
                console.error('Error parsing stream error:', e);
              }
            }
          }
        }
      }

    } catch (err: any) {
      console.error('Stream reader failed:', err);
      alert(`Chat Generation Failed: ${err.message || 'Network error'}`);
    } finally {
      setIsStreaming(false);
      setStreamedText('');
      setActiveSources([]);
      // Reload sessions to synchronize fully
      loadSessions();
    }
  };

  const handleRenameSession = async (id: string, newTitle: string) => {
    try {
      const res = await fetch(`/api/sessions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle })
      });
      if (res.ok) {
        const updatedSession = await res.json();
        setSessions(prev => prev.map(s => s.id === id ? updatedSession : s));
      }
    } catch (err) {
      console.error('Error renaming session:', err);
    }
  };

  const handleGenerateSummary = async (fileId: string) => {
    try {
      const res = await fetch(`/api/files/${fileId}/summary`, { method: 'POST' });
      if (res.ok) {
        const summary = await res.json();
        setFiles(prev => prev.map(f => f.id === fileId ? { ...f, summary } : f));
      } else {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to generate summary');
      }
    } catch (err: any) {
      console.error(err);
      alert(`Insights Generation Failed: ${err.message}`);
    }
  };

  const handleAskSuggestedQuestion = async (q: string) => {
    let sessionId = activeSessionId;
    if (!sessionId) {
      // Create a new session first
      try {
        const res = await fetch('/api/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: `Conversation #${sessions.length + 1}`,
            documentIds: selectedDocIds
          })
        });
        if (res.ok) {
          const data = await res.json();
          setSessions(prev => [data, ...prev]);
          setActiveSessionId(data.id);
          sessionId = data.id;
        } else {
          return;
        }
      } catch (err) {
        console.error(err);
        return;
      }
    }
    if (sessionId) {
      // Small timeout to ensure activeSessionId updates and state settles
      setTimeout(() => {
        handleSendMessage(q);
      }, 50);
    }
  };

  const handleResetAll = async () => {
    try {
      const res = await fetch('/api/dev/reset', { method: 'POST' });
      if (res.ok) {
        setFiles([]);
        setSessions([]);
        setActiveSessionId(null);
        setSelectedDocIds([]);
        alert('All document indices, vector store vectors, and conversation sessions have been cleared.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const activeSession = sessions.find(s => s.id === activeSessionId) || null;

  return (
    <div className={`flex h-screen w-screen overflow-hidden font-sans transition-colors duration-200 ${
      theme === 'dark' ? 'bg-[#0a0a0a] text-[#d1d1d1]' : 'bg-white text-zinc-800'
    }`}>
      
      {/* 1. Left panel: Document & Session Sidebar (Responsive Layout) */}
      {/* Mobile Sidebar Backdrop */}
      {isMobileSidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-xs transition-opacity duration-300"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <div className={`
        fixed inset-y-0 left-0 z-50 lg:z-0 lg:relative
        w-80 max-w-[85vw] lg:w-80 h-full
        transform transition-transform duration-300 ease-in-out lg:transform-none
        ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <Sidebar
          theme={theme}
          files={files}
          sessions={sessions}
          activeSessionId={activeSessionId}
          selectedDocIds={selectedDocIds}
          onUpload={handleUpload}
          onDeleteFile={handleDeleteFile}
          onSelectDoc={handleSelectDoc}
          onSelectAllDocs={handleSelectAllDocs}
          onDeselectAllDocs={handleDeselectAllDocs}
          onCreateSession={handleCreateSession}
          onSelectSession={handleSelectSession}
          onDeleteSession={handleDeleteSession}
          onRenameSession={handleRenameSession}
          onClose={() => setIsMobileSidebarOpen(false)}
        />
      </div>

      {/* 2. Central workspace */}
      <div className="flex-1 flex flex-col min-w-0 relative h-full">
        {/* Top Control Bar */}
        <div className={`h-14 border-b px-4 md:px-5 flex items-center justify-between shrink-0 transition-colors duration-200 ${
          theme === 'dark' ? 'border-white/5 bg-[#0a0a0a]' : 'border-zinc-200 bg-[#fbfbfb]'
        }`}>
          <div className="flex items-center space-x-2 md:space-x-2.5 min-w-0">
            {/* Mobile Menu Toggle Button */}
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className={`lg:hidden p-1.5 rounded border transition-all cursor-pointer mr-1 shrink-0 ${
                theme === 'dark'
                  ? 'border-white/10 text-zinc-400 hover:text-white hover:bg-white/5'
                  : 'border-zinc-200 text-zinc-500 hover:text-zinc-950 hover:bg-zinc-100 bg-white shadow-sm'
              }`}
              title="Open Documents"
            >
              <Menu className="w-4 h-4" />
            </button>

            <Database className={`w-3.5 h-3.5 shrink-0 ${theme === 'dark' ? 'text-white' : 'text-zinc-800'}`} />
            <span className={`text-[9px] font-bold font-mono uppercase tracking-[0.2em] truncate ${theme === 'dark' ? 'text-[#8a8a8a]' : 'text-zinc-500'}`}>
              Vector Index: {files.some(f => f.status === 'processing') ? 'Processing...' : `${files.filter(f => f.status === 'ready').length} Active`}
            </span>
          </div>

          <div className="flex items-center space-x-1.5 md:space-x-2">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className={`px-2.5 md:px-3 py-1.5 rounded text-xs font-serif italic flex items-center space-x-1 md:space-x-2 transition-all border cursor-pointer ${
                theme === 'dark'
                  ? 'bg-[#161616] text-white border-white/20 hover:bg-[#202020] hover:text-white'
                  : 'bg-white text-zinc-800 border-zinc-200 hover:bg-zinc-50 hover:text-zinc-950 shadow-sm'
              }`}
            >
              <span>{theme === 'dark' ? '☾ Dark' : '☀ Light'}</span>
            </button>

            <button
              onClick={() => setShowConsole(!showConsole)}
              className={`px-2.5 md:px-3 py-1.5 rounded text-xs font-serif italic flex items-center space-x-1 md:space-x-2 transition-all border cursor-pointer ${
                showConsole 
                  ? theme === 'dark'
                    ? 'bg-[#161616] text-white border-white/20' 
                    : 'bg-zinc-900 text-white border-transparent shadow-sm hover:bg-zinc-800'
                  : theme === 'dark'
                    ? 'bg-transparent text-[#8a8a8a] border-white/5 hover:text-white hover:bg-white/5'
                    : 'bg-transparent text-zinc-500 border-zinc-200 hover:text-zinc-950 hover:bg-zinc-50'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>{showConsole ? 'Console' : 'Console'}</span>
            </button>
          </div>
        </div>

        {/* Workspace body (Split Chat + Technical Console) */}
        <div className="flex-1 flex min-h-0 overflow-hidden relative">
          {/* Chat Panel */}
          <ChatInterface
            theme={theme}
            activeSession={activeSession}
            isStreaming={isStreaming}
            streamedText={streamedText}
            activeSources={activeSources}
            onSendMessage={handleSendMessage}
          />

          {/* Right Technical Console Panel (Responsive Drawer / Column) */}
          {showConsole && (
            <>
              {/* Mobile overlay backdrop for Technical Console */}
              <div 
                className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-xs transition-opacity duration-300"
                onClick={() => setShowConsole(false)}
              />
              {/* Console Container */}
              <div className={`
                fixed lg:relative inset-y-0 right-0 z-40 lg:z-0
                w-[85vw] sm:w-[500px] lg:w-[45%] h-full shrink-0 border-l p-4 lg:p-5 transition-all duration-300 transform lg:transform-none
                ${theme === 'dark' ? 'border-white/5 bg-[#0a0a0a]' : 'border-zinc-200 bg-zinc-50/50'}
              `}>
                <ArchitectureDoc
                  theme={theme}
                  files={files}
                  onResetAll={handleResetAll}
                  onClose={() => setShowConsole(false)}
                  onGenerateSummary={handleGenerateSummary}
                  onAskQuestion={handleAskSuggestedQuestion}
                />
              </div>
            </>
          )}
        </div>
      </div>

    </div>
  );
}
