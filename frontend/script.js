// Client-side implementation for AI Document Assistant RAG Pipeline

let activeSessionId = null;
let sessions = [];
let files = [];
let selectedDocIds = [];

// DOM Elements
const sessionsList = document.getElementById('sessions-list');
const documentsList = document.getElementById('documents-list');
const newSessionBtn = document.getElementById('new-session-btn');
const fileInput = document.getElementById('file-input');
const messagesContainer = document.getElementById('messages-container');
const emptyChatState = document.getElementById('empty-chat-state');
const chatForm = document.getElementById('chat-form');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const activeSessionTitle = document.getElementById('active-session-title');
const docSelectionPills = document.getElementById('doc-selection-pills');
const streamPreview = document.getElementById('stream-preview');
const streamStatus = document.getElementById('stream-status');

// Initialize API Calls
document.addEventListener('DOMContentLoaded', () => {
    fetchSessions();
    fetchFiles();
    setupEventListeners();
    
    // Lucide Icon activation
    if (window.lucide) {
        window.lucide.createIcons();
    }
});

function setupEventListeners() {
    newSessionBtn.addEventListener('click', createNewSession);
    fileInput.addEventListener('change', uploadPdfFile);
    chatForm.addEventListener('submit', sendChatMessage);
}

// Fetch sessions list
async function fetchSessions() {
    try {
        const res = await fetch('/api/sessions');
        if (res.ok) {
            sessions = await res.json();
            renderSessions();
            if (sessions.length > 0 && !activeSessionId) {
                selectSession(sessions[0].id);
            }
        }
    } catch (err) {
        console.error('Error fetching sessions:', err);
    }
}

// Fetch documents list
async function fetchFiles() {
    try {
        const res = await fetch('/api/files');
        if (res.ok) {
            files = await res.json();
            renderFiles();
            renderDocumentPills();
            
            // If any files are still 'processing', poll again in 4 seconds
            const isProcessing = files.some(f => f.status === 'processing');
            if (isProcessing) {
                setTimeout(fetchFiles, 4000);
            }
        }
    } catch (err) {
        console.error('Error fetching files:', err);
    }
}

// Create new session
async function createNewSession() {
    const title = `Session #${Date.now().toString().slice(-4)}`;
    try {
        const res = await fetch('/api/sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, documentIds: [] })
        });
        if (res.ok) {
            const newSession = await res.json();
            sessions.unshift(newSession);
            renderSessions();
            selectSession(newSession.id);
        }
    } catch (err) {
        console.error('Error creating session:', err);
    }
}

// Select a session
function selectSession(id) {
    activeSessionId = id;
    const session = sessions.find(s => s.id === id);
    if (!session) return;

    activeSessionTitle.textContent = session.title;
    selectedDocIds = session.documentIds || [];
    
    renderSessions();
    renderDocumentPills();
    renderFiles();
    renderMessages(session.messages);
    
    // Toggle send button state
    sendBtn.disabled = !activeSessionId;
}

// Bind/Unbind files to active session
async function toggleFileBinding(fileId) {
    if (!activeSessionId) {
        alert("Please select or start a conversation first.");
        return;
    }
    
    if (selectedDocIds.includes(fileId)) {
        selectedDocIds = selectedDocIds.filter(id => id !== fileId);
    } else {
        selectedDocIds.push(fileId);
    }
    
    try {
        const res = await fetch(`/api/sessions/${activeSessionId}/bindings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(selectedDocIds)
        });
        if (res.ok) {
            // Update local memory state
            const sessIdx = sessions.findIndex(s => s.id === activeSessionId);
            if (sessIdx !== -1) {
                sessions[sessIdx].documentIds = selectedDocIds;
            }
            renderDocumentPills();
            renderFiles();
        }
    } catch (err) {
        console.error(err);
    }
}

// Upload a PDF document
async function uploadPdfFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
        const res = await fetch('/api/files/upload', {
            method: 'POST',
            body: formData
        });
        if (res.ok) {
            const newFile = await res.json();
            files.unshift(newFile);
            renderFiles();
            
            // Auto bind newly uploaded file to active session if selected
            if (activeSessionId) {
                toggleFileBinding(newFile.id);
            }
            
            // Poll for processing completion
            setTimeout(fetchFiles, 3000);
        } else {
            const err = await res.json();
            alert(err.detail || 'Upload failed');
        }
    } catch (err) {
        console.error(err);
    } finally {
        fileInput.value = '';
    }
}

// Delete a document
async function deleteDocument(fileId, e) {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this document and its embeddings?')) return;
    
    try {
        const res = await fetch(`/api/files/${fileId}`, { method: 'DELETE' });
        if (res.ok) {
            files = files.filter(f => f.id !== fileId);
            selectedDocIds = selectedDocIds.filter(id => id !== fileId);
            renderFiles();
            renderDocumentPills();
        }
    } catch (err) {
        console.error(err);
    }
}

// Render sessions in sidebar
function renderSessions() {
    sessionsList.innerHTML = '';
    sessions.forEach(s => {
        const isActive = s.id === activeSessionId;
        const btn = document.createElement('button');
        btn.className = `w-full text-left p-3.5 rounded text-xs transition-all flex items-center justify-between cursor-pointer group ${
            isActive ? 'bg-white/5 text-white border border-white/10' : 'text-[#8a8a8a] hover:bg-white/5 hover:text-white border border-transparent'
        }`;
        btn.onclick = () => selectSession(s.id);
        
        btn.innerHTML = `
            <div class="flex items-center space-x-2.5 overflow-hidden">
                <i data-lucide="message-square" class="w-3.5 h-3.5 shrink-0 ${isActive ? 'text-white' : 'text-[#555]'}" style="width: 14px; height: 14px;"></i>
                <span class="truncate font-medium">${s.title}</span>
            </div>
            <span class="text-[9px] font-mono text-[#555]">${s.messages.length / 2} Qs</span>
        `;
        sessionsList.appendChild(btn);
    });
    lucide.createIcons();
}

// Render files in sidebar
function renderFiles() {
    documentsList.innerHTML = '';
    if (files.length === 0) {
        documentsList.innerHTML = `<p class="text-[10px] text-[#555] font-serif italic text-center py-2">No documents uploaded.</p>`;
        return;
    }
    
    files.forEach(f => {
        const isBound = selectedDocIds.includes(f.id);
        const div = document.createElement('div');
        div.className = `p-3 rounded text-xs transition-all flex items-center justify-between border cursor-pointer ${
            isBound 
                ? 'bg-white/5 text-white border-white/15' 
                : 'bg-transparent text-[#8a8a8a] border-white/5 hover:text-white'
        }`;
        div.onclick = () => toggleFileBinding(f.id);
        
        let statusBadge = '';
        if (f.status === 'processing') {
            statusBadge = `<span class="text-[8px] text-amber-500 font-mono tracking-wider animate-pulse font-bold">PARSING</span>`;
        } else if (f.status === 'error') {
            statusBadge = `<span class="text-[8px] text-red-500 font-mono tracking-wider font-bold">ERROR</span>`;
        } else {
            statusBadge = `<span class="text-[9px] text-[#555] font-mono">${f.chunkCount || 0} chunks</span>`;
        }

        div.innerHTML = `
            <div class="overflow-hidden pr-2">
                <div class="font-medium truncate">${f.name}</div>
                <div class="flex items-center space-x-2 text-[9px] text-[#555] font-mono mt-0.5">
                    <span>${(f.size / 1024).toFixed(1)} KB</span>
                    <span>•</span>
                    ${statusBadge}
                </div>
            </div>
            <button class="text-[#555] hover:text-[#ff6b6b] p-1 rounded cursor-pointer" onclick="deleteDocument('${f.id}', event)">
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
        `;
        documentsList.appendChild(div);
    });
    lucide.createIcons();
}

// Render active session doc selection pills
function renderDocumentPills() {
    docSelectionPills.innerHTML = '';
    const boundFiles = files.filter(f => selectedDocIds.includes(f.id));
    
    if (boundFiles.length === 0) {
        docSelectionPills.innerHTML = `<span class="text-[10px] font-serif italic">Searching all index segments</span>`;
        return;
    }
    
    boundFiles.forEach(f => {
        const span = document.createElement('span');
        span.className = "text-[9px] font-mono uppercase tracking-wider bg-white/5 border border-white/10 px-2 py-0.5 rounded text-white flex items-center space-x-1";
        span.innerHTML = `
            <span>${f.name.slice(0, 15)}</span>
            <button onclick="toggleFileBinding('${f.id}')" class="text-[#555] hover:text-white ml-1 font-bold">×</button>
        `;
        docSelectionPills.appendChild(span);
    });
}

// Render chat messages
function renderMessages(messages) {
    messagesContainer.innerHTML = '';
    
    if (!messages || messages.length === 0) {
        emptyChatState.classList.remove('hidden');
        return;
    }
    
    emptyChatState.classList.add('hidden');
    
    messages.forEach(msg => {
        const isUser = msg.role === 'user';
        const msgDiv = document.createElement('div');
        msgDiv.className = `flex ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in`;
        
        let sourcesMarkup = '';
        if (!isUser && msg.sources && msg.sources.length > 0) {
            sourcesMarkup = `
                <div class="mt-4 pt-3.5 border-t border-white/5">
                    <span class="text-[9px] font-mono uppercase tracking-widest text-[#555] block mb-2">Sources Citations:</span>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        ${msg.sources.map(src => `
                            <div class="bg-white/5 border border-white/5 rounded p-2.5 text-[10px]">
                                <div class="flex items-center justify-between text-[#8a8a8a] font-mono text-[9px] uppercase mb-1">
                                    <span>${src.chunk.documentName.slice(0, 18)}</span>
                                    <span>Page ${src.chunk.pageIndex}</span>
                                </div>
                                <p class="text-white font-serif italic line-clamp-3">"${src.chunk.text}"</p>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        msgDiv.innerHTML = `
            <div class="max-w-3xl rounded-md p-5 border ${
                isUser 
                    ? 'bg-[#0f0f0f] border-white/10 text-white ml-12 font-mono text-xs' 
                    : 'bg-[#080808] border-white/5 text-[#d1d1d1] mr-12 text-sm markdown-body'
            }">
                <div class="text-[9px] font-mono uppercase tracking-widest text-[#555] mb-2.5">${isUser ? 'USER QUESTION' : 'AI ASSISTANT ANSWER'}</div>
                <div>${msg.content.replace(/\n/g, '<br>')}</div>
                ${sourcesMarkup}
            </div>
        `;
        messagesContainer.appendChild(msgDiv);
    });
    
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Send user query with SSE streaming
async function sendChatMessage(e) {
    e.preventDefault();
    const query = userInput.value.trim();
    if (!query || !activeSessionId) return;

    userInput.value = '';
    
    // Add user message mock UI temporarily
    emptyChatState.classList.add('hidden');
    const userMsgId = 'temp_' + Date.now();
    const userMsgDiv = document.createElement('div');
    userMsgDiv.className = 'flex justify-end animate-fade-in';
    userMsgDiv.innerHTML = `
        <div class="max-w-3xl rounded-md p-5 border bg-[#0f0f0f] border-white/10 text-white ml-12 font-mono text-xs">
            <div class="text-[9px] font-mono uppercase tracking-widest text-[#555] mb-2.5">USER QUESTION</div>
            <div>${query}</div>
        </div>
    `;
    messagesContainer.appendChild(userMsgDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Show stream status preview
    streamPreview.classList.remove('hidden');
    streamStatus.textContent = 'Performing cosine similarity search...';

    // Create placeholder AI message block
    const assistantMsgDiv = document.createElement('div');
    assistantMsgDiv.className = 'flex justify-start animate-fade-in';
    assistantMsgDiv.innerHTML = `
        <div class="max-w-3xl rounded-md p-5 border bg-[#080808] border-white/5 text-[#d1d1d1] mr-12 text-sm markdown-body">
            <div class="text-[9px] font-mono uppercase tracking-widest text-[#555] mb-2.5">AI ASSISTANT ANSWER</div>
            <div id="streaming-text" class="text-white/60">Typewriting answer...</div>
            <div id="streaming-sources"></div>
        </div>
    `;
    messagesContainer.appendChild(assistantMsgDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    const streamingTextDiv = document.getElementById('streaming-text');
    const streamingSourcesDiv = document.getElementById('streaming-sources');

    try {
        const response = await fetch('/api/chat/stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: activeSessionId, message: query })
        });

        if (!response.body) return;
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        let currentEvent = '';
        let streamedAnswer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop(); // Keep partial line in buffer

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;

                if (trimmed.startsWith('event:')) {
                    currentEvent = trimmed.slice(6).trim();
                } else if (trimmed.startsWith('data:')) {
                    const rawData = trimmed.slice(5).trim();
                    
                    if (currentEvent === 'sources') {
                        try {
                            const sources = JSON.parse(rawData);
                            if (sources && sources.length > 0) {
                                streamStatus.textContent = 'Streaming generative synthesis...';
                                streamingSourcesDiv.innerHTML = `
                                    <div class="mt-4 pt-3.5 border-t border-white/5">
                                        <span class="text-[9px] font-mono uppercase tracking-widest text-[#555] block mb-2">Sources Citations:</span>
                                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            ${sources.map(src => `
                                                <div class="bg-white/5 border border-white/5 rounded p-2.5 text-[10px]">
                                                    <div class="flex items-center justify-between text-[#8a8a8a] font-mono text-[9px] uppercase mb-1">
                                                        <span>${src.chunk.documentName.slice(0, 18)}</span>
                                                        <span>Page ${src.chunk.pageIndex}</span>
                                                    </div>
                                                    <p class="text-white font-serif italic line-clamp-3">"${src.chunk.text}"</p>
                                                </div>
                                            `).join('')}
                                        </div>
                                    </div>
                                `;
                            }
                        } catch (e) {
                            console.error(e);
                        }
                    } else if (currentEvent === 'token') {
                        try {
                            const parsed = JSON.parse(rawData);
                            streamedAnswer += parsed.text;
                            streamingTextDiv.innerHTML = streamedAnswer.replace(/\n/g, '<br>');
                            streamingTextDiv.className = "text-white"; // restore opacity
                        } catch (e) {
                            console.error(e);
                        }
                    } else if (currentEvent === 'done') {
                        try {
                            const parsedResult = JSON.parse(rawData);
                            // Refresh conversational session history
                            await fetchSessions();
                            selectSession(activeSessionId);
                        } catch (e) {
                            console.error(e);
                        }
                    } else if (currentEvent === 'error') {
                        try {
                            const parsedErr = JSON.parse(rawData);
                            alert(`Error: ${parsedErr.error}`);
                        } catch (e) {
                            console.error(e);
                        }
                    }
                }
            }
        }
    } catch (err) {
        console.error(err);
        alert('Stream connection error occurred.');
    } finally {
        streamPreview.classList.add('hidden');
    }
}
