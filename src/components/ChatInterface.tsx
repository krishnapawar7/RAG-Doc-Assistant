import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, Sparkles, BookOpen, ExternalLink, Copy, Check, ChevronRight, HelpCircle, AlertCircle } from 'lucide-react';
import { ChatSession, ChatMessage, SearchResult } from '../types';

interface ChatInterfaceProps {
  activeSession: ChatSession | null;
  isStreaming: boolean;
  streamedText: string;
  activeSources: SearchResult[];
  onSendMessage: (text: string) => Promise<void>;
  theme: 'dark' | 'light';
}

export default function ChatInterface({
  activeSession,
  isStreaming,
  streamedText,
  activeSources,
  onSendMessage,
  theme
}: ChatInterfaceProps) {
  const [input, setInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<SearchResult | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Suggestions list when chat is empty
  const suggestions = [
    "Can you summarize the main points of this document?",
    "What are the key terms or core definitions described?",
    "What is the primary conclusion or recommendation of this text?",
    "Are there any action items or critical dates listed?"
  ];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeSession?.messages, streamedText, isStreaming]);

  const handleSend = () => {
    if (!input.trim() || isStreaming) return;
    onSendMessage(input.trim());
    setInput('');
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Safe custom Markdown-like parser for clean rendering without external dependencies
  const renderMarkdown = (text: string) => {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];

    lines.forEach((line, index) => {
      let processed = line;
      // Bold syntax
      processed = processed.replace(/\*\*(.*?)\*\*/g, `<strong class="${theme === 'dark' ? 'text-white' : 'text-zinc-950'} font-medium">$1</strong>`);
      // Inline code backticks
      processed = processed.replace(/`(.*?)`/g, `<code class="font-mono ${theme === 'dark' ? 'bg-[#161616] text-white border-white/5' : 'bg-zinc-100 text-zinc-900 border-zinc-200'} px-1 py-0.5 rounded text-[11px] border">$1</code>`);

      const trimmed = line.trim();

      // Check for bullet points
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const content = processed.replace(/^[\s-*]+/, '');
        elements.push(
          <li key={`li-${index}`} className={`list-disc ml-5 mb-1.5 text-xs md:text-sm leading-relaxed ${theme === 'dark' ? 'text-[#d1d1d1]' : 'text-zinc-800'}`} dangerouslySetInnerHTML={{ __html: content }} />
        );
        return;
      }

      // Check for numbered lists
      if (/^\d+\.\s+/.test(trimmed)) {
        const content = processed.replace(/^\d+\.\s+/, '');
        elements.push(
          <li key={`ol-${index}`} className={`list-decimal ml-5 mb-1.5 text-xs md:text-sm leading-relaxed ${theme === 'dark' ? 'text-[#d1d1d1]' : 'text-zinc-800'}`} dangerouslySetInnerHTML={{ __html: content }} />
        );
        return;
      }

      // Headings
      if (trimmed.startsWith('### ')) {
        elements.push(
          <h4 key={`h4-${index}`} className={`text-xs uppercase tracking-widest font-semibold mt-4 mb-2 ${theme === 'dark' ? 'text-[#8a8a8a]' : 'text-zinc-500'}`} dangerouslySetInnerHTML={{ __html: processed.replace('### ', '') }} />
        );
        return;
      }
      if (trimmed.startsWith('## ')) {
        elements.push(
          <h3 key={`h3-${index}`} className={`text-sm font-serif italic mt-5 mb-2 border-b pb-1 ${theme === 'dark' ? 'text-white border-white/5' : 'text-zinc-900 border-zinc-200'}`} dangerouslySetInnerHTML={{ __html: processed.replace('## ', '') }} />
        );
        return;
      }
      if (trimmed.startsWith('# ')) {
        elements.push(
          <h2 key={`h2-${index}`} className={`text-base font-serif italic mt-6 mb-3 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`} dangerouslySetInnerHTML={{ __html: processed.replace('# ', '') }} />
        );
        return;
      }

      // Empty spacing
      if (trimmed === '') {
        elements.push(<div key={`space-${index}`} className="h-2.5" />);
        return;
      }

      // Regular paragraph
      elements.push(
        <p key={`p-${index}`} className={`mb-2 leading-relaxed text-xs md:text-sm ${theme === 'dark' ? 'text-[#d1d1d1]' : 'text-zinc-800'}`} dangerouslySetInnerHTML={{ __html: processed }} />
      );
    });

    return <div className="space-y-0.5">{elements}</div>;
  };

  if (!activeSession) {
    return (
      <div className={`flex-1 flex flex-col items-center justify-center text-center p-8 ${
        theme === 'dark' ? 'bg-[#0a0a0a]' : 'bg-[#fbfbfb]'
      }`}>
        <div className="max-w-md space-y-5">
          <div className={`w-12 h-12 rounded-full border flex items-center justify-center mx-auto ${
            theme === 'dark' ? 'border-white/10 text-[#8a8a8a] bg-[#0f0f0f]' : 'border-zinc-200 text-zinc-500 bg-white shadow-sm'
          }`}>
            <Bot className="w-5 h-5" />
          </div>
          <div className="space-y-2">
            <h2 className={`text-xl font-serif italic ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>Create a Chat Session</h2>
            <p className={`text-xs leading-relaxed max-w-xs mx-auto ${theme === 'dark' ? 'text-[#8a8a8a]' : 'text-zinc-500'}`}>Select an existing conversation on the left, or spin up a new chat session to query your ingested documents with RAG.</p>
          </div>
        </div>
      </div>
    );
  }

  const { messages, documentIds } = activeSession;

  return (
    <div className={`flex-1 flex overflow-hidden relative ${
      theme === 'dark' ? 'bg-[#0a0a0a]' : 'bg-[#fbfbfb]'
    }`}>
      
      {/* Main Chat Feed */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        
        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto p-5 md:p-8 space-y-6">
          
          {messages.length === 0 && !isStreaming ? (
            <div className="max-w-2xl mx-auto py-12 flex flex-col items-center justify-center text-center space-y-8">
              <div className={`w-10 h-10 rounded-full border flex items-center justify-center ${
                theme === 'dark' ? 'border-white/10 text-white bg-[#0f0f0f]' : 'border-zinc-200 text-zinc-800 bg-white shadow-sm'
              }`}>
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="space-y-2 max-w-md">
                <h3 className={`text-base font-serif italic ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>Document Conversation Ready</h3>
                <p className={`text-xs ${theme === 'dark' ? 'text-[#8a8a8a]' : 'text-zinc-500'} leading-relaxed`}>
                  {documentIds.length > 0
                    ? `This chat is bound to ${documentIds.length} file(s). Ask any questions to pull context from those files.`
                    : "No specific document boundary is selected. Ask any question to query across all uploaded PDFs."}
                </p>
              </div>

              {/* Suggestions Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full pt-4">
                {suggestions.map((sug, i) => (
                  <button
                    key={i}
                    onClick={() => setInput(sug)}
                    className={`p-4 text-left border rounded-md text-xs transition-all flex items-start space-x-3 duration-300 cursor-pointer ${
                      theme === 'dark'
                        ? 'bg-[#0f0f0f]/60 hover:bg-[#121212] border-white/5 hover:border-white/20 text-[#8a8a8a] hover:text-[#d1d1d1]'
                        : 'bg-white hover:bg-zinc-50 border-zinc-200 hover:border-zinc-300 text-zinc-600 hover:text-zinc-950 shadow-sm'
                    }`}
                  >
                    <HelpCircle className={`w-4 h-4 mt-0.5 shrink-0 ${theme === 'dark' ? 'text-white' : 'text-zinc-700'}`} />
                    <span className="leading-relaxed font-serif italic">{sug}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-6">
              {messages.map((msg) => {
                const isAssistant = msg.role === 'assistant';
                return (
                  <div
                    key={msg.id}
                    className={`flex items-start space-x-4.5 ${msg.role === 'user' ? 'justify-end' : ''}`}
                  >
                    {/* Bot avatar */}
                    {isAssistant && (
                      <div className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 mt-0.5 font-serif italic text-xs ${
                        theme === 'dark' ? 'border-white/20 text-white bg-[#0f0f0f]' : 'border-zinc-300 text-zinc-900 bg-zinc-100 shadow-sm'
                      }`}>
                        A
                      </div>
                    )}

                    <div className={`flex flex-col space-y-1.5 max-w-[85%] ${msg.role === 'user' ? 'items-end' : ''}`}>
                      <div className={`flex items-center space-x-2 text-[9px] font-mono px-1 ${theme === 'dark' ? 'text-[#555]' : 'text-zinc-400'}`}>
                        <span className="uppercase tracking-widest">{msg.role === 'user' ? 'You' : 'Assistant'}</span>
                        <span className="opacity-40">•</span>
                        <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>

                      <div
                        className={`p-4 rounded-md border relative group ${
                          msg.role === 'user'
                            ? theme === 'dark'
                              ? 'bg-[#121212] border-white/10 text-white rounded-tr-none'
                              : 'bg-zinc-100/80 border-zinc-200 text-zinc-900 rounded-tr-none'
                            : theme === 'dark'
                              ? 'bg-[#0f0f0f]/60 border-white/5 text-[#d1d1d1] rounded-tl-none'
                              : 'bg-white border-zinc-200 text-zinc-800 rounded-tl-none shadow-sm'
                        }`}
                      >
                        {/* Message content */}
                        <div className="prose prose-xs">
                          {renderMarkdown(msg.content)}
                        </div>

                        {/* Copy Trigger */}
                        <button
                          onClick={() => copyToClipboard(msg.content, msg.id)}
                          className={`absolute right-2.5 top-2.5 p-1 rounded border opacity-0 group-hover:opacity-100 transition-all duration-250 cursor-pointer ${
                            theme === 'dark'
                              ? 'bg-[#0a0a0a] hover:bg-[#121212] text-[#555] hover:text-[#d1d1d1] border-white/5'
                              : 'bg-white hover:bg-zinc-50 text-zinc-400 hover:text-zinc-700 border-zinc-200 shadow-sm'
                          }`}
                          title="Copy Message"
                        >
                          {copiedId === msg.id ? (
                            <Check className="w-3 h-3 text-emerald-500" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>

                      {/* Render retrieved references */}
                      {isAssistant && msg.sources && msg.sources.length > 0 && (
                        <div className="pt-2">
                          <span className={`text-[9px] font-bold uppercase tracking-[0.2em] block mb-1.5 ${theme === 'dark' ? 'text-[#555]' : 'text-zinc-400'}`}>Retrieved Citations:</span>
                          <div className="flex flex-wrap gap-2">
                            {msg.sources.map((src) => (
                              <button
                                key={src.chunk.id}
                                onClick={() => setSelectedSource(src)}
                                className={`px-2.5 py-1.5 border rounded text-[9px] font-mono flex items-center space-x-2 transition-all duration-300 cursor-pointer ${
                                  theme === 'dark'
                                    ? 'bg-[#121212] hover:bg-[#161616] border-white/5 hover:border-white/20 text-[#8a8a8a] hover:text-white'
                                    : 'bg-white hover:bg-zinc-50 border-zinc-200 hover:border-zinc-300 text-zinc-600 hover:text-zinc-900 shadow-sm'
                                }`}
                              >
                                <BookOpen className={`w-3 h-3 ${theme === 'dark' ? 'text-[#666]' : 'text-zinc-400'}`} />
                                <span className="truncate max-w-[130px] font-serif italic text-[10px]">{src.chunk.documentName}</span>
                                <span className={`border px-1 py-0.2 rounded text-[8px] ${
                                  theme === 'dark' ? 'bg-white/5 border-white/5 text-[#d1d1d1]' : 'bg-zinc-100 border-zinc-200 text-zinc-600'
                                }`}>PAGE {src.chunk.pageIndex}</span>
                                <span className={theme === 'dark' ? 'text-[#8a8a8a]' : 'text-zinc-500'}>{(src.similarity * 100).toFixed(0)}%</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* User avatar */}
                    {msg.role === 'user' && (
                      <div className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 mt-0.5 font-serif italic text-xs ${
                        theme === 'dark' ? 'border-white/10 bg-[#0a0a0a] text-[#8a8a8a]' : 'border-zinc-200 bg-white text-zinc-400 shadow-sm'
                      }`}>
                        U
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Streaming Indicator */}
              {isStreaming && (
                <div className="flex items-start space-x-4.5">
                  <div className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 mt-0.5 font-serif italic text-xs ${
                    theme === 'dark' ? 'border-white/20 text-white bg-[#0f0f0f]' : 'border-zinc-300 text-zinc-900 bg-zinc-100 shadow-sm'
                  }`}>
                    A
                  </div>
                  <div className="flex flex-col space-y-1.5 max-w-[85%]">
                    <div className={`text-[9px] font-mono px-1 uppercase tracking-widest animate-pulse ${theme === 'dark' ? 'text-[#555]' : 'text-zinc-400'}`}>GENERATING ANSWER...</div>
                    
                    {/* Streamed block */}
                    <div className={`p-4 rounded-md rounded-tl-none ${
                      theme === 'dark' 
                        ? 'bg-[#0f0f0f]/60 border border-white/5 text-[#d1d1d1]' 
                        : 'bg-white border border-zinc-200 text-zinc-800 shadow-sm'
                    }`}>
                      <div className="prose prose-xs">
                        {renderMarkdown(streamedText)}
                      </div>
                      
                      <span className={`inline-block w-1.5 h-3.5 ml-1 animate-pulse align-middle ${theme === 'dark' ? 'bg-white' : 'bg-zinc-900'}`} />
                    </div>

                    {/* Stream Sources if loaded */}
                    {activeSources.length > 0 && (
                      <div className="pt-2 animate-fade-in">
                        <span className={`text-[9px] font-bold uppercase tracking-[0.2em] block mb-1.5 ${theme === 'dark' ? 'text-[#555]' : 'text-zinc-400'}`}>Retrieved Citations:</span>
                        <div className="flex flex-wrap gap-2">
                          {activeSources.map((src) => (
                            <button
                              key={src.chunk.id}
                              onClick={() => setSelectedSource(src)}
                              className={`px-2.5 py-1.5 border rounded text-[9px] font-mono flex items-center space-x-2 transition-all duration-300 animate-pulse cursor-pointer ${
                                theme === 'dark'
                                  ? 'bg-[#121212] hover:bg-[#161616] border-white/5 hover:border-white/20 text-[#8a8a8a]'
                                  : 'bg-white hover:bg-zinc-50 border-zinc-200 hover:border-zinc-300 text-zinc-600'
                              }`}
                            >
                              <BookOpen className={`w-3 h-3 ${theme === 'dark' ? 'text-[#666]' : 'text-zinc-400'}`} />
                              <span className="truncate max-w-[130px] font-serif italic text-[10px]">{src.chunk.documentName}</span>
                              <span className={`border px-1 py-0.2 rounded text-[8px] ${
                                theme === 'dark' ? 'bg-white/5 border-white/5 text-[#d1d1d1]' : 'bg-zinc-100 border-zinc-200 text-zinc-600'
                              }`}>PAGE {src.chunk.pageIndex}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Bottom Input Area */}
        <div className={`p-5 border-t shrink-0 max-w-3xl w-full mx-auto ${
          theme === 'dark' ? 'border-white/5 bg-[#0a0a0a]' : 'border-zinc-200 bg-[#fbfbfb]'
        }`}>
          <div className="flex space-x-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isStreaming ? "Generating answer..." : "Ask a question about your documents..."}
              className={`flex-1 text-xs md:text-sm px-4 py-3 rounded-md border transition-all disabled:opacity-40 focus:outline-none ${
                theme === 'dark'
                  ? 'bg-[#121212] text-[#d1d1d1] border-white/5 focus:border-white/20 focus:bg-[#161616]'
                  : 'bg-white text-zinc-900 border-zinc-200 focus:border-zinc-400 focus:bg-white shadow-sm'
              }`}
              disabled={isStreaming}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSend();
              }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isStreaming}
              className={`px-4 py-3 font-semibold text-xs uppercase tracking-widest disabled:opacity-30 rounded-md transition-all flex items-center justify-center shrink-0 cursor-pointer ${
                theme === 'dark'
                  ? 'bg-white hover:bg-[#e1e1e1] text-black'
                  : 'bg-zinc-900 hover:bg-zinc-800 text-white shadow-sm'
              }`}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <div className={`flex items-center justify-between mt-3 text-[9px] font-mono ${theme === 'dark' ? 'text-[#555]' : 'text-zinc-400'}`}>
            <span className="flex items-center space-x-1.5">
              <Sparkles className={`w-3 h-3 ${theme === 'dark' ? 'text-[#8a8a8a]' : 'text-zinc-500'}`} />
              <span className="uppercase tracking-wider">Uses Gemini RAG Pipeline</span>
            </span>
            <span className="uppercase tracking-wider">Press Enter to send</span>
          </div>
        </div>

      </div>

      {/* Citations Drawer Side-Panel (Slides in from right when a source is clicked) */}
      {selectedSource && (
        <div className={`absolute inset-y-0 right-0 w-full sm:w-80 max-w-full p-5 shadow-2xl flex flex-col z-20 animate-slide-in border-l ${
          theme === 'dark' ? 'bg-[#0f0f0f] border-white/5' : 'bg-white border-zinc-200'
        }`}>
          <div className={`flex items-center justify-between pb-3.5 border-b shrink-0 ${theme === 'dark' ? 'border-white/5' : 'border-zinc-200'}`}>
            <div className="flex items-center space-x-2">
              <BookOpen className={`w-4 h-4 ${theme === 'dark' ? 'text-white' : 'text-zinc-800'}`} />
              <span className={`text-xs font-bold font-serif italic tracking-wide ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>Citation Details</span>
            </div>
            <button
              onClick={() => setSelectedSource(null)}
              className={`px-2.5 py-1 border text-[9px] uppercase tracking-[0.2em] rounded transition-colors font-mono cursor-pointer ${
                theme === 'dark'
                  ? 'border-white/10 hover:border-white/30 hover:bg-white/5 text-[#d1d1d1] hover:text-white'
                  : 'border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 text-zinc-600 hover:text-zinc-950 shadow-sm'
              }`}
            >
              Close
            </button>
          </div>

          <div className="flex-1 overflow-y-auto py-5 space-y-4.5 text-xs">
            {/* Context file meta */}
            <div className="space-y-2">
              <span className={`text-[9px] font-bold uppercase tracking-[0.2em] ${theme === 'dark' ? 'text-[#555]' : 'text-zinc-400'}`}>Document Name</span>
              <p className={`font-serif italic border rounded p-2.5 truncate ${
                theme === 'dark' ? 'text-white bg-[#121212] border-white/5' : 'text-zinc-900 bg-zinc-50 border-zinc-200 shadow-sm'
              }`}>{selectedSource.chunk.documentName}</p>
            </div>

            {/* Pagination details */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <span className={`text-[9px] font-bold uppercase tracking-[0.2em] block ${theme === 'dark' ? 'text-[#555]' : 'text-zinc-400'}`}>Page Index</span>
                <p className={`border p-2.5 rounded font-mono text-[11px] font-bold ${
                  theme === 'dark' ? 'bg-[#121212] border-white/5 text-[#d1d1d1]' : 'bg-zinc-50 border-zinc-200 text-zinc-800'
                }`}>
                  PAGE {selectedSource.chunk.pageIndex}
                </p>
              </div>
              <div className="space-y-1.5">
                <span className={`text-[9px] font-bold uppercase tracking-[0.2em] block ${theme === 'dark' ? 'text-[#555]' : 'text-zinc-400'}`}>Match Quality</span>
                <p className={`border p-2.5 rounded font-mono text-[11px] font-bold ${
                  theme === 'dark' ? 'bg-[#121212] border-white/5 text-white' : 'bg-zinc-50 border-zinc-200 text-zinc-900'
                }`}>
                  {(selectedSource.similarity * 100).toFixed(1)}% Score
                </p>
              </div>
            </div>

            {/* Actual text content chunk */}
            <div className="space-y-2 flex-1 flex flex-col min-h-0">
              <span className={`text-[9px] font-bold uppercase tracking-[0.2em] ${theme === 'dark' ? 'text-[#555]' : 'text-zinc-400'}`}>Source Content Chunk</span>
              <div className={`p-3.5 rounded border font-serif italic text-[11px] leading-relaxed overflow-y-auto flex-1 break-words ${
                theme === 'dark' ? 'bg-[#0a0a0a] border-white/5 text-[#d1d1d1]' : 'bg-zinc-50/50 border-zinc-200 text-zinc-800 shadow-inner'
              }`}>
                "{selectedSource.chunk.text}"
              </div>
            </div>

            {/* Math note */}
            <div className={`p-3 rounded border text-[9px] leading-relaxed ${
              theme === 'dark' ? 'bg-[#121212] border-white/5 text-[#8a8a8a]' : 'bg-zinc-100/50 border-zinc-200 text-zinc-600'
            }`}>
              <span className={`font-bold uppercase tracking-[0.15em] block mb-1 ${theme === 'dark' ? 'text-white' : 'text-zinc-950'}`}>Cosine Similarity Index</span>
              This text chunk vector has a directional cosine similarity score of {selectedSource.similarity.toFixed(4)} with the embedding of your question.
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
