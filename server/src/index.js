const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const { generateChatCompletion, streamChatCompletion } = require('./gemini');
const { buildSystemPrompt } = require('./prompts');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// In-memory runtime override if set via UI
let runtimeApiKey = process.env.GEMINI_API_KEY || '';

app.use(cors());
app.use(express.json());

// Status & Health Check
app.get('/api/status', (req, res) => {
  const hasKey = Boolean((runtimeApiKey && runtimeApiKey.trim()) || (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()));
  res.json({
    status: 'online',
    appName: 'Klyro AI',
    engine: 'Unica AI Master Engine',
    hasKey,
    activeModel: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
    supportedModes: ['general', 'problem-solving', 'tech-assist', 'business'],
    supportedLevels: ['beginner', 'intermediate', 'advanced']
  });
});

// Configure or test API key
app.post('/api/config/key', (req, res) => {
  const { apiKey } = req.body;
  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
    return res.status(400).json({ error: 'Please provide a valid API key string.' });
  }

  runtimeApiKey = apiKey.trim();

  // Try updating the root .env file if it exists
  try {
    const envPath = path.resolve(__dirname, '../../.env');
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
      if (envContent.includes('GEMINI_API_KEY=')) {
        envContent = envContent.replace(/GEMINI_API_KEY=.*/g, `GEMINI_API_KEY=${runtimeApiKey}`);
      } else {
        envContent += `\nGEMINI_API_KEY=${runtimeApiKey}\n`;
      }
    } else {
      envContent = `PORT=3001\nGEMINI_API_KEY=${runtimeApiKey}\nGEMINI_MODEL=gemini-2.5-flash\n`;
    }
    fs.writeFileSync(envPath, envContent, 'utf8');
  } catch (err) {
    console.warn('Could not persist key to .env, kept in runtime memory:', err.message);
  }

  res.json({ success: true, message: 'Gemini API key configured successfully!' });
});

// Chat Endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const {
      messages = [],
      level = 'intermediate',
      mode = 'general',
      apiKey,
      model = process.env.GEMINI_MODEL || 'gemini-3.6-flash'
    } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array is required and must not be empty.' });
    }

    const keyToUse = apiKey || runtimeApiKey || process.env.GEMINI_API_KEY;

    const result = await generateChatCompletion({
      apiKey: keyToUse,
      modelName: model,
      messages,
      level,
      mode
    });

    res.json({
      success: true,
      message: {
        role: 'assistant',
        content: result.text
      },
      metadata: {
        model: result.model,
        isDemo: result.isDemo,
        mode,
        level
      }
    });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({
      error: err.message || 'An error occurred during chat completion',
      details: err.status || err.code
    });
  }
});

// Streaming Chat Endpoint (Server-Sent Events)
app.post('/api/chat/stream', async (req, res) => {
  const {
    messages = [],
    level = 'intermediate',
    mode = 'general',
    apiKey,
    model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite'
  } = req.body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Messages array is required.' });
  }

  // Setup SSE Headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const keyToUse = apiKey || runtimeApiKey || process.env.GEMINI_API_KEY;

  try {
    const result = await streamChatCompletion({
      apiKey: keyToUse,
      modelName: model,
      messages,
      level,
      mode,
      onChunk: (token) => {
        res.write(`data: ${JSON.stringify({ token })}\n\n`);
      }
    });

    res.write(`data: ${JSON.stringify({ done: true, metadata: result })}\n\n`);
    res.end();
  } catch (err) {
    console.error('Streaming chat error:', err);
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Klyro AI (Unica AI Backend) running on http://localhost:${PORT}`);
});
