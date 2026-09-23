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

// Custom renderer for code blocks to add header & copy button
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
        <button class="copy-code-btn" data-code="${escapedCode}" onclick="window.copyCodeSnippet(this)">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
          <span>Copy</span>
        </button>
      </div>
      <pre><code class="hljs language-${language}">${highlighted}</code></pre>
    </div>
  `;
};
marked.use({ renderer });

// Global helper for the rendered HTML copy buttons
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
const voiceMicBtn = document.getElementById('voiceMicBtn');
const filePreviewContainer = document.getElementById('filePreviewContainer');
const attachedFileName = document.getElementById('attachedFileName');
const removeFileBtn = document.getElementById('removeFileBtn');

// OS Views & Tabs
const inputAreaContainer = document.getElementById('inputAreaContainer');
const saasStudioView = document.getElementById('saasStudioView');
const memoryView = document.getElementById('memoryView');
const tabBtnChat = document.getElementById('tabBtnChat');
const tabBtnStudio = document.getElementById('tabBtnStudio');
const tabBtnMemory = document.getElementById('tabBtnMemory');
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
function loadChatsFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CHATS);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
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
  return activeChatId;
}

// ==========================================
// 3. Smart Sidebar Rendering (Search + Pinned)
// ==========================================
function renderChatsList() {
  const query = (sidebarSearchInput.value || '').trim().toLowerCase();

  const filtered = chats.filter(c => {
    if (!query) return true;
    return (c.title || '').toLowerCase().includes(query);
  });

  const pinned = filtered.filter(c => c.isPinned);
  const recent = filtered.filter(c => !c.isPinned);

  // Render Pinned Section
  if (pinned.length > 0) {
    pinnedChatsSection.style.display = 'flex';
    pinnedChatsList.innerHTML = '';
    pinned.forEach(chat => {
      pinnedChatsList.appendChild(createChatItemElement(chat));
    });
  } else {
    pinnedChatsSection.style.display = 'none';
    pinnedChatsList.innerHTML = '';
  }

  // Render Recent Section
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
      <span style="font-size:0.85rem;opacity:0.7;">💬</span>
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

  activeChatTitle.textContent = chat.title || 'New Discussion';

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
}

function appendMessageToDOM(message, scroll = true) {
  const row = document.createElement('div');
  row.className = `message-row ${message.role}`;

  if (message.role === 'user') {
    row.innerHTML = `
      <div class="message-bubble user-bubble">
        ${escapeHtml(message.content)}
      </div>
    `;
  } else {
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
      </div>
    `;

    row.querySelector('.copy-msg-btn').addEventListener('click', () => {
      navigator.clipboard.writeText(message.content);
      showToast('Copied response to clipboard');
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
// 4. AI Mode Theme Morphing
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
// 5. Streaming Real-Time Chat Submission
// ==========================================
async function handleUserSubmit() {
  let text = promptInput.value.trim();
  if ((!text && !attachedFile) || isGenerating) return;

  const chat = getActiveChat();
  if (!chat) return;

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
    </div>
  `;

  messagesList.appendChild(assistantRow);
  scrollToBottom();

  const streamContentEl = assistantRow.querySelector('.stream-content');
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

function switchChatSession(id) {
  activeChatId = id;
  renderChatsList();
  renderActiveChat();
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
// 6. Command Center & Slash Menu
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
    case '/code':
      setMode('tech-assist');
      promptInput.value = 'Write clean, production-grade code for: ';
      promptInput.focus();
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
// 7. File Attachment & Drag & Drop
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
// 8. Voice Dictation (Speech Recognition)
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
// 9. OS Switcher Tabs & Auto SaaS Generator
// ==========================================
function switchTab(tab) {
  [tabBtnChat, tabBtnStudio, tabBtnMemory].forEach(b => b.classList.remove('active'));

  if (tab === 'chat') {
    tabBtnChat.classList.add('active');
    chatContainer.style.display = 'flex';
    inputAreaContainer.style.display = 'block';
    saasStudioView.style.display = 'none';
    memoryView.style.display = 'none';
  } else if (tab === 'studio') {
    tabBtnStudio.classList.add('active');
    chatContainer.style.display = 'none';
    inputAreaContainer.style.display = 'none';
    saasStudioView.style.display = 'flex';
    memoryView.style.display = 'none';
  } else if (tab === 'memory') {
    tabBtnMemory.classList.add('active');
    chatContainer.style.display = 'none';
    inputAreaContainer.style.display = 'none';
    saasStudioView.style.display = 'none';
    memoryView.style.display = 'flex';
  }
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
  }, 900);
}

// ==========================================
// 10. Event Listeners Setup
// ==========================================
function initEventListeners() {
  // Submit Form
  promptForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleUserSubmit();
  });

  // Prompt input handling & Slash Menu triggers
  promptInput.addEventListener('input', () => {
    promptInput.style.height = 'auto';
    promptInput.style.height = Math.min(promptInput.scrollHeight, 180) + 'px';

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

  // Mobile sidebar
  openSidebarBtn.addEventListener('click', () => sidebar.classList.add('open'));
  closeSidebarBtn.addEventListener('click', () => sidebar.classList.remove('open'));

  // OS Switcher Tabs
  tabBtnChat.addEventListener('click', () => switchTab('chat'));
  tabBtnStudio.addEventListener('click', () => switchTab('studio'));
  tabBtnMemory.addEventListener('click', () => switchTab('memory'));

  // Auto SaaS Studio Button
  generateSaasBtn.addEventListener('click', handleGenerateSaas);
  saasNicheInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleGenerateSaas();
  });
}

// ==========================================
// Initialization
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
  initEventListeners();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
