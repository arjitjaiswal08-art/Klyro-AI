# Klyro AI — Powered by Unica AI Engine

**Klyro AI** is a full-stack, responsive AI web application built on top of the **Unica AI Master Engine** and Google's Gemini LLMs.

### 🌐 Live Production Deployment
👉 **[https://klyro-ai-gilt.vercel.app](https://klyro-ai-gilt.vercel.app)**

---

## 🌟 Key Features

1. **Unica AI Intelligent System**:
   - Adheres strictly to clarity, structured problem solving, and contextual continuity.
   - **⚙️ Problem-Solving Mode**: Always structures answers with Overview, Step-by-Step Plan, Production Code, and Tips/Best Practices.
   - **🚀 Tech & Code Assist Mode**: Direct, working code with syntax highlighting and 1-click copy.
   - **💡 Business & SaaS Mode**: Scalable ideas, unit economics, validation roadmaps, and MVP timelines.
   - **Adaptive Depth**: Instantly toggle between **Beginner** (gentle explanations), **Intermediate** (structured guidance), and **Advanced** (production architectural depth).

2. **Full-Stack Architecture**:
   - **Backend**: Node.js & Express server with multi-turn chat memory, prompt orchestration, and Google Gemini SDK integration.
   - **Frontend**: Vite + Vanilla CSS & JS with glassmorphism, responsive sidebar, chat session persistence (`localStorage`), markdown rendering, and code syntax highlighting.
   - **Settings & Key Management**: In-app modal to configure and test your Google Gemini API key or switch models (`gemini-2.5-flash`, `gemini-1.5-flash`, `gemini-1.5-pro`).
   - **Interactive Demo Fallback**: Works immediately even before adding an API key!

---

## 🚀 Getting Started

### 1. Installation
Run from the project root:
```bash
npm run install:all
```

### 2. Configure Environment (Optional)
Copy `.env.example` to `.env` or paste your key directly in the web app's **Gemini Settings** modal:
```env
PORT=3001
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash
```
*(Get a free API key at [Google AI Studio](https://aistudio.google.com/app/apikey))*

### 3. Launch App
Run both backend and frontend concurrently:
```bash
npm run dev
```

- **Frontend**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:3001](http://localhost:3001)

---

## 📂 Project Structure

```
Klyro AI/
├── client/                     # Vite Frontend Application
│   ├── index.html              # Main HTML Shell
│   ├── vite.config.js          # Vite configuration with API proxy
│   ├── src/
│   │   ├── api.js              # Backend communication layer
│   │   ├── main.js             # UI state, markdown parsing, and event handling
│   │   └── styles/main.css     # Dark mode glassmorphic design system
│   └── package.json
├── server/                     # Express Backend API
│   ├── src/
│   │   ├── index.js            # Express server entrypoint & routes
│   │   ├── gemini.js           # Gemini API client & intelligent fallback
│   │   └── prompts.js          # Unica AI Master System Prompt & injectors
│   └── package.json
├── package.json                # Root orchestration scripts
├── .env.example                # Sample environment file
└── README.md
```
