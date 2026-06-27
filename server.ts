import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import pdfParseModule from 'pdf-parse';
const pdf = typeof pdfParseModule === 'function' ? pdfParseModule : ((pdfParseModule as any).default || pdfParseModule);
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { UploadedFile, DocChunk, VectorDbItem, ChatSession, ChatMessage, SearchResult } from './src/types';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Setup Storage Paths
const DATA_DIR = path.join(process.cwd(), 'data');
const FILES_FILE = path.join(DATA_DIR, 'files.json');
const VECTOR_DB_FILE = path.join(DATA_DIR, 'vector_db.json');
const CHATS_FILE = path.join(DATA_DIR, 'chats.json');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Lazy AI Client setup to prevent crash on startup
let aiClient: any = null;
function getAiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '') {
    throw new Error('GEMINI_API_KEY is not configured. Please add your Gemini API key in the Secrets/Settings panel.');
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// Persistence Helpers
function loadJSON<T>(filePath: string, defaultValue: T): T {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error(`Error loading JSON from ${filePath}:`, error);
  }
  return defaultValue;
}

function saveJSON<T>(filePath: string, data: T): void {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error(`Error saving JSON to ${filePath}:`, error);
  }
}

// DB state
let files: UploadedFile[] = loadJSON<UploadedFile[]>(FILES_FILE, []);
let vectorDb: VectorDbItem[] = loadJSON<VectorDbItem[]>(VECTOR_DB_FILE, []);
let chatSessions: ChatSession[] = loadJSON<ChatSession[]>(CHATS_FILE, []);

// Multer in-memory storage for PDFs (supports both mime type and file extension check for robustness)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // limit to 15MB
  fileFilter: (req, file, cb) => {
    const isPdfMime = file.mimetype === 'application/pdf';
    const isPdfExt = file.originalname.toLowerCase().endsWith('.pdf');
    if (isPdfMime || isPdfExt) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are supported!'));
    }
  }
});

// Chunker with sliding overlap
function chunkText(text: string, maxChunkSize = 800, overlap = 150): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  let currentWords: string[] = [];
  let currentLength = 0;
  
  for (const word of words) {
    currentWords.push(word);
    currentLength += word.length + 1; // approximate space
    
    if (currentLength >= maxChunkSize) {
      chunks.push(currentWords.join(' '));
      // sliding overlap
      const overlapWordCount = Math.max(1, Math.floor(overlap / 6));
      currentWords = currentWords.slice(-overlapWordCount);
      currentLength = currentWords.join(' ').length;
    }
  }
  
  if (currentWords.length > 0) {
    chunks.push(currentWords.join(' '));
  }
  
  return chunks.filter(c => c.trim().length > 15);
}

// Batch vector embeddings generator to respect rate limit
async function generateEmbeddingsInBatches(texts: string[], batchSize = 5): Promise<number[][]> {
  const ai = getAiClient();
  const embeddings: number[][] = [];
  
  for (let i = 0; i < texts.length; i += batchSize) {
    const batchTexts = texts.slice(i, i + batchSize);
    const batchPromises = batchTexts.map(async (text) => {
      // Clean the text and check if it is empty/whitespace
      const cleanedText = (text || '').trim();
      if (!cleanedText) {
        console.warn('generateEmbeddingsInBatches: Found empty/whitespace text, using zero vector.');
        return new Array(3072).fill(0); // gemini-embedding-2-preview has 3072 dimensions
      }

      try {
        const response = await ai.models.embedContent({
          model: 'gemini-embedding-2-preview',
          contents: cleanedText,
        });
        
        if (!response || !response.embeddings || !response.embeddings[0] || !response.embeddings[0].values) {
          console.error('generateEmbeddingsInBatches failed for text:', {
            textLength: cleanedText.length,
            textPreview: cleanedText.substring(0, 100),
            fullResponse: JSON.stringify(response)
          });
          throw new Error('Empty embedding response values');
        }
        return response.embeddings[0].values;
      } catch (err: any) {
        console.error('Error in batch embedding item for text:', {
          textLength: cleanedText.length,
          textPreview: cleanedText.substring(0, 100),
          error: err.message || err
        });
        throw err;
      }
    });
    
    const results = await Promise.all(batchPromises);
    embeddings.push(...results);
  }
  return embeddings;
}

// Cosine Similarity calculation
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Custom page-by-page rendering function for pdf-parse (guarded with safety checks and an extremely reliable fallback)
async function parsePdfPages(buffer: Buffer): Promise<{ pageCount: number, pages: { pageNum: number, text: string }[] }> {
  const pages: { pageNum: number, text: string }[] = [];
  
  try {
    const options = {
      pagerender: function (pageData: any) {
        if (!pageData) return Promise.resolve('');
        return pageData.getTextContent({ normalizeWhitespace: true })
          .then(function (textContent: any) {
            let lastY: number | undefined;
            let text = '';
            if (textContent && Array.isArray(textContent.items)) {
              for (const item of textContent.items) {
                if (!item || typeof item !== 'object') continue;
                const str = typeof item.str === 'string' ? item.str : '';
                const transform = Array.isArray(item.transform) ? item.transform : null;
                
                if (transform && transform.length >= 6) {
                  const y = transform[5];
                  if (lastY === undefined || lastY === y) {
                    text += str + ' ';
                  } else {
                    text += '\n' + str + ' ';
                  }
                  lastY = y;
                } else {
                  text += str + ' ';
                }
              }
            }
            pages.push({
              pageNum: (pageData.pageIndex !== undefined ? pageData.pageIndex : 0) + 1,
              text: text.trim()
            });
            return text;
          });
      }
    };

    const parsed = await pdf(buffer, options);
    pages.sort((a, b) => a.pageNum - b.pageNum);
    
    if (pages.length > 0) {
      return {
        pageCount: parsed.numpages || pages.length,
        pages
      };
    }
  } catch (err) {
    console.warn('Custom page rendering failed, falling back to default pdf-parse text extraction:', err);
  }

  // Fallback to standard robust pdf-parse text extraction
  const parsedDefault = await pdf(buffer);
  const fullText = parsedDefault.text || '';
  return {
    pageCount: parsedDefault.numpages || 1,
    pages: [{ pageNum: 1, text: fullText }]
  };
}

// API: Files list
app.get('/api/files', (req, res) => {
  res.json(files);
});

// API: Upload PDF file, chunk, and embed
app.post('/api/files/upload', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No PDF file uploaded' });
      return;
    }

    const { originalname, size, buffer } = req.file;
    const fileId = 'file_' + Date.now();

    // 1. Save preliminary state
    const newFile: UploadedFile = {
      id: fileId,
      name: originalname,
      size,
      type: 'application/pdf',
      pageCount: 0,
      uploadedAt: new Date().toISOString(),
      status: 'processing'
    };
    files.push(newFile);
    saveJSON(FILES_FILE, files);

    // Run extraction & embeddings in background
    (async () => {
      try {
        // 2. Extract text page-by-page
        const { pageCount, pages } = await parsePdfPages(buffer);
        
        let chunkCount = 0;
        const allChunks: { text: string; pageNum: number; chunkIdx: number }[] = [];

        // 3. Chunk each page
        for (const page of pages) {
          const pageChunks = chunkText(page.text, 800, 150);
          pageChunks.forEach((text, idx) => {
            allChunks.push({
              text,
              pageNum: page.pageNum,
              chunkIdx: idx
            });
          });
        }

        // 4. Generate embeddings in batches (complying with model and rate limit)
        const textsToEmbed = allChunks.map(c => c.text);
        const vectors = await generateEmbeddingsInBatches(textsToEmbed, 5);

        // 5. Add to vector DB
        const itemsToInsert: VectorDbItem[] = allChunks.map((c, i) => ({
          id: `chunk_${fileId}_${i}`,
          documentId: fileId,
          documentName: originalname,
          text: c.text,
          pageIndex: c.pageNum,
          chunkIndex: c.chunkIdx,
          embedding: vectors[i]
        }));

        vectorDb.push(...itemsToInsert);
        saveJSON(VECTOR_DB_FILE, vectorDb);

        // 6. Update file status
        const fileIdx = files.findIndex(f => f.id === fileId);
        if (fileIdx !== -1) {
          files[fileIdx].status = 'ready';
          files[fileIdx].pageCount = pageCount;
          files[fileIdx].chunkCount = itemsToInsert.length;
          saveJSON(FILES_FILE, files);
        }
      } catch (err: any) {
        console.error('Error processing PDF RAG:', err);
        const fileIdx = files.findIndex(f => f.id === fileId);
        if (fileIdx !== -1) {
          files[fileIdx].status = 'error';
          files[fileIdx].error = err.message || 'Processing failed';
          saveJSON(FILES_FILE, files);
        }
      }
    })();

    res.json(newFile);

  } catch (error: any) {
    console.error('Upload route error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// API: Delete a file and its chunks
app.delete('/api/files/:id', (req, res) => {
  const fileId = req.params.id;
  files = files.filter(f => f.id !== fileId);
  vectorDb = vectorDb.filter(chunk => chunk.documentId !== fileId);
  
  saveJSON(FILES_FILE, files);
  saveJSON(VECTOR_DB_FILE, vectorDb);
  
  res.json({ success: true, message: 'File and vector chunks deleted successfully.' });
});

// API: Chat Sessions
app.get('/api/sessions', (req, res) => {
  res.json(chatSessions);
});

app.post('/api/sessions', (req, res) => {
  const { title, documentIds } = req.body;
  const newSession: ChatSession = {
    id: 'session_' + Date.now(),
    title: title || 'New Conversation',
    messages: [],
    documentIds: documentIds || [],
    createdAt: new Date().toISOString()
  };
  chatSessions.push(newSession);
  saveJSON(CHATS_FILE, chatSessions);
  res.json(newSession);
});

app.delete('/api/sessions/:id', (req, res) => {
  const sessionId = req.params.id;
  chatSessions = chatSessions.filter(s => s.id !== sessionId);
  saveJSON(CHATS_FILE, chatSessions);
  res.json({ success: true });
});

// API: Update conversation session (rename or documentIds scope change)
app.put('/api/sessions/:id', (req, res) => {
  const sessionId = req.params.id;
  const { title, documentIds } = req.body;
  const sessionIdx = chatSessions.findIndex(s => s.id === sessionId);
  
  if (sessionIdx === -1) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  
  if (title !== undefined) {
    chatSessions[sessionIdx].title = title;
  }
  if (documentIds !== undefined && Array.isArray(documentIds)) {
    chatSessions[sessionIdx].documentIds = documentIds;
  }
  
  saveJSON(CHATS_FILE, chatSessions);
  res.json(chatSessions[sessionIdx]);
});

// API: Generate or retrieve document summary/highlights using Gemini
app.post('/api/files/:id/summary', async (req, res) => {
  const fileId = req.params.id;
  
  const fileIdx = files.findIndex(f => f.id === fileId);
  if (fileIdx === -1) {
    res.status(404).json({ error: 'File not found' });
    return;
  }
  
  const file = files[fileIdx];
  if (file.summary) {
    res.json(file.summary);
    return;
  }
  
  try {
    const fileChunks = vectorDb
      .filter(c => c.documentId === fileId)
      .sort((a, b) => a.chunkIndex - b.chunkIndex)
      .slice(0, 5);
      
    if (fileChunks.length === 0) {
      res.status(400).json({ error: 'No document text indexed yet. Please wait for indexing to finish.' });
      return;
    }
    
    const contextText = fileChunks.map(c => `[Page ${c.pageIndex}] ${c.text}`).join('\n\n');
    
    const ai = getAiClient();
    const systemInstruction = `You are a helpful reading assistant. Your task is to analyze the provided early parts of a document and generate a structured overview, key highlights, and 3 useful questions.
Be extremely accurate and make sure the overview and highlights are grounded in the actual text.
Return the response in the specified JSON schema format.`;

    const prompt = `Analyze this document extract:\n\n${contextText}\n\nGenerate the summary, highlights, and suggested questions.`;
    
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.3,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            overview: {
              type: Type.STRING,
              description: 'A 1-paragraph clear summary of the document purpose and main content.'
            },
            highlights: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '3 to 5 precise, high-value bullet points summarizing key findings or critical details.'
            },
            suggestedQuestions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '3 interesting, highly specific sample questions that are directly answerable by the text.'
            }
          },
          required: ['overview', 'highlights', 'suggestedQuestions']
        }
      }
    });
    
    const responseText = response.text;
    if (!responseText) {
      throw new Error('Empty response from Gemini');
    }
    
    const parsedSummary = JSON.parse(responseText.trim());
    
    files[fileIdx].summary = parsedSummary;
    saveJSON(FILES_FILE, files);
    
    res.json(parsedSummary);
    
  } catch (err: any) {
    console.error('Error generating document summary:', err);
    res.status(500).json({ error: err.message || 'Failed to generate document insights' });
  }
});

// API: Stream chat question-answering SSE
app.post('/api/chat/stream', async (req, res) => {
  const { sessionId, message } = req.body;
  
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Content-Encoding': 'none'
  });

  try {
    const sessionIdx = chatSessions.findIndex(s => s.id === sessionId);
    if (sessionIdx === -1) {
      res.write(`event: error\ndata: ${JSON.stringify({ error: 'Session not found' })}\n\n`);
      res.end();
      return;
    }

    const session = chatSessions[sessionIdx];
    const targetDocIds = session.documentIds || [];
    
    // 1. Filter vector database chunks to active session documents
    let activeChunks = vectorDb;
    if (targetDocIds.length > 0) {
      activeChunks = vectorDb.filter(chunk => targetDocIds.includes(chunk.documentId));
    }

    let retrievedSources: SearchResult[] = [];

    // 2. Perform Cosine Similarity Search if chunks exist
    if (activeChunks.length > 0) {
      const ai = getAiClient();
      
      // Embed query
      const queryEmbedRes = await ai.models.embedContent({
        model: 'gemini-embedding-2-preview',
        contents: message,
      });
      const queryVector = queryEmbedRes.embeddings?.[0]?.values;
      
      if (queryVector) {
        // Compute similarities
        const searchResults: SearchResult[] = activeChunks.map(chunk => {
          const similarity = cosineSimilarity(queryVector, chunk.embedding);
          const { embedding, ...chunkWithoutEmbedding } = chunk;
          return {
            chunk: chunkWithoutEmbedding,
            similarity
          };
        });

        // Sort and select top sources (thresholding above 0.15)
        retrievedSources = searchResults
          .filter(r => r.similarity > 0.15)
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, 4);
      }
    }

    // Send sources to client immediately
    res.write(`event: sources\ndata: ${JSON.stringify(retrievedSources)}\n\n`);

    // 3. Assemble RAG Context Prompt
    let contextStr = '';
    if (retrievedSources.length > 0) {
      contextStr = retrievedSources.map((src, index) => {
        return `[Source ${index + 1}] Document: ${src.chunk.documentName}, Page: ${src.chunk.pageIndex}\nContent: ${src.chunk.text}`;
      }).join('\n\n');
    } else {
      contextStr = 'No matching document context was found. The user is asking a general question.';
    }

    const systemInstruction = `You are an expert Document Q&A Assistant. Answer the user's question accurately based ONLY on the provided context document chunks.
If the context does not contain the answer, state clearly that the information is not available in the uploaded documents.
Always refer to the specific source document and page number when answering using inline citations (e.g. [Source 1], [Source 2]). Do not cite sources that are not in the context.
Keep your answers clear, professional, and well-structured, formatted in elegant Markdown.`;

    const userPrompt = `Context Chunks:\n${contextStr}\n\nQuestion: ${message}`;

    // 4. Invoke Gemini Stream
    const ai = getAiClient();
    const stream = await ai.models.generateContentStream({
      model: 'gemini-3.5-flash',
      contents: userPrompt,
      config: {
        systemInstruction,
        temperature: 0.2
      }
    });

    let fullAnswer = '';
    for await (const chunk of stream) {
      const token = chunk.text || '';
      fullAnswer += token;
      res.write(`event: token\ndata: ${JSON.stringify({ text: token })}\n\n`);
    }

    // 5. Save Q&A to Session history
    const userMsgId = 'msg_' + Date.now() + '_user';
    const assistantMsgId = 'msg_' + (Date.now() + 1) + '_assistant';
    
    const userMessage: ChatMessage = {
      id: userMsgId,
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    };
    
    const assistantMessage: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: fullAnswer,
      timestamp: new Date().toISOString(),
      sources: retrievedSources
    };

    session.messages.push(userMessage, assistantMessage);
    saveJSON(CHATS_FILE, chatSessions);

    res.write(`event: done\ndata: ${JSON.stringify({ userMessage, assistantMessage })}\n\n`);
    res.end();

  } catch (err: any) {
    console.error('SSE Chat Error:', err);
    res.write(`event: error\ndata: ${JSON.stringify({ error: err.message || 'Stream processing failed' })}\n\n`);
    res.end();
  }
});

// API: Clear vector database and loaded files (dev utility)
app.post('/api/dev/reset', (req, res) => {
  files = [];
  vectorDb = [];
  chatSessions = [];
  saveJSON(FILES_FILE, files);
  saveJSON(VECTOR_DB_FILE, vectorDb);
  saveJSON(CHATS_FILE, chatSessions);
  res.json({ success: true, message: 'All database entries reset successfully.' });
});

// API: Get Raw chunks of a file for inspector
app.get('/api/files/:id/chunks', (req, res) => {
  const fileId = req.params.id;
  const chunks = vectorDb
    .filter(c => c.documentId === fileId)
    .map(c => {
      const { embedding, ...rest } = c;
      return rest;
    });
  res.json(chunks);
});

// API: Search vector database directly for testing/playground
app.post('/api/dev/search', async (req, res) => {
  try {
    const { query, documentIds } = req.body;
    if (!query) {
      res.status(400).json({ error: 'Query is required' });
      return;
    }

    const ai = getAiClient();
    const queryEmbedRes = await ai.models.embedContent({
      model: 'gemini-embedding-2-preview',
      contents: query,
    });
    const queryVector = queryEmbedRes.embeddings?.[0]?.values;
    if (!queryVector) {
      res.status(500).json({ error: 'Could not generate embedding for query' });
      return;
    }

    let targetChunks = vectorDb;
    if (documentIds && Array.isArray(documentIds) && documentIds.length > 0) {
      targetChunks = vectorDb.filter(c => documentIds.includes(c.documentId));
    }

    const results = targetChunks.map(chunk => {
      const similarity = cosineSimilarity(queryVector, chunk.embedding);
      const { embedding, ...rest } = chunk;
      return {
        chunk: rest,
        similarity
      };
    }).sort((a, b) => b.similarity - a.similarity).slice(0, 10);

    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Search failed' });
  }
});

// Global Express Error Handler to prevent HTML fallbacks on API errors
app.use((err: any, req: any, res: any, next: any) => {
  console.error('Express Error Handler:', err);
  res.status(err.status || err.statusCode || 400).json({
    error: err.message || 'An error occurred during processing.'
  });
});

// Vite Integration Middleware
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
    console.log(`pdf-parse resolved function type:`, typeof pdf);
  });
}

startServer();
