import { marked } from 'marked';
import hljs from 'highlight.js';
import { checkServerStatus, saveApiKey, streamChatMessage } from './api.js';

// ==========================================
// Marked & Highlight Configuration
// ==========================================
marked.setOptions({
  gfm: true,
  breaks: true,
  highlight: function(code, lang) {
    const language = hljs.getLanguage(lang) ? lang : 'plaintext';
    return hljs.highlight(code, { language }).value;
  }
});

// Custom renderer for code blocks to add header, Apply to IDE & copy button
const renderer = new marked.Renderer();
renderer.code = function(token) {
  const text = token.text || token;
  const lang = token.lang || 'code';
  const language = hljs.getLanguage(lang) ? lang : 'plaintext';
  const highlighted = hljs.getLanguage(lang)
    ? hljs.highlight(text, { language: lang }).value
    : hljs.highlightAuto(text).value;

  const escapedCode = encodeURIComponent(text);

  return `
    <div class="code-block-wrapper">
      <div class="code-block-header">
        <span>${lang || 'code'}</span>
        <div style="display:flex;align-items:center;">
          <button class="apply-ide-code-btn" data-code="${escapedCode}" onclick="window.applyCodeToIDE(this)" title="Open & Edit in Cursor IDE">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
            <span>Apply to IDE</span>
          </button>
          <button class="copy-code-btn" data-code="${escapedCode}" onclick="window.copyCodeSnippet(this)">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            <span>Copy</span>
          </button>
        </div>
      </div>
      <pre><code class="hljs language-${language}">${highlighted}</code></pre>
    </div>
  `;
};
marked.use({ renderer });

// Global helper for code snippet copy
window.copyCodeSnippet = function(button) {
  const code = decodeURIComponent(button.getAttribute('data-code'));
  navigator.clipboard.writeText(code).then(() => {
    const originalText = button.innerHTML;
    button.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
      <span style="color:#10b981">Copied!</span>
    `;
    setTimeout(() => {
      button.innerHTML = originalText;
    }, 2000);
  });
};

// Global helper to load code directly into Cursor IDE
window.applyCodeToIDE = function(button) {
  const code = decodeURIComponent(button.getAttribute('data-code'));
  loadCodeIntoIDE(code);
  switchTab('editor');
  showToast('Applied code into Cursor IDE!');
};

// ==========================================
// 🎨 /image Engine Presets & PRO Prompt Rules
// ==========================================
const IMAGE_PROMPT_PRESETS = [
  {
    id: 'logo',
    keywords: ['logo', 'brand', 'icon', 'branding', 'symbol'],
    title: 'Minimal Futuristic Logo',
    prompt: `Minimal futuristic logo for "Klyro AI", glowing neon blue and purple gradient, abstract AI symbol (star + neural network fusion), dark background, glassmorphism style, soft glow, modern tech branding, clean vector, highly polished, 4k, centered composition`,
    localAsset: '/assets/logo.jpg'
  },
  {
    id: 'workspace',
    keywords: ['workspace', 'futuristic ai workspace', 'hero', 'dashboard ui', 'unica'],
    title: 'AI Workspace Dashboard UI',
    prompt: `Futuristic AI workspace dashboard for "Klyro AI – Unica Engine", dark mode interface, neon blue and cyan glowing accents, glassmorphism panels, sidebar navigation, AI chat panel, code editor, command bar, modern SaaS UI, highly detailed, ultra clean, cinematic lighting, 4k`,
    localAsset: '/assets/workspace_hero.jpg'
  },
  {
    id: 'cursor',
    keywords: ['cursor', 'editor', 'ide', 'code editor', 'coding interface', 'developer workspace'],
    title: 'Cursor-like Editor UI',
    prompt: `Advanced AI coding interface similar to Cursor IDE, dark theme, Monaco code editor in center, AI assistant panel on right with chat and suggestions, sidebar with files and projects, glowing UI elements, modern developer workspace, futuristic, ultra detailed`,
    localAsset: '/assets/cursor_ide.jpg'
  },
  {
    id: 'chat',
    keywords: ['chat', 'chat interface', 'conversational', 'chat bubbles'],
    title: 'Premium AI Chat Interface',
    prompt: `Premium AI chat interface for Klyro AI, dark UI, glowing chat bubbles, streaming responses, action buttons like apply, refactor, explain, modern input box with icons, minimal and clean design, futuristic SaaS interface, high detail`,
    localAsset: null
  },
  {
    id: 'dashboard',
    keywords: ['project dashboard', 'saas dashboard', 'projects', 'analytics', 'finance tracker'],
    title: 'Modern Project Dashboard',
    prompt: `Modern SaaS dashboard showing multiple AI projects, cards layout with apps like finance tracker, AI tools, startup ideas, analytics graphs, dark theme with neon gradients, glassmorphism UI, clean spacing, professional product design`,
    localAsset: null
  },
  {
    id: 'command',
    keywords: ['command', 'command bar', 'command palette', 'floating command', 'palette'],
    title: 'Floating Command Bar UI',
    prompt: `Floating command palette UI, dark blurred background, search bar with text "Create a SaaS app", dropdown suggestions like debug code, generate API, design UI, glowing selection highlight, futuristic interface, clean minimal design`,
    localAsset: null
  },
  {
    id: 'tools',
    keywords: ['tools', 'ai tools', 'tools grid', 'grid', 'app generator'],
    title: 'AI Tools Grid',
    prompt: `Grid of AI tools in a SaaS interface, cards like App Generator, Code Debugger, API Builder, UI Generator, neon gradient borders, dark modern UI, glassmorphism, highly polished product design`,
    localAsset: null
  },
  {
    id: 'landing',
    keywords: ['landing', 'landing page', 'hero', 'marketing', 'all-in-one'],
    title: 'Futuristic SaaS Landing Page Hero',
    prompt: `Futuristic SaaS landing page for Klyro AI, large hero text "Your All-in-One AI Workspace", glowing 3D icon, dark gradient background, neon blue and purple theme, modern typography, buttons like AI Chat and Code Editor, cinematic lighting, premium design`,
    localAsset: null
  }
];

const STYLE_VARIATIONS = [
  'cyberpunk style',
  'minimal Apple-like UI',
  'Figma design system',
  'startup landing page style',
  'dribbble shot'
];

function convertToProPrompt(userInput) {
  const cleanInput = userInput.replace(/^\/image\s*/i, '').trim();
  const lower = cleanInput.toLowerCase();

  for (const preset of IMAGE_PROMPT_PRESETS) {
    if (preset.keywords.some(k => lower.includes(k))) {
      return {
        title: preset.title,
        prompt: preset.prompt,
        localAsset: preset.localAsset,
        input: cleanInput
      };
    }
  }

  // Fallback PRO Prompt (INSANE quality)
  const topic = cleanInput || 'Futuristic AI SaaS interface';
  return {
    title: `AI Visual: ${topic}`,
    prompt: `Ultra modern futuristic AI SaaS interface for "${topic}", dark mode, neon blue, cyan and purple glowing accents, glassmorphism UI panels, sidebar navigation, AI chat assistant, code editor, command palette, highly detailed, cinematic lighting, premium product design, 4k, sharp, clean, no people`,
    localAsset: null,
    input: cleanInput
  };
}

// ==========================================
// 💻 Cursor IDE Virtual File System
// ==========================================
const IDE_FILES = {
  'App.jsx': `import React, { useState } from 'react';
import { KlyroEngine } from '@klyro/engine';
import { CommandBar, CopilotChat, CodeEditor } from './components';

export default function App() {
  const [activeProject, setActiveProject] = useState('FinTech Micro-SaaS');
  const [engineReady, setEngineReady] = useState(true);

  return (
    <div className="klyro-ide-root dark-mode">
      <header className="ide-topbar">
        <h1 className="logo-glow">Klyro AI — Cursor Engine</h1>
        <CommandBar placeholder="Type 'Create a SaaS app' or ⌘K..." />
      </header>

      <main className="ide-split-pane">
        <CodeEditor 
          theme="vs-dark"
          defaultLanguage="javascript"
          options={{ minimap: { enabled: true }, fontSize: 13 }}
        />
        <CopilotChat 
          model="gemini-3.5-flash-lite"
          streaming={true}
          autoRefactor={true}
        />
      </main>
    </div>
  );
}`,
  'auth.js': `// High-Performance JWT & Rate Limiting Middleware
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'klyro-ai-secret-key-3.5';

export const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid token format' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Token expired or unauthorized' });
  }
};`,
  'engine.js': `// Klyro AI - Unica Master Engine Integration
import { GoogleGenAI } from '@google/genai';

export async function runUnicaPipeline({ prompt, mode = 'problem-solving', level = 'intermediate' }) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  const response = await ai.models.generateContent({
    model: 'gemini-3.5-flash-lite',
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      temperature: 0.7,
      maxOutputTokens: 2500
    }
  });

  return response.text;
}`,
  'schema.sql': `-- PostgreSQL Scalable Micro-SaaS Schema
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  stripe_customer_id VARCHAR(100),
  plan_tier VARCHAR(50) DEFAULT 'pro',
  status VARCHAR(50) DEFAULT 'active'
);

CREATE TABLE ai_audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  tokens_used INT NOT NULL,
  latency_ms INT NOT NULL,
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);`,
  'styles.css': `/* Klyro AI Glassmorphism & Neon Glow Tokens */
:root {
  --neon-cyan: #00e5ff;
  --neon-purple: #8b5cf6;
  --bg-deep: #05070c;
  --card-glass: rgba(13, 19, 33, 0.75);
}

.ide-workspace {
  background: var(--bg-deep);
  border: 1px solid rgba(0, 229, 255, 0.2);
  backdrop-filter: blur(20px);
}`
};

let activeIdeFile = 'App.jsx';

// ==========================================
// Application State
// ==========================================
const STORAGE_KEY_CHATS = 'klyro_chats_v2';

let chats = [];
let activeChatId = null;
let currentMode = 'general';
let currentLevel = 'intermediate';
let isGenerating = false;
let attachedFile = null; // { name, content }
let isRecordingVoice = false;
let speechRecognizer = null;
let currentSelectedCmdIndex = 0;
let filteredCommands = [];
let currentTab = 'chat';
const navHistory = [];

// ==========================================
// DOM Element Selectors
// ==========================================
const app = document.getElementById('app');
const chatContainer = document.getElementById('chatContainer');
const welcomeHero = document.getElementById('welcomeHero');
const messagesList = document.getElementById('messagesList');
const typingIndicator = document.getElementById('typingIndicator');
const promptForm = document.getElementById('promptForm');
const promptInput = document.getElementById('promptInput');
const sendBtn = document.getElementById('sendBtn');
const activeChatTitle = document.getElementById('activeChatTitle');
const topbarBackBtn = document.getElementById('topbarBackBtn');
const crumbBrandBtn = document.getElementById('crumbBrandBtn');
const chatsList = document.getElementById('chatsList');
const pinnedChatsList = document.getElementById('pinnedChatsList');
const pinnedChatsSection = document.getElementById('pinnedChatsSection');
const sidebarSearchInput = document.getElementById('sidebarSearchInput');
const newChatBtn = document.getElementById('newChatBtn');
const clearAllChatsBtn = document.getElementById('clearAllChatsBtn');
const sidebar = document.getElementById('sidebar');
const openSidebarBtn = document.getElementById('openSidebarBtn');
const closeSidebarBtn = document.getElementById('closeSidebarBtn');

// Command Center & Tool Buttons
const slashMenu = document.getElementById('slashMenu');
const fileUploadBtn = document.getElementById('fileUploadBtn');
const fileInput = document.getElementById('fileInput');
const quickImagePromptBtn = document.getElementById('quickImagePromptBtn');
const voiceMicBtn = document.getElementById('voiceMicBtn');
const filePreviewContainer = document.getElementById('filePreviewContainer');
const attachedFileName = document.getElementById('attachedFileName');
const removeFileBtn = document.getElementById('removeFileBtn');

// OS Views & Tabs
const inputAreaContainer = document.getElementById('inputAreaContainer');
const cursorIdeView = document.getElementById('cursorIdeView');
const saasStudioView = document.getElementById('saasStudioView');
const projectsToolsView = document.getElementById('projectsToolsView');
const memoryView = document.getElementById('memoryView');

const tabBtnChat = document.getElementById('tabBtnChat');
const tabBtnEditor = document.getElementById('tabBtnEditor');
const tabBtnStudio = document.getElementById('tabBtnStudio');
const tabBtnDashboard = document.getElementById('tabBtnDashboard');
const tabBtnMemory = document.getElementById('tabBtnMemory');

// Auto SaaS Generator
const saasNicheInput = document.getElementById('saasNicheInput');
const generateSaasBtn = document.getElementById('generateSaasBtn');
const saasResultsGrid = document.getElementById('saasResultsGrid');
const saasProblemText = document.getElementById('saasProblemText');
const saasPricingList = document.getElementById('saasPricingList');
const saasTechStackText = document.getElementById('saasTechStackText');
const saasTimelineText = document.getElementById('saasTimelineText');

// Level Selector Buttons
const levelBtns = document.querySelectorAll('.level-btn');
const toastNotification = document.getElementById('toastNotification');

// Command Palette Elements
const commandPaletteModal = document.getElementById('commandPaletteModal');
const cmdPaletteInput = document.getElementById('cmdPaletteInput');
const cmdPaletteResults = document.getElementById('cmdPaletteResults');
const closeCmdPaletteBtn = document.getElementById('closeCmdPaletteBtn');
const topbarCmdTrigger = document.getElementById('topbarCmdTrigger');
const sidebarCmdTrigger = document.getElementById('sidebarCmdTrigger');

// Lightbox Elements
const imageLightboxModal = document.getElementById('imageLightboxModal');
const lightboxImg = document.getElementById('lightboxImg');
const lightboxTitle = document.getElementById('lightboxTitle');
const lightboxPromptText = document.getElementById('lightboxPromptText');
const lightboxDownloadBtn = document.getElementById('lightboxDownloadBtn');
const lightboxCopyPromptBtn = document.getElementById('lightboxCopyPromptBtn');
const closeLightboxBtn = document.getElementById('closeLightboxBtn');

// Cursor IDE Elements
const ideCodeEditor = document.getElementById('ideCodeEditor');
const ideLineNumbers = document.getElementById('ideLineNumbers');
const ideActiveTab = document.getElementById('ideActiveTab');
const ideTabTitle = document.getElementById('ideTabTitle');
const ideRunBtn = document.getElementById('ideRunBtn');
const ideFormatBtn = document.getElementById('ideFormatBtn');
const ideCopyCodeBtn = document.getElementById('ideCopyCodeBtn');
const ideTerminalOutput = document.getElementById('ideTerminalOutput');
const clearTerminalBtn = document.getElementById('clearTerminalBtn');
const ideStatusCursor = document.getElementById('ideStatusCursor');
const ideStatusLang = document.getElementById('ideStatusLang');

const copilotRefactorBtn = document.getElementById('copilotRefactorBtn');
const copilotExplainBtn = document.getElementById('copilotExplainBtn');
const copilotDebugBtn = document.getElementById('copilotDebugBtn');
const copilotTypesBtn = document.getElementById('copilotTypesBtn');
const copilotChatHistory = document.getElementById('copilotChatHistory');
const copilotInput = document.getElementById('copilotInput');
const copilotSendBtn = document.getElementById('copilotSendBtn');

// ==========================================
// 1. Alive UI: Cursor Spotlight Tracker
// ==========================================
function initSpotlight() {
  window.addEventListener('pointermove', (e) => {
    const x = e.clientX;
    const y = e.clientY;
    document.documentElement.style.setProperty('--cursor-x', `${x}px`);
    document.documentElement.style.setProperty('--cursor-y', `${y}px`);
  });
}

// ==========================================
// 2. Storage & Session Management
// ==========================================
const DEFAULT_STARTER_CHATS = [
  {
    id: 'chat_pinned_1',
    title: 'Viva Preparation EDA',
    isPinned: true,
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    messages: [
      { role: 'user', content: 'Viva preparation for Exploratory Data Analysis' },
      { role: 'assistant', content: 'Key areas for EDA Viva:\n1. Missing value imputation (Mean/Median vs KNN)\n2. Outlier treatment (IQR vs Z-score)\n3. Correlation matrices & skewness transformation' }
    ]
  },
  {
    id: 'chat_pinned_2',
    title: 'Code Explanation and System Architecture',
    isPinned: true,
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    messages: [
      { role: 'user', content: 'Explain system architecture' },
      { role: 'assistant', content: 'The system uses an asynchronous decoupled event engine with live streaming, token estimation, and intelligent multi-mode routing.' }
    ]
  },
  {
    id: 'chat_pinned_3',
    title: 'Viva Preparation for MCQ & Core Models',
    isPinned: true,
    createdAt: new Date(Date.now() - 3600000 * 8).toISOString(),
    messages: [
      { role: 'user', content: 'Viva preparation for MCQs' },
      { role: 'assistant', content: 'Focus on precision, recall, F1 score, confusion matrices, and model bias-variance tradeoff.' }
    ]
  },
  {
    id: 'chat_recent_1',
    title: 'Build AI Master Prompt',
    isPinned: false,
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    messages: [
      { role: 'user', content: 'Build AI Master Prompt' },
      { role: 'assistant', content: 'Essential Master Prompt sections: Persona, Context, Goal, Constraints, Reasoning Step, and Output Format.' }
    ]
  },
  {
    id: 'chat_recent_2',
    title: 'Suggest UI Upgrades',
    isPinned: false,
    createdAt: new Date(Date.now() - 3600000 * 48).toISOString(),
    messages: [
      { role: 'user', content: 'Suggest UI Upgrades for mobile users' },
      { role: 'assistant', content: 'Floating circular buttons, bottom capsule dock, dynamic waveform/send arrow toggle, and drawer navigation matching ChatGPT mobile app.' }
    ]
  }
];

function loadChatsFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CHATS);
    if (!raw) return DEFAULT_STARTER_CHATS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_STARTER_CHATS;
  } catch (e) {
    return DEFAULT_STARTER_CHATS;
  }
}

function saveChatsToStorage() {
  localStorage.setItem(STORAGE_KEY_CHATS, JSON.stringify(chats));
}

function getActiveChat() {
  return chats.find(c => c.id === activeChatId);
}

function createNewChatSession() {
  const newChat = {
    id: 'chat_' + Date.now(),
    title: 'New Discussion',
    createdAt: new Date().toISOString(),
    isPinned: false,
    messages: []
  };
  chats.unshift(newChat);
  activeChatId = newChat.id;
  saveChatsToStorage();
  const mobileActiveTitle = document.getElementById('mobileActiveTitle');
  if (mobileActiveTitle) {
    mobileActiveTitle.textContent = 'Klyro AI';
  }
  updateBackButtonState();
  return activeChatId;
}

// ==========================================
// 3. Smart Sidebar Rendering
// ==========================================
function renderChatsList() {
  const query = (sidebarSearchInput.value || '').trim().toLowerCase();

  const filtered = chats.filter(c => {
    if (!query) return true;
    return (c.title || '').toLowerCase().includes(query);
  });

  const pinned = filtered.filter(c => c.isPinned);
  const recent = filtered.filter(c => !c.isPinned);

  // Pinned Section
  if (pinned.length > 0) {
    pinnedChatsSection.style.display = 'block';
    pinnedChatsList.innerHTML = '';
    pinned.forEach(chat => {
      pinnedChatsList.appendChild(createChatItemElement(chat));
    });
  } else {
    pinnedChatsSection.style.display = 'none';
    pinnedChatsList.innerHTML = '';
  }

  // Recent Section
  chatsList.innerHTML = '';
  if (recent.length === 0 && pinned.length === 0) {
    chatsList.innerHTML = `<div style="padding:10px;font-size:0.75rem;color:var(--text-muted);text-align:center;">No conversations found</div>`;
  } else {
    recent.forEach(chat => {
      chatsList.appendChild(createChatItemElement(chat));
    });
  }
}

function createChatItemElement(chat) {
  const item = document.createElement('div');
  item.className = `chat-item ${chat.id === activeChatId ? 'active' : ''}`;
  item.innerHTML = `
    <div class="chat-item-main">
      <svg class="chat-item-bubble-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      </svg>
      <span class="chat-item-title">${escapeHtml(chat.title)}</span>
    </div>
    <div class="chat-item-actions">
      <button class="chat-action-btn pin-btn ${chat.isPinned ? 'pinned' : ''}" title="${chat.isPinned ? 'Unpin chat' : 'Pin to top'}">
        📌
      </button>
      <button class="chat-action-btn delete-btn" title="Delete chat">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    </div>
  `;

  item.addEventListener('click', (e) => {
    if (e.target.closest('.chat-action-btn')) return;
    switchChatSession(chat.id);
    sidebar.classList.remove('open');
  });

  item.querySelector('.pin-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    chat.isPinned = !chat.isPinned;
    saveChatsToStorage();
    renderChatsList();
    showToast(chat.isPinned ? 'Chat pinned to top' : 'Chat unpinned');
  });

  item.querySelector('.delete-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    deleteChatSession(chat.id);
  });

  return item;
}

function renderActiveChat() {
  const chat = getActiveChat();
  if (!chat) return;

  const title = chat.title || 'New Discussion';
  activeChatTitle.textContent = title;

  const mobileActiveTitle = document.getElementById('mobileActiveTitle');
  if (mobileActiveTitle) {
    mobileActiveTitle.textContent = chat.messages.length === 0 ? 'Klyro AI' : title;
  }

  if (chat.messages.length === 0) {
    welcomeHero.style.display = 'flex';
    messagesList.innerHTML = '';
  } else {
    welcomeHero.style.display = 'none';
    messagesList.innerHTML = '';
    chat.messages.forEach(msg => {
      appendMessageToDOM(msg, false);
    });
    scrollToBottom();
  }
  updateBackButtonState();
}

// ==========================================
// 4. Message DOM Rendering (Text + /image Cards)
// ==========================================
function appendMessageToDOM(message, scroll = true) {
  const row = document.createElement('div');
  row.className = `message-row ${message.role}`;

  if (message.role === 'user') {
    row.innerHTML = `
      <div class="message-bubble user-bubble">
        ${escapeHtml(message.content)}
      </div>
    `;
  } else if (message.isImage) {
    // 🎨 Render AI Visual Card with PRO Prompt & Style Modifiers
    const safePrompt = escapeHtml(message.proPrompt || '');
    const imgUrl = message.imageUrl || message.localAsset;

    row.innerHTML = `
      <div class="assistant-avatar">🎨</div>
      <div class="message-bubble assistant-bubble" style="max-width: 90%; width: 100%;">
        <div class="message-header">
          <div class="assistant-name-group">
            <span class="assistant-name">Klyro Visual Studio</span>
            <span class="ai-image-badge">4K FLUX</span>
          </div>
          <div class="message-actions">
            <button class="action-icon-btn copy-prompt-btn" title="Copy PRO Prompt">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            </button>
          </div>
        </div>

        <div class="ai-image-card">
          <div class="ai-image-header">
            <div class="ai-image-title-group">
              <span>✦</span>
              <h4>${escapeHtml(message.imageTitle || 'Klyro AI Workspace Visual')}</h4>
            </div>
            <span class="ai-image-badge">Cinematic 4K</span>
          </div>

          <div class="ai-image-media-box" title="Click to view in 4K Lightbox">
            <img src="${imgUrl}" alt="${safePrompt}" class="generated-preview-img" loading="lazy" />
          </div>

          <div class="ai-image-prompt-details">
            <div class="prompt-bar-label">
              <span>🎯 Converted PRO Prompt</span>
              <button class="text-btn copy-prompt-inner-btn" style="color:var(--accent-color);font-size:0.7rem;">Copy Prompt</button>
            </div>
            <div class="prompt-pro-text">${safePrompt}</div>

            <div class="style-variations-strip">
              <span class="style-strip-label">💡 Style Variations:</span>
              ${STYLE_VARIATIONS.map(v => `<button class="style-variant-pill" data-style="${v}" data-base="${encodeURIComponent(message.baseInput || message.proPrompt)}">+ ${v}</button>`).join('')}
            </div>
          </div>
        </div>

        <div class="message-footer-actions">
          <button class="msg-action-pill zoom-image-btn">
            <span>🔍</span>
            <span>View Fullscreen</span>
          </button>
          <button class="msg-action-pill download-image-btn">
            <span>📥</span>
            <span>Download Image</span>
          </button>
          <button class="msg-action-pill primary regenerate-variant-btn">
            <span>✨</span>
            <span>Regenerate Variant</span>
          </button>
        </div>
      </div>
    `;

    // Hook up image interactions
    const imgEl = row.querySelector('.generated-preview-img');
    const mediaBox = row.querySelector('.ai-image-media-box');

    const openLightbox = () => {
      openImageLightbox({
        src: imgEl.src,
        title: message.imageTitle,
        prompt: message.proPrompt
      });
    };

    mediaBox.addEventListener('click', openLightbox);
    row.querySelector('.zoom-image-btn')?.addEventListener('click', openLightbox);

    row.querySelector('.download-image-btn')?.addEventListener('click', () => {
      downloadImageUrl(imgEl.src, 'klyro-ai-visual.jpg');
    });

    row.querySelectorAll('.copy-prompt-btn, .copy-prompt-inner-btn').forEach(b => {
      b.addEventListener('click', () => {
        navigator.clipboard.writeText(message.proPrompt);
        showToast('Copied PRO Prompt for Midjourney/Flux!');
      });
    });

    // Style variation chips
    row.querySelectorAll('.style-variant-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        const style = pill.dataset.style;
        const base = decodeURIComponent(pill.dataset.base);
        executeImageGeneration(base, style);
      });
    });

    row.querySelector('.regenerate-variant-btn')?.addEventListener('click', () => {
      executeImageGeneration(message.baseInput || message.imageTitle);
    });
  } else {
    // Regular Assistant Message with Markdown + Action Buttons
    const renderedHtml = marked.parse(message.content || '');
    const badgeText = (message.metadata?.mode || currentMode).toUpperCase();

    row.innerHTML = `
      <div class="assistant-avatar">✦</div>
      <div class="message-bubble assistant-bubble">
        <div class="message-header">
          <div class="assistant-name-group">
            <span class="assistant-name">Unica AI</span>
            <span class="message-badge">${badgeText}</span>
          </div>
          <div class="message-actions">
            <button class="action-icon-btn copy-msg-btn" title="Copy response text">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            </button>
          </div>
        </div>

        <div class="markdown-body">
          ${renderedHtml}
        </div>

        <!-- 💬 4. Action buttons: Apply, Refactor, Explain, Copy -->
        <div class="message-footer-actions">
          <button class="msg-action-pill primary apply-to-ide-action" title="Send code to Cursor IDE">
            <span>⚡</span>
            <span>Apply to Cursor IDE</span>
          </button>
          <button class="msg-action-pill refactor-action" title="Refactor and optimize">
            <span>🔄</span>
            <span>Refactor</span>
          </button>
          <button class="msg-action-pill explain-action" title="Explain step-by-step">
            <span>💡</span>
            <span>Explain</span>
          </button>
          <button class="msg-action-pill copy-action">
            <span>📋</span>
            <span>Copy</span>
          </button>
        </div>
      </div>
    `;

    // Hook up response action buttons
    row.querySelector('.copy-msg-btn').addEventListener('click', () => {
      navigator.clipboard.writeText(message.content);
      showToast('Copied response to clipboard');
    });

    row.querySelector('.copy-action').addEventListener('click', () => {
      navigator.clipboard.writeText(message.content);
      showToast('Copied response to clipboard');
    });

    row.querySelector('.apply-to-ide-action').addEventListener('click', () => {
      const codeMatch = message.content.match(/```(?:[a-zA-Z0-9_-]+)?\n([\s\S]*?)```/);
      const codeToApply = codeMatch ? codeMatch[1] : message.content;
      loadCodeIntoIDE(codeToApply);
      switchTab('editor');
      showToast('Transferred code to Cursor IDE!');
    });

    row.querySelector('.refactor-action').addEventListener('click', () => {
      promptInput.value = 'Refactor and optimize the previous code/solution for maximum performance and clean architecture.';
      handleUserSubmit();
    });

    row.querySelector('.explain-action').addEventListener('click', () => {
      promptInput.value = 'Explain the key architecture and logic of the previous response in simple, clear terms.';
      handleUserSubmit();
    });
  }

  messagesList.appendChild(row);
  if (scroll) scrollToBottom();
}

function scrollToBottom() {
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showToast(text, duration = 3000) {
  toastNotification.textContent = text;
  toastNotification.style.display = 'block';
  setTimeout(() => {
    toastNotification.style.display = 'none';
  }, duration);
}

// ==========================================
// 5. AI Mode Theme Morphing
// ==========================================
function setMode(mode) {
  currentMode = mode;
  app.setAttribute('data-theme', mode);

  // Sync sidebar pills
  document.querySelectorAll('#sidebarModePills .mode-pill').forEach(pill => {
    pill.classList.toggle('active', pill.dataset.mode === mode);
  });

  // Sync bottom strip buttons
  document.querySelectorAll('.input-mode-strip .mode-tag-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
}

function setLevel(level) {
  currentLevel = level;
  levelBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.level === level);
  });
}

// ==========================================
// 6. /image Visual Generation Engine
// ==========================================
function executeImageGeneration(rawInput, styleVariation = '') {
  const chat = getActiveChat();
  if (!chat) return;

  const proData = convertToProPrompt(rawInput);
  let finalPrompt = proData.prompt;

  if (styleVariation) {
    finalPrompt += `, ${styleVariation}`;
  }

  // Construct image URL (Pollinations Flux AI or Preset Asset)
  let imageUrl = '';
  if (!styleVariation && proData.localAsset) {
    imageUrl = proData.localAsset;
  } else {
    imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(finalPrompt)}?width=1280&height=720&nologo=true&model=flux`;
  }

  // Record user message if not already present
  const userText = styleVariation ? `/image ${proData.input} [${styleVariation}]` : `/image ${rawInput}`;
  const userMsg = { role: 'user', content: userText };
  chat.messages.push(userMsg);
  appendMessageToDOM(userMsg);

  welcomeHero.style.display = 'none';

  // Assistant image message
  const assistantMsg = {
    role: 'assistant',
    isImage: true,
    imageTitle: styleVariation ? `${proData.title} (${styleVariation})` : proData.title,
    proPrompt: finalPrompt,
    imageUrl: imageUrl,
    localAsset: proData.localAsset,
    baseInput: proData.input
  };

  chat.messages.push(assistantMsg);
  saveChatsToStorage();
  appendMessageToDOM(assistantMsg);

  // Set chat title if first message
  if (chat.messages.length <= 2) {
    chat.title = `Visual: ${proData.title}`;
    activeChatTitle.textContent = chat.title;
    renderChatsList();
  }

  showToast('Generated 4K AI Visual & PRO Prompt!');
}

// ==========================================
// 7. Streaming Real-Time Chat Submission
// ==========================================
async function handleUserSubmit() {
  let text = promptInput.value.trim();
  if ((!text && !attachedFile) || isGenerating) return;

  const chat = getActiveChat();
  if (!chat) return;

  // Intercept /image command
  if (text.startsWith('/image')) {
    promptInput.value = '';
    promptInput.style.height = 'auto';
    closeSlashMenu();
    closeCommandPalette();
    const query = text.replace(/^\/image\s*/, '').trim() || 'futuristic AI workspace';
    executeImageGeneration(query);
    return;
  }

  // Append attached file content if present
  if (attachedFile) {
    text = `${text}\n\n[Attached File: ${attachedFile.name}]\n\`\`\`\n${attachedFile.content}\n\`\`\``.trim();
    clearAttachedFile();
  }

  // Auto-generate title for first user prompt
  if (chat.messages.length === 0) {
    const cleanTitle = text.replace(/\[Attached File:.*?\n```[\s\S]*?```/g, '').trim();
    chat.title = cleanTitle.length > 32 ? cleanTitle.substring(0, 32) + '...' : cleanTitle;
    activeChatTitle.textContent = chat.title;
    renderChatsList();
  }

  // Push user message
  const userMsg = { role: 'user', content: text };
  chat.messages.push(userMsg);
  saveChatsToStorage();

  welcomeHero.style.display = 'none';
  appendMessageToDOM(userMsg);

  // Reset input box
  promptInput.value = '';
  promptInput.style.height = 'auto';
  closeSlashMenu();
  if (typeof updateSendButtonVisual === 'function') {
    updateSendButtonVisual();
  }

  // Create empty assistant response row in DOM for streaming
  const assistantRow = document.createElement('div');
  assistantRow.className = 'message-row assistant';
  const badgeText = currentMode.toUpperCase();

  assistantRow.innerHTML = `
    <div class="assistant-avatar">✦</div>
    <div class="message-bubble assistant-bubble">
      <div class="message-header">
        <div class="assistant-name-group">
          <span class="assistant-name">Unica AI</span>
          <span class="message-badge">${badgeText}</span>
        </div>
        <div class="message-actions">
          <button class="action-icon-btn copy-msg-btn" title="Copy response">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
          </button>
        </div>
      </div>
      <div class="markdown-body stream-content">
        <span class="streaming-cursor">▊</span>
      </div>
      <div class="message-footer-actions stream-footer-actions" style="display: none;">
        <button class="msg-action-pill primary apply-to-ide-action">
          <span>⚡</span>
          <span>Apply to Cursor IDE</span>
        </button>
        <button class="msg-action-pill refactor-action">
          <span>🔄</span>
          <span>Refactor</span>
        </button>
        <button class="msg-action-pill explain-action">
          <span>💡</span>
          <span>Explain</span>
        </button>
        <button class="msg-action-pill copy-action">
          <span>📋</span>
          <span>Copy</span>
        </button>
      </div>
    </div>
  `;

  messagesList.appendChild(assistantRow);
  scrollToBottom();

  const streamContentEl = assistantRow.querySelector('.stream-content');
  const footerActionsEl = assistantRow.querySelector('.stream-footer-actions');
  let accumulatedText = '';

  isGenerating = true;
  sendBtn.disabled = true;

  try {
    await streamChatMessage({
      messages: chat.messages,
      level: currentLevel,
      mode: currentMode,
      onToken: (token) => {
        accumulatedText += token;
        streamContentEl.innerHTML = marked.parse(accumulatedText) + '<span class="streaming-cursor">▊</span>';
        scrollToBottom();
      },
      onComplete: (metadata) => {
        streamContentEl.innerHTML = marked.parse(accumulatedText);
        footerActionsEl.style.display = 'flex';

        const assistantMsg = {
          role: 'assistant',
          content: accumulatedText,
          metadata: metadata || {}
        };
        chat.messages.push(assistantMsg);
        saveChatsToStorage();

        // Hook up copy button
        assistantRow.querySelector('.copy-msg-btn').addEventListener('click', () => {
          navigator.clipboard.writeText(accumulatedText);
          showToast('Copied response to clipboard');
        });

        assistantRow.querySelector('.copy-action').addEventListener('click', () => {
          navigator.clipboard.writeText(accumulatedText);
          showToast('Copied response to clipboard');
        });

        assistantRow.querySelector('.apply-to-ide-action').addEventListener('click', () => {
          const codeMatch = accumulatedText.match(/```(?:[a-zA-Z0-9_-]+)?\n([\s\S]*?)```/);
          const codeToApply = codeMatch ? codeMatch[1] : accumulatedText;
          loadCodeIntoIDE(codeToApply);
          switchTab('editor');
          showToast('Transferred code to Cursor IDE!');
        });

        assistantRow.querySelector('.refactor-action').addEventListener('click', () => {
          promptInput.value = 'Refactor and optimize the previous code/solution for maximum performance and clean architecture.';
          handleUserSubmit();
        });

        assistantRow.querySelector('.explain-action').addEventListener('click', () => {
          promptInput.value = 'Explain the key architecture and logic of the previous response in simple, clear terms.';
          handleUserSubmit();
        });
      },
      onError: (err) => {
        streamContentEl.innerHTML = `⚠️ **Error during streaming**: ${err.message}`;
      }
    });
  } catch (err) {
    console.error('Submit error:', err);
    streamContentEl.innerHTML = `⚠️ **Connection Error**: ${err.message}`;
  } finally {
    isGenerating = false;
    sendBtn.disabled = false;
    scrollToBottom();
  }
}

function switchChatSession(id, recordHistory = true) {
  if (recordHistory && activeChatId && activeChatId !== id) {
    navHistory.push({ type: 'chat', value: activeChatId });
    if (navHistory.length > 30) navHistory.shift();
  }
  activeChatId = id;
  renderChatsList();
  renderActiveChat();
  updateBackButtonState();
}

function deleteChatSession(id) {
  chats = chats.filter(c => c.id !== id);
  if (chats.length === 0) {
    createNewChatSession();
  } else if (activeChatId === id) {
    activeChatId = chats[0].id;
  }
  saveChatsToStorage();
  renderChatsList();
  renderActiveChat();
}

// ==========================================
// 8. Command Center & Slash Menu
// ==========================================
function openSlashMenu() {
  slashMenu.style.display = 'flex';
}

function closeSlashMenu() {
  slashMenu.style.display = 'none';
}

function executeSlashCommand(cmd) {
  closeSlashMenu();

  switch (cmd) {
    case '/image':
      promptInput.value = '/image futuristic AI workspace';
      promptInput.focus();
      break;
    case '/code':
      setMode('tech-assist');
      promptInput.value = 'Write clean, production-grade code for: ';
      promptInput.focus();
      break;
    case '/cursor':
      switchTab('editor');
      break;
    case '/startup':
      setMode('business');
      promptInput.value = 'Evaluate this startup idea and give realistic unit economics: ';
      promptInput.focus();
      break;
    case '/debug':
      setMode('tech-assist');
      promptInput.value = 'Debug and identify the bottleneck in this code: ';
      promptInput.focus();
      break;
    case '/saas':
      switchTab('studio');
      break;
    case '/clear':
      createNewChatSession();
      renderChatsList();
      renderActiveChat();
      showToast('New discussion started');
      break;
  }
}

// ==========================================
// ⚡ 9. Floating Command Palette (Cmd+K / Ctrl+K)
// ==========================================
const COMMAND_ITEMS = [
  // Actions
  { id: 'saas-app', group: 'Actions', icon: '⚡', title: 'Create a SaaS app', desc: 'Generate complete MVP blueprint with unit economics', action: () => { switchTab('studio'); saasNicheInput.focus(); } },
  { id: 'debug-code', group: 'Actions', icon: '🐞', title: 'Debug code', desc: 'Identify memory leaks, bottlenecks, and syntax errors', action: () => { switchTab('chat'); setMode('tech-assist'); promptInput.value = 'Debug this code issue: '; promptInput.focus(); } },
  { id: 'generate-api', group: 'Actions', icon: '🔌', title: 'Generate API', desc: 'Create production Node/Express REST and GraphQL endpoints', action: () => { switchTab('chat'); setMode('tech-assist'); promptInput.value = 'Generate a high-performance Express REST API for: '; promptInput.focus(); } },
  { id: 'design-ui', group: 'Actions', icon: '🎨', title: 'Design UI', desc: 'Build modern glassmorphic Tailwind & CSS components', action: () => { switchTab('chat'); promptInput.value = 'Design a glassmorphic dashboard component with dark mode tokens: '; promptInput.focus(); } },

  // Visuals & /image
  { id: 'img-workspace', group: 'Visual Engine (/image)', icon: '🧠', title: '/image futuristic AI workspace', desc: '4K futuristic AI workspace dashboard with neon glowing accents', action: () => executeImageGeneration('futuristic AI workspace') },
  { id: 'img-cursor', group: 'Visual Engine (/image)', icon: '💻', title: '/image cursor ide editor', desc: 'Advanced AI coding interface similar to Cursor IDE', action: () => executeImageGeneration('cursor') },
  { id: 'img-logo', group: 'Visual Engine (/image)', icon: '✨', title: '/image logo brand', desc: 'Minimal futuristic logo with neural network & star fusion', action: () => executeImageGeneration('logo') },
  { id: 'img-chat', group: 'Visual Engine (/image)', icon: '💬', title: '/image chat interface', desc: 'Premium AI chat interface with action buttons & streaming', action: () => executeImageGeneration('chat') },
  { id: 'img-dashboard', group: 'Visual Engine (/image)', icon: '📊', title: '/image project dashboard', desc: 'Modern SaaS project dashboard with analytics graphs', action: () => executeImageGeneration('dashboard') },
  { id: 'img-command', group: 'Visual Engine (/image)', icon: '⚡', title: '/image command bar', desc: 'Floating command palette UI with dark blurred background', action: () => executeImageGeneration('command') },
  { id: 'img-tools', group: 'Visual Engine (/image)', icon: '🛠️', title: '/image ai tools grid', desc: 'Grid of AI tools with neon gradient borders and glassmorphism', action: () => executeImageGeneration('tools') },
  { id: 'img-landing', group: 'Visual Engine (/image)', icon: '🚀', title: '/image landing page hero', desc: 'Futuristic SaaS landing page hero with 3D glowing icon', action: () => executeImageGeneration('landing') },

  // Navigation
  { id: 'nav-editor', group: 'Navigation', icon: '💻', title: 'Open Cursor IDE', desc: 'Switch to live code editor and Copilot coding workspace', action: () => switchTab('editor') },
  { id: 'nav-chat', group: 'Navigation', icon: '💬', title: 'Open Chat OS', desc: 'Return to conversational intelligence workspace', action: () => switchTab('chat') },
  { id: 'nav-studio', group: 'Navigation', icon: '⚡', title: 'Open Auto SaaS Studio', desc: 'Generate rapid micro-SaaS blueprints and timelines', action: () => switchTab('studio') },
  { id: 'nav-dash', group: 'Navigation', icon: '📊', title: 'Open Projects & AI Tools', desc: 'View live SaaS portfolios and telemetry metrics', action: () => switchTab('dashboard') },

  // Modes & Levels
  { id: 'mode-problem', group: 'Modes & Levels', icon: '⚙️', title: 'Switch to Problem-Solving Mode', desc: 'Enforces structured Overview, Plan, Code, and Tips', action: () => setMode('problem-solving') },
  { id: 'mode-tech', group: 'Modes & Levels', icon: '🚀', title: 'Switch to Tech Assist Mode', desc: 'Clean, working code with zero unnecessary theory', action: () => setMode('tech-assist') },
  { id: 'mode-biz', group: 'Modes & Levels', icon: '💡', title: 'Switch to Business Mode', desc: 'Unit economics, validation, and SaaS monetization', action: () => setMode('business') },
  { id: 'level-adv', group: 'Modes & Levels', icon: '🎯', title: 'Set Depth to Advanced', desc: 'High-depth architectural execution and edge cases', action: () => setLevel('advanced') },
  { id: 'action-clear', group: 'Actions', icon: '🗑️', title: 'Clear Conversation', desc: 'Start a fresh chat discussion', action: () => { createNewChatSession(); renderChatsList(); renderActiveChat(); showToast('Started new discussion'); } }
];

function openCommandPalette() {
  commandPaletteModal.style.display = 'flex';
  cmdPaletteInput.value = '';
  currentSelectedCmdIndex = 0;
  renderCommandPaletteResults('');
  setTimeout(() => cmdPaletteInput.focus(), 50);
}

function closeCommandPalette() {
  commandPaletteModal.style.display = 'none';
}

function renderCommandPaletteResults(query = '') {
  const cleanQ = query.trim().toLowerCase();

  filteredCommands = COMMAND_ITEMS.filter(item => {
    if (!cleanQ) return true;
    return item.title.toLowerCase().includes(cleanQ) || item.desc.toLowerCase().includes(cleanQ) || item.group.toLowerCase().includes(cleanQ);
  });

  if (filteredCommands.length === 0) {
    // If user typed a custom image prompt
    if (cleanQ.startsWith('/image') || cleanQ.includes('image')) {
      filteredCommands = [
        {
          id: 'custom-image',
          group: 'Visual Engine',
          icon: '🎨',
          title: `/image ${query.replace(/^\/image\s*/, '')}`,
          desc: 'Generate custom 4K image with PRO prompt expansion',
          action: () => executeImageGeneration(query.replace(/^\/image\s*/, ''))
        }
      ];
    } else {
      cmdPaletteResults.innerHTML = `<div style="padding:24px;text-align:center;color:var(--text-muted);font-size:0.85rem;">No matching commands found. Type <code>/image &lt;prompt&gt;</code> to create visual assets.</div>`;
      return;
    }
  }

  // Group items by category
  const groups = {};
  filteredCommands.forEach((cmd, idx) => {
    if (!groups[cmd.group]) groups[cmd.group] = [];
    groups[cmd.group].push({ ...cmd, originalIdx: idx });
  });

  let html = '';
  let globalCounter = 0;

  for (const [groupName, items] of Object.entries(groups)) {
    html += `<div class="cmd-group-label">${groupName}</div>`;
    items.forEach(item => {
      const isSelected = globalCounter === currentSelectedCmdIndex;
      html += `
        <div class="cmd-result-item ${isSelected ? 'selected' : ''}" data-idx="${item.originalIdx}">
          <div class="cmd-item-left">
            <span class="cmd-item-icon">${item.icon}</span>
            <div class="cmd-item-info">
              <span class="cmd-item-title">${escapeHtml(item.title)}</span>
              <span class="cmd-item-desc">${escapeHtml(item.desc)}</span>
            </div>
          </div>
          <span class="cmd-item-badge">Select ↵</span>
        </div>
      `;
      globalCounter++;
    });
  }

  cmdPaletteResults.innerHTML = html;

  // Add click listeners to items
  cmdPaletteResults.querySelectorAll('.cmd-result-item').forEach(el => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.dataset.idx, 10);
      executeCommandByIndex(idx);
    });
  });
}

function executeCommandByIndex(index) {
  const cmd = filteredCommands[index];
  if (cmd && cmd.action) {
    closeCommandPalette();
    cmd.action();
  }
}

// ==========================================
// 💻 10. Cursor IDE Logic & Copilot Panel
// ==========================================
function initCursorIDE() {
  loadFileIntoEditor(activeIdeFile);

  // File tree switching
  document.querySelectorAll('#ideFileTree .ide-file-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('#ideFileTree .ide-file-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      const file = item.dataset.file;
      loadFileIntoEditor(file);
    });
  });

  // Editor line numbering & keystroke handler
  ideCodeEditor.addEventListener('input', () => {
    updateLineNumbers();
    IDE_FILES[activeIdeFile] = ideCodeEditor.value;
  });

  ideCodeEditor.addEventListener('selectionchange', updateCursorPosition);
  ideCodeEditor.addEventListener('keyup', updateCursorPosition);
  ideCodeEditor.addEventListener('click', updateCursorPosition);

  // Run Button Simulation
  ideRunBtn.addEventListener('click', () => {
    ideTerminalOutput.innerHTML = `
      <span class="term-accent">⚙️ Compiling ${activeIdeFile}...</span><br>
      <span class="term-dim">[Webpack 5 / Vite Engine] Parsing AST & type definitions...</span><br>
      <span class="term-success">✔ Build completed in 84ms!</span><br>
      <span class="term-dim">Running runtime test suite: 6 passed, 0 failed.</span><br>
      <span class="term-success">🚀 Service online and healthy at http://localhost:3000</span>
    `;
    showToast('Code build & run simulated successfully!');
  });

  // Format Code Simulation
  ideFormatBtn.addEventListener('click', () => {
    try {
      const lines = ideCodeEditor.value.split('\n');
      const formatted = lines.map(l => l.trimRight()).join('\n');
      ideCodeEditor.value = formatted;
      IDE_FILES[activeIdeFile] = formatted;
      showToast('Code formatted with Prettier rules');
    } catch (e) {}
  });

  // Copy Code Button
  ideCopyCodeBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(ideCodeEditor.value);
    showToast(`Copied ${activeIdeFile} to clipboard`);
  });

  // Clear Terminal Output
  clearTerminalBtn.addEventListener('click', () => {
    ideTerminalOutput.innerHTML = `<span class="term-dim">[Klyro IDE] Terminal cleared. Ready.</span>`;
  });

  // Copilot Quick Action Buttons
  copilotRefactorBtn.addEventListener('click', () => {
    handleCopilotAction('Refactor Code for Peak Performance');
  });

  copilotExplainBtn.addEventListener('click', () => {
    handleCopilotAction('Explain Code Architecture');
  });

  copilotDebugBtn.addEventListener('click', () => {
    handleCopilotAction('Debug & Check Edge Cases');
  });

  copilotTypesBtn.addEventListener('click', () => {
    handleCopilotAction('Add Type Safety & Validation');
  });

  // Copilot Chat Input
  copilotSendBtn.addEventListener('click', handleCopilotSubmit);
  copilotInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleCopilotSubmit();
  });
}

function loadFileIntoEditor(fileName) {
  activeIdeFile = fileName;
  ideTabTitle.textContent = fileName;
  const content = IDE_FILES[fileName] || '// Empty file';
  ideCodeEditor.value = content;
  updateLineNumbers();

  const langMap = {
    'App.jsx': 'JavaScript (React)',
    'auth.js': 'JavaScript (Node.js)',
    'engine.js': 'JavaScript (ESM)',
    'schema.sql': 'PostgreSQL SQL',
    'styles.css': 'CSS3 Modules'
  };
  ideStatusLang.textContent = langMap[fileName] || 'Plain Text';
}

function loadCodeIntoIDE(codeSnippet) {
  IDE_FILES['App.jsx'] = codeSnippet;
  loadFileIntoEditor('App.jsx');
  document.querySelectorAll('#ideFileTree .ide-file-item').forEach(i => {
    i.classList.toggle('active', i.dataset.file === 'App.jsx');
  });
}

function updateLineNumbers() {
  const lineCount = (ideCodeEditor.value.split('\n').length) || 1;
  let nums = '';
  for (let i = 1; i <= lineCount; i++) {
    nums += i + '<br>';
  }
  ideLineNumbers.innerHTML = nums;
}

function updateCursorPosition() {
  const text = ideCodeEditor.value.substring(0, ideCodeEditor.selectionStart);
  const lines = text.split('\n');
  const lineNum = lines.length;
  const colNum = lines[lines.length - 1].length + 1;
  ideStatusCursor.textContent = `Ln ${lineNum}, Col ${colNum}`;
}

function handleCopilotAction(actionType) {
  const msgDiv = document.createElement('div');
  msgDiv.className = 'copilot-msg user';
  msgDiv.innerHTML = `
    <div class="copilot-msg-header"><span>You</span><span class="time">Now</span></div>
    <p>${actionType} on <code>${activeIdeFile}</code></p>
  `;
  copilotChatHistory.appendChild(msgDiv);

  // Simulated Copilot AI Response
  setTimeout(() => {
    const aiDiv = document.createElement('div');
    aiDiv.className = 'copilot-msg assistant';

    if (actionType.includes('Refactor')) {
      const optimized = `// Refactored with memoization and clean async error boundaries\n` + ideCodeEditor.value;
      ideCodeEditor.value = optimized;
      IDE_FILES[activeIdeFile] = optimized;
      updateLineNumbers();

      aiDiv.innerHTML = `
        <div class="copilot-msg-header"><span>Copilot</span><span class="time">Just now</span></div>
        <p>✔ Refactored <code>${activeIdeFile}</code> for reduced bundle size and defensive error handling. Applied updates directly to editor.</p>
      `;
    } else if (actionType.includes('Explain')) {
      aiDiv.innerHTML = `
        <div class="copilot-msg-header"><span>Copilot</span><span class="time">Just now</span></div>
        <p><strong>Architecture Overview</strong>: <code>${activeIdeFile}</code> implements modular separation of concerns. It handles inputs gracefully and connects directly to the Unica AI pipeline with sub-millisecond response latency.</p>
      `;
    } else if (actionType.includes('Debug')) {
      aiDiv.innerHTML = `
        <div class="copilot-msg-header"><span>Copilot</span><span class="time">Just now</span></div>
        <p>✔ Scanned <code>${activeIdeFile}</code> AST: 0 memory leaks, strict boundary validation passed. Safe for production deployment.</p>
      `;
    } else {
      aiDiv.innerHTML = `
        <div class="copilot-msg-header"><span>Copilot</span><span class="time">Just now</span></div>
        <p>✔ Applied schema validation and type guards to parameters in <code>${activeIdeFile}</code>.</p>
      `;
    }

    copilotChatHistory.appendChild(aiDiv);
    copilotChatHistory.scrollTop = copilotChatHistory.scrollHeight;
  }, 400);
}

function handleCopilotSubmit() {
  const val = copilotInput.value.trim();
  if (!val) return;
  copilotInput.value = '';

  const userDiv = document.createElement('div');
  userDiv.className = 'copilot-msg user';
  userDiv.innerHTML = `
    <div class="copilot-msg-header"><span>You</span><span class="time">Now</span></div>
    <p>${escapeHtml(val)}</p>
  `;
  copilotChatHistory.appendChild(userDiv);

  setTimeout(() => {
    const aiDiv = document.createElement('div');
    aiDiv.className = 'copilot-msg assistant';
    aiDiv.innerHTML = `
      <div class="copilot-msg-header"><span>Copilot</span><span class="time">Just now</span></div>
      <p>Understood. I analyzed your request <em>"${escapeHtml(val)}"</em> and verified compatibility with <code>${activeIdeFile}</code>.</p>
    `;
    copilotChatHistory.appendChild(aiDiv);
    copilotChatHistory.scrollTop = copilotChatHistory.scrollHeight;
  }, 450);
}

// ==========================================
// 🖼️ 11. Lightbox Modal & Image Downloads
// ==========================================
function openImageLightbox({ src, title, prompt }) {
  lightboxImg.src = src;
  lightboxTitle.textContent = title || 'Klyro AI Visual';
  lightboxPromptText.textContent = prompt || '';
  lightboxDownloadBtn.onclick = () => downloadImageUrl(src, 'klyro-ai-visual.jpg');
  lightboxCopyPromptBtn.onclick = () => {
    navigator.clipboard.writeText(prompt);
    showToast('Copied PRO Prompt!');
  };
  imageLightboxModal.style.display = 'flex';
}

function closeImageLightbox() {
  imageLightboxModal.style.display = 'none';
}

function downloadImageUrl(url, filename) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast('Initiating download...');
}

// ==========================================
// 12. File Attachment & Drag & Drop
// ==========================================
function handleFileSelect(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    attachedFile = {
      name: file.name,
      content: e.target.result
    };
    attachedFileName.textContent = file.name;
    filePreviewContainer.style.display = 'block';
    showToast(`Attached ${file.name}`);
  };
  reader.readAsText(file);
}

function clearAttachedFile() {
  attachedFile = null;
  fileInput.value = '';
  filePreviewContainer.style.display = 'none';
}

// ==========================================
// 13. Voice Dictation (Speech Recognition)
// ==========================================
function toggleVoiceInput() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert('Voice speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.');
    return;
  }

  if (isRecordingVoice && speechRecognizer) {
    speechRecognizer.stop();
    return;
  }

  try {
    speechRecognizer = new SpeechRecognition();
    speechRecognizer.continuous = false;
    speechRecognizer.interimResults = false;
    speechRecognizer.lang = 'en-US';

    speechRecognizer.onstart = () => {
      isRecordingVoice = true;
      voiceMicBtn.classList.add('recording');
      showToast('Listening... Speak now');
    };

    speechRecognizer.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      promptInput.value = (promptInput.value ? promptInput.value + ' ' : '') + transcript;
      promptInput.style.height = Math.min(promptInput.scrollHeight, 180) + 'px';
      promptInput.focus();
    };

    speechRecognizer.onerror = (e) => {
      console.warn('Speech error:', e.error);
      isRecordingVoice = false;
      voiceMicBtn.classList.remove('recording');
    };

    speechRecognizer.onend = () => {
      isRecordingVoice = false;
      voiceMicBtn.classList.remove('recording');
    };

    speechRecognizer.start();
  } catch (err) {
    console.error('Speech recognition failed to initialize:', err);
  }
}

// ==========================================
// 14. OS Switcher Tabs & Back Navigation
// ==========================================
function updateBackButtonState() {
  if (!topbarBackBtn) return;
  const activeChat = getActiveChat();
  const hasChatMessages = activeChat && activeChat.messages && activeChat.messages.length > 0;
  const isNotInChat = currentTab !== 'chat';
  const hasHistory = navHistory.length > 0;

  if (hasHistory || isNotInChat || hasChatMessages) {
    topbarBackBtn.classList.add('has-history');
    if (isNotInChat) {
      topbarBackBtn.title = 'Back to Chat OS (Esc or Alt+←)';
    } else if (hasChatMessages) {
      topbarBackBtn.title = 'Back to New Discussion (Esc or Alt+←)';
    } else {
      topbarBackBtn.title = 'Go Back (Esc or Alt+←)';
    }
  } else {
    topbarBackBtn.classList.remove('has-history');
    topbarBackBtn.title = 'Return to New Discussion / Home';
  }
}

function handleGoBack() {
  // If sidebar is open on mobile, tapping back closes the sidebar drawer
  if (sidebar && sidebar.classList.contains('open')) {
    sidebar.classList.remove('open');
    return;
  }

  // Tactile press micro-interaction
  if (topbarBackBtn) {
    topbarBackBtn.style.transform = 'scale(0.93) translateX(-3px)';
    setTimeout(() => {
      topbarBackBtn.style.transform = '';
    }, 150);
  }

  // 1. If we have recorded history in our navigation stack, pop and restore
  while (navHistory.length > 0) {
    const item = navHistory.pop();
    if (item.type === 'tab' && item.value !== currentTab) {
      switchTab(item.value, false);
      showToast(`Returned to ${item.value === 'chat' ? 'Chat OS' : item.value.toUpperCase()}`);
      return;
    }
    if (item.type === 'chat' && item.value !== activeChatId) {
      const exists = chats.find(c => c.id === item.value);
      if (exists) {
        switchChatSession(item.value, false);
        showToast(`Back to "${exists.title}"`);
        return;
      }
    }
  }

  // 2. If in a non-chat tab, return to chat OS
  if (currentTab !== 'chat') {
    switchTab('chat', false);
    showToast('Back to Chat OS');
    return;
  }

  // 3. If in an existing discussion with messages, return to fresh new discussion / welcome hero
  const activeChat = getActiveChat();
  if (activeChat && activeChat.messages && activeChat.messages.length > 0) {
    createNewChatSession();
    renderChatsList();
    renderActiveChat();
    updateBackButtonState();
    showToast('Returned to New Discussion');
    return;
  }

  // 4. Browser history fallback
  if (window.history.length > 1) {
    window.history.back();
  } else {
    showToast('At the beginning of workspace');
  }
}

function switchTab(tab, recordHistory = true) {
  if (recordHistory && currentTab && currentTab !== tab) {
    navHistory.push({ type: 'tab', value: currentTab });
    if (navHistory.length > 30) navHistory.shift();
  }
  currentTab = tab;

  [tabBtnChat, tabBtnEditor, tabBtnStudio, tabBtnDashboard, tabBtnMemory].forEach(b => {
    if (b) b.classList.toggle('active', b.dataset.tab === tab);
  });

  document.querySelectorAll('.sidebar-view-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });

  // Hide all view containers
  chatContainer.style.display = 'none';
  inputAreaContainer.style.display = 'none';
  cursorIdeView.style.display = 'none';
  saasStudioView.style.display = 'none';
  projectsToolsView.style.display = 'none';
  memoryView.style.display = 'none';

  if (tab === 'chat') {
    chatContainer.style.display = 'flex';
    inputAreaContainer.style.display = 'block';
  } else if (tab === 'editor') {
    cursorIdeView.style.display = 'flex';
    updateLineNumbers();
  } else if (tab === 'studio') {
    saasStudioView.style.display = 'flex';
  } else if (tab === 'dashboard') {
    projectsToolsView.style.display = 'block';
  } else if (tab === 'memory') {
    memoryView.style.display = 'flex';
  }

  updateBackButtonState();
}

function handleGenerateSaas() {
  const niche = saasNicheInput.value.trim();
  if (!niche) {
    alert('Please enter a niche or SaaS idea.');
    return;
  }

  generateSaasBtn.disabled = true;
  generateSaasBtn.textContent = 'Generating Blueprint...';

  setTimeout(() => {
    saasResultsGrid.style.display = 'grid';
    saasProblemText.textContent = `High-friction operational bottleneck in ${niche}. Teams lose 12+ hours/week manually handling repetitive data reconciliation and fragmented client communication.`;
    saasPricingList.innerHTML = `
      <li><strong>Starter ($29/mo)</strong>: Solo operators, 500 tasks/mo, email alerts.</li>
      <li><strong>Scale ($99/mo)</strong>: 5 seats, automated webhook pipeline, priority processing.</li>
      <li><strong>Enterprise ($299/mo)</strong>: Custom CRM integrations & dedicated SLA.</li>
    `;
    saasTechStackText.textContent = `Full-stack Next.js 15 (App Router), TailwindCSS, Supabase (Auth + RLS Postgres), Stripe Billing, and Gemini 3.5 API.`;
    saasTimelineText.textContent = `Week 1: Schema & Core Logic • Week 2: Dashboard UI & Auth • Week 3: Stripe Checkout • Week 4: Direct outreach to 30 early prospects.`;

    generateSaasBtn.disabled = false;
    generateSaasBtn.textContent = 'Blueprint Ready! 🚀';
    showToast('SaaS MVP Blueprint generated!');
  }, 850);
}

// ==========================================
// 15. Event Listeners Setup
// ==========================================
function initEventListeners() {
  // Submit Form
  promptForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleUserSubmit();
  });

  // Dynamic Send Button Visual (Waveform vs Send Arrow)
  window.updateSendButtonVisual = function() {
    const text = (promptInput.value || '').trim();
    const waveformSvg = sendBtn ? sendBtn.querySelector('.waveform-svg') : null;
    const sendArrowSvg = sendBtn ? sendBtn.querySelector('.send-arrow-svg') : null;
    if (waveformSvg && sendArrowSvg) {
      if (text.length > 0) {
        waveformSvg.style.display = 'none';
        sendArrowSvg.style.display = 'block';
        sendBtn.classList.add('ready-to-send');
      } else {
        waveformSvg.style.display = 'block';
        sendArrowSvg.style.display = 'none';
        sendBtn.classList.remove('ready-to-send');
      }
    }
  };

  // Prompt input handling & Slash Menu triggers
  promptInput.addEventListener('input', () => {
    promptInput.style.height = 'auto';
    promptInput.style.height = Math.min(promptInput.scrollHeight, 180) + 'px';
    if (window.updateSendButtonVisual) window.updateSendButtonVisual();

    const val = promptInput.value;
    if (val === '/' || val.startsWith('/')) {
      openSlashMenu();
    } else {
      closeSlashMenu();
    }
  });

  promptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleUserSubmit();
    }
    if (e.key === 'Escape') {
      closeSlashMenu();
    }
  });

  // Quick /image button beside prompt input
  quickImagePromptBtn.addEventListener('click', () => {
    promptInput.value = '/image futuristic AI workspace';
    promptInput.focus();
    showToast('Hit Enter to generate 4K futuristic AI workspace!');
  });

  // Slash Menu item click
  document.querySelectorAll('.slash-cmd-item').forEach(btn => {
    btn.addEventListener('click', () => {
      executeSlashCommand(btn.dataset.cmd);
    });
  });

  // Level selector buttons
  levelBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      setLevel(btn.dataset.level);
    });
  });

  // Sidebar mode pills
  document.querySelectorAll('#sidebarModePills .mode-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      setMode(pill.dataset.mode);
    });
  });

  // Input area mode tag buttons
  document.querySelectorAll('.input-mode-strip .mode-tag-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setMode(btn.dataset.mode);
    });
  });

  // Starter suggestion cards
  document.querySelectorAll('.starter-card').forEach(card => {
    card.addEventListener('click', () => {
      const prompt = card.dataset.prompt;
      const mode = card.dataset.mode;
      if (mode) setMode(mode);
      promptInput.value = prompt;
      promptInput.focus();
      handleUserSubmit();
    });
  });

  // New Chat Button
  newChatBtn.addEventListener('click', () => {
    switchTab('chat');
    createNewChatSession();
    renderChatsList();
    renderActiveChat();
    sidebar.classList.remove('open');
    promptInput.focus();
  });

  // Clear all chats
  clearAllChatsBtn.addEventListener('click', () => {
    if (confirm('Clear all conversation history?')) {
      chats = [];
      createNewChatSession();
      renderChatsList();
      renderActiveChat();
      showToast('All discussions cleared');
    }
  });

  // Sidebar Search
  sidebarSearchInput.addEventListener('input', () => {
    renderChatsList();
  });

  // File Upload Handlers
  fileUploadBtn.addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  });

  removeFileBtn.addEventListener('click', clearAttachedFile);

  // Drag and Drop files onto workspace
  window.addEventListener('dragover', (e) => {
    e.preventDefault();
  });

  window.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  });

  // Voice Dictation
  voiceMicBtn.addEventListener('click', toggleVoiceInput);

  // Mobile sidebar & Backdrop
  openSidebarBtn.addEventListener('click', () => sidebar.classList.add('open'));
  closeSidebarBtn.addEventListener('click', () => sidebar.classList.remove('open'));
  const sidebarBackdrop = document.getElementById('sidebarBackdrop');
  if (sidebarBackdrop) {
    sidebarBackdrop.addEventListener('click', () => sidebar.classList.remove('open'));
  }

  // Mobile New Chat Button [ 💭 ]
  const mobileNewChatBtn = document.getElementById('mobileNewChatBtn');
  if (mobileNewChatBtn) {
    mobileNewChatBtn.addEventListener('click', () => {
      switchTab('chat');
      createNewChatSession();
      renderChatsList();
      renderActiveChat();
      sidebar.classList.remove('open');
      promptInput.focus();
    });
  }

  // Mobile Drawer Chat Pill Button [ ✏️ Chat ]
  const drawerChatPillBtn = document.getElementById('drawerChatPillBtn');
  if (drawerChatPillBtn) {
    drawerChatPillBtn.addEventListener('click', () => {
      switchTab('chat');
      createNewChatSession();
      renderChatsList();
      renderActiveChat();
      sidebar.classList.remove('open');
      promptInput.focus();
    });
  }

  // Mobile Drawer Search Circle Button [ 🔍 ]
  const drawerSearchBtn = document.getElementById('drawerSearchBtn');
  if (drawerSearchBtn) {
    drawerSearchBtn.addEventListener('click', () => {
      sidebar.classList.remove('open');
      openCommandPalette();
    });
  }

  // Mobile Drawer Quick Nav Items
  const drawerNavImages = document.getElementById('drawerNavImages');
  if (drawerNavImages) {
    drawerNavImages.addEventListener('click', () => {
      switchTab('chat');
      sidebar.classList.remove('open');
      promptInput.value = '/image ';
      promptInput.focus();
      if (window.updateSendButtonVisual) window.updateSendButtonVisual();
    });
  }
  const drawerNavLibrary = document.getElementById('drawerNavLibrary');
  if (drawerNavLibrary) {
    drawerNavLibrary.addEventListener('click', () => {
      switchTab('studio');
      sidebar.classList.remove('open');
    });
  }
  const drawerNavProjects = document.getElementById('drawerNavProjects');
  if (drawerNavProjects) {
    drawerNavProjects.addEventListener('click', () => {
      switchTab('dashboard');
      sidebar.classList.remove('open');
    });
  }
  const drawerNavScheduled = document.getElementById('drawerNavScheduled');
  if (drawerNavScheduled) {
    drawerNavScheduled.addEventListener('click', () => {
      switchTab('editor');
      sidebar.classList.remove('open');
    });
  }
  const drawerNavPlugins = document.getElementById('drawerNavPlugins');
  if (drawerNavPlugins) {
    drawerNavPlugins.addEventListener('click', () => {
      switchTab('memory');
      sidebar.classList.remove('open');
    });
  }

  // Dynamic Send/Voice Button Click
  sendBtn.addEventListener('click', (e) => {
    const text = (promptInput.value || '').trim();
    if (!text && window.innerWidth <= 768) {
      e.preventDefault();
      toggleVoiceInput();
    }
  });

  // Sidebar Views Navigator
  document.querySelectorAll('.sidebar-view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab(btn.dataset.tab);
      sidebar.classList.remove('open');
    });
  });

  // OS Switcher Tabs (Desktop)
  tabBtnChat.addEventListener('click', () => switchTab('chat'));
  tabBtnEditor.addEventListener('click', () => switchTab('editor'));
  tabBtnStudio.addEventListener('click', () => switchTab('studio'));
  tabBtnDashboard.addEventListener('click', () => switchTab('dashboard'));
  tabBtnMemory.addEventListener('click', () => switchTab('memory'));

  // Upgraded Back Button & Breadcrumbs Navigation
  if (topbarBackBtn) {
    topbarBackBtn.addEventListener('click', handleGoBack);
  }

  // Mobile ChatGPT-style Centered Pill click (opens quick command palette / switcher)
  const mobileCenterPill = document.getElementById('mobileCenterPill');
  if (mobileCenterPill) {
    mobileCenterPill.addEventListener('click', openCommandPalette);
  }

  // Native Touch Edge-Swipe Navigation (ChatGPT Mobile Style)
  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartTime = 0;

  window.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchStartTime = Date.now();
  }, { passive: true });

  window.addEventListener('touchend', (e) => {
    if (!e.changedTouches || e.changedTouches.length !== 1) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX;
    const deltaY = e.changedTouches[0].clientY - touchStartY;
    const deltaTime = Date.now() - touchStartTime;

    // Horizontal swipe detection
    if (Math.abs(deltaX) > Math.abs(deltaY) * 1.5 && deltaTime < 350) {
      // Swiping right from left edge (< 48px) opens sidebar drawer
      if (touchStartX < 48 && deltaX > 50 && !sidebar.classList.contains('open')) {
        sidebar.classList.add('open');
      }
      // Swiping left when sidebar is open closes it
      else if (sidebar.classList.contains('open') && deltaX < -50) {
        sidebar.classList.remove('open');
      }
    }
  }, { passive: true });

  if (crumbBrandBtn) {
    crumbBrandBtn.addEventListener('click', () => {
      if (currentTab !== 'chat') {
        switchTab('chat');
      } else {
        createNewChatSession();
        renderChatsList();
        renderActiveChat();
        updateBackButtonState();
        showToast('Started new discussion');
      }
    });
  }

  // View Return / Back Buttons inside SaaS, Projects, Memory, and IDE
  document.querySelectorAll('.view-back-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.return || 'chat';
      switchTab(target);
    });
  });

  // Global Keyboard Shortcuts for Back Navigation: Esc and Alt+ArrowLeft
  window.addEventListener('keydown', (e) => {
    // Alt + Left Arrow for Back Navigation
    if (e.altKey && e.key === 'ArrowLeft') {
      e.preventDefault();
      handleGoBack();
      return;
    }

    // Escape for Back Navigation (when no modals or populated inputs)
    if (e.key === 'Escape') {
      const isCmdOpen = commandPaletteModal && commandPaletteModal.style.display !== 'none';
      const isLightboxOpen = imageLightboxModal && imageLightboxModal.style.display !== 'none';
      const isSettingsOpen = settingsModal && settingsModal.style.display !== 'none';
      const isSlashOpen = slashMenu && slashMenu.style.display !== 'none';

      if (isCmdOpen || isLightboxOpen || isSettingsOpen || isSlashOpen) {
        return; // Handled by respective modal close listeners
      }

      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
        if (document.activeElement.value && document.activeElement.value.trim() !== '') {
          return; // Don't interrupt user typing
        }
        document.activeElement.blur();
      }

      handleGoBack();
    }
  });

  // Auto SaaS Studio Button
  generateSaasBtn.addEventListener('click', handleGenerateSaas);
  saasNicheInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleGenerateSaas();
  });

  // Global Command Palette Shortcut: Cmd+K / Ctrl+K
  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (commandPaletteModal.style.display === 'none') {
        openCommandPalette();
      } else {
        closeCommandPalette();
      }
    }
  });

  topbarCmdTrigger.addEventListener('click', openCommandPalette);
  sidebarCmdTrigger.addEventListener('click', openCommandPalette);
  closeCmdPaletteBtn.addEventListener('click', closeCommandPalette);

  // Command palette backdrop click
  commandPaletteModal.addEventListener('click', (e) => {
    if (e.target === commandPaletteModal) closeCommandPalette();
  });

  // Command Palette Input & Arrow Key Navigation
  cmdPaletteInput.addEventListener('input', () => {
    currentSelectedCmdIndex = 0;
    renderCommandPaletteResults(cmdPaletteInput.value);
  });

  cmdPaletteInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeCommandPalette();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (filteredCommands.length > 0) {
        currentSelectedCmdIndex = (currentSelectedCmdIndex + 1) % filteredCommands.length;
        renderCommandPaletteResults(cmdPaletteInput.value);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (filteredCommands.length > 0) {
        currentSelectedCmdIndex = (currentSelectedCmdIndex - 1 + filteredCommands.length) % filteredCommands.length;
        renderCommandPaletteResults(cmdPaletteInput.value);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      executeCommandByIndex(currentSelectedCmdIndex);
    }
  });

  // Lightbox close listeners
  closeLightboxBtn.addEventListener('click', closeImageLightbox);
  imageLightboxModal.addEventListener('click', (e) => {
    if (e.target === imageLightboxModal) closeImageLightbox();
  });

  // AI Tools Grid click listeners
  document.querySelectorAll('.tool-card').forEach(card => {
    card.addEventListener('click', () => {
      const action = card.dataset.action;
      if (action === 'app-generator') {
        switchTab('studio');
      } else if (action === 'code-debugger') {
        switchTab('editor');
        handleCopilotAction('Debug & Check Edge Cases');
      } else if (action === 'api-builder') {
        switchTab('chat');
        setMode('tech-assist');
        promptInput.value = 'Generate an authenticated, rate-limited Express REST API with input validation: ';
        promptInput.focus();
      } else if (action === 'ui-generator') {
        switchTab('chat');
        promptInput.value = 'Create a dark glassmorphic UI component with neon blue accents and responsive grid: ';
        promptInput.focus();
      } else if (action === 'visual-studio') {
        switchTab('chat');
        executeImageGeneration('futuristic AI workspace');
      }
    });
  });
}

// ==========================================
// 16. Initialization
// ==========================================
function init() {
  initSpotlight();
  chats = loadChatsFromStorage();
  if (!Array.isArray(chats) || chats.length === 0) {
    createNewChatSession();
  } else {
    activeChatId = chats[0].id;
  }
  renderChatsList();
  renderActiveChat();
  setMode('general');
  setLevel('intermediate');
  initCursorIDE();
  initEventListeners();
  updateBackButtonState();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
