const { buildSystemPrompt } = require('./prompts');

let GoogleGenAI = null;
let GoogleGenerativeAI = null;

try {
  ({ GoogleGenAI } = require('@google/genai'));
} catch (e) {}

try {
  ({ GoogleGenerativeAI } = require('@google/generative-ai'));
} catch (e) {}

/**
 * Normalizes multi-turn message history into Gemini chat format
 */
function formatHistory(messages = []) {
  const history = [];
  for (const msg of messages) {
    if (msg.role === 'system') continue;
    const role = msg.role === 'assistant' || msg.role === 'model' ? 'model' : 'user';
    history.push({
      role,
      parts: [{ text: msg.content || '' }]
    });
  }
  return history;
}

/**
 * Generates an intelligent simulated response if no API key is supplied yet
 */
function generateDemoResponse(prompt, level, mode) {
  const lower = (prompt || '').toLowerCase();

  if (mode === 'problem-solving' || lower.includes('how to build') || lower.includes('how to do') || lower.includes('how can i create')) {
    return `### 1. Overview
We will design and construct a modular, scalable architecture for **"${prompt}"**. The goal is a lean MVP that balances speed-to-market with production-ready reliability.

### 2. Step-by-Step Plan
1. **Define Core Domain & Data Model**: Map entity schemas, core relationships, and access controls.
2. **Setup High-Throughput API Layer**: Build REST/RPC endpoints with schema validation and authentication middleware.
3. **Connect Storage & Cache**: Use a primary persistent datastore with in-memory caching for hot queries.
4. **Implement Client Interface**: Build reactive UI with optimistic UI updates and resilient state caching.
5. **Security & Deployment**: Setup rate limiting, CORS, telemetry, and automated CI/CD pipelines.

### 3. Code Example
\`\`\`javascript
// Example: Core API Handler with Validation and Safe Response
import express from 'express';

export function createServiceRouter(service) {
  const router = express.Router();

  router.post('/action', async (req, res) => {
    try {
      const { payload } = req.body;
      if (!payload) {
        return res.status(400).json({ error: 'Payload is required' });
      }

      const result = await service.process(payload);
      return res.status(200).json({ success: true, data: result });
    } catch (err) {
      console.error('[Service Error]:', err);
      return res.status(500).json({ error: 'Internal operation failed' });
    }
  });

  return router;
}
\`\`\`

### 4. Tips & Best Practices
- **Fail Fast**: Validate incoming payloads at boundaries using strict schemas.
- **Observability**: Log structured JSON metrics and errors with request IDs.`;
  }

  if (mode === 'business' || lower.includes('saas') || lower.includes('startup') || lower.includes('money') || lower.includes('revenue')) {
    return `### 💡 Unica AI Business Assessment: ${prompt}

**1. Market & Value Proposition**
Focus on high-pain, recurring workflow bottlenecks. Aim for an ROI proposition where customers save at least 5x the monthly subscription in saved hours or prevented downtime.

**2. Practical MVP Strategy**
- **Week 1**: Build a tight, single-feature vertical tool rather than an all-in-one suite.
- **Week 2**: Validate with 20 direct target customers via targeted outreach and community demos.
- **Week 3**: Launch self-serve billing (Stripe) with usage tiers and annual discount incentive.

**3. Unit Economics & Scalability**
- **Tier 1 (Starter)**: $19 - $29/mo (solo developers / small teams)
- **Tier 2 (Pro/Team)**: $79 - $149/mo (multi-seat, priority rate limits)
- **Gross Margin Target**: >80% by keeping LLM token caching and batching optimized.`;
  }

  return `### Unica AI Response

I understand your goal: **"${prompt}"**.

Here is the direct approach tailored for your **${level.toUpperCase()}** profile:
- **Key Focus**: Clear execution, clean structure, and practical implementation.
- **Next Action**: Break down your workflow into distinct milestones, test each component independently, and integrate iteratively.`;
}

/**
 * Dispatches a chat request using Gemini with automatic resilient model fallback
 */
async function generateChatCompletion({ apiKey, modelName = 'gemini-3.5-flash-lite', messages = [], level = 'intermediate', mode = 'general' }) {
  const activeKey = apiKey || process.env.GEMINI_API_KEY;

  const systemInstruction = buildSystemPrompt(level, mode);
  const userMessage = messages[messages.length - 1]?.content || '';
  const previousMessages = messages.slice(0, -1);

  if (!activeKey || activeKey.trim() === '') {
    return {
      text: generateDemoResponse(userMessage, level, mode),
      isDemo: true,
      model: 'unica-ai-simulator'
    };
  }

  const modelCascade = [
    modelName,
    'gemini-3.5-flash-lite',
    'gemini-3.6-flash',
    'gemini-flash-latest'
  ].filter((v, i, a) => a.indexOf(v) === i);

  if (GoogleGenAI) {
    const ai = new GoogleGenAI({ apiKey: activeKey.trim() });

    const contents = [];
    for (const m of previousMessages) {
      if (m.role === 'system') continue;
      contents.push({
        role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
        parts: [{ text: m.content || '' }]
      });
    }
    contents.push({
      role: 'user',
      parts: [{ text: userMessage }]
    });

    let lastError = null;

    for (const candidateModel of modelCascade) {
      try {
        const response = await ai.models.generateContent({
          model: candidateModel,
          contents,
          config: {
            systemInstruction: {
              parts: [{ text: systemInstruction }]
            },
            temperature: 0.7,
            maxOutputTokens: 2500
          }
        });

        const text = response.text || (response.candidates?.[0]?.content?.parts?.[0]?.text) || '';
        if (text) {
          return { text, isDemo: false, model: candidateModel };
        }
      } catch (err) {
        lastError = err;
        console.warn(`[Gemini Engine] Model ${candidateModel} error:`, err.message || err.status);
      }
    }

    if (lastError) throw lastError;
  }

  throw new Error('No compatible Google Gemini SDK found.');
}

/**
 * Dispatches a streaming chat request using Gemini generateContentStream
 */
async function streamChatCompletion({ apiKey, modelName = 'gemini-3.5-flash-lite', messages = [], level = 'intermediate', mode = 'general', onChunk }) {
  const activeKey = apiKey || process.env.GEMINI_API_KEY;
  const systemInstruction = buildSystemPrompt(level, mode);
  const userMessage = messages[messages.length - 1]?.content || '';
  const previousMessages = messages.slice(0, -1);

  if (!activeKey || activeKey.trim() === '') {
    const fullText = generateDemoResponse(userMessage, level, mode);
    const words = fullText.split(' ');
    for (const word of words) {
      onChunk(word + ' ');
      await new Promise(r => setTimeout(r, 25));
    }
    return { model: 'unica-ai-simulator', isDemo: true };
  }

  const modelCascade = [
    modelName,
    'gemini-3.5-flash-lite',
    'gemini-3.6-flash',
    'gemini-flash-latest'
  ].filter((v, i, a) => a.indexOf(v) === i);

  if (GoogleGenAI) {
    const ai = new GoogleGenAI({ apiKey: activeKey.trim() });

    const contents = [];
    for (const m of previousMessages) {
      if (m.role === 'system') continue;
      contents.push({
        role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
        parts: [{ text: m.content || '' }]
      });
    }
    contents.push({
      role: 'user',
      parts: [{ text: userMessage }]
    });

    let lastError = null;

    for (const candidateModel of modelCascade) {
      try {
        const responseStream = await ai.models.generateContentStream({
          model: candidateModel,
          contents,
          config: {
            systemInstruction: {
              parts: [{ text: systemInstruction }]
            },
            temperature: 0.7,
            maxOutputTokens: 3000
          }
        });

        for await (const chunk of responseStream) {
          const text = chunk.text || (chunk.candidates?.[0]?.content?.parts?.[0]?.text) || '';
          if (text) {
            onChunk(text);
          }
        }

        return { model: candidateModel, isDemo: false };
      } catch (err) {
        lastError = err;
        console.warn(`[Gemini Stream Engine] Model ${candidateModel} error:`, err.message || err.status);
      }
    }

    if (lastError) throw lastError;
  }

  throw new Error('Streaming failed: GoogleGenAI SDK not available.');
}

module.exports = {
  generateChatCompletion,
  streamChatCompletion,
  generateDemoResponse
};
