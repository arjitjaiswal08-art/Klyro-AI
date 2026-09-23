/**
 * API client to communicate with Klyro AI / Express backend
 */

export async function checkServerStatus() {
  try {
    const res = await fetch('/api/status');
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Backend status check failed:', err);
    return { status: 'offline', hasKey: false };
  }
}

export async function saveApiKey(apiKey) {
  const res = await fetch('/api/config/key', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey })
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `HTTP error ${res.status}`);
  }
  return await res.json();
}

export async function sendChatMessage({ messages, level, mode, apiKey, model }) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages,
      level,
      mode,
      apiKey,
      model
    })
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }

  return await res.json();
}

/**
 * Streams chat responses token by token via Server-Sent Events (SSE)
 */
export async function streamChatMessage({ messages, level, mode, apiKey, model, onToken, onComplete, onError }) {
  try {
    const response = await fetch('/api/chat/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream'
      },
      body: JSON.stringify({
        messages,
        level,
        mode,
        apiKey,
        model
      })
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      throw new Error(errJson.error || `HTTP Error ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let metadata = {};

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          const jsonStr = trimmed.slice(6);
          try {
            const data = JSON.parse(jsonStr);
            if (data.token) {
              onToken(data.token);
            }
            if (data.done) {
              metadata = data.metadata || {};
            }
            if (data.error) {
              throw new Error(data.error);
            }
          } catch (e) {
            if (e.message && !e.message.includes('JSON')) {
              throw e;
            }
          }
        }
      }
    }

    onComplete(metadata);
  } catch (err) {
    console.error('[Stream API Error]:', err);
    if (onError) onError(err);
  }
}
