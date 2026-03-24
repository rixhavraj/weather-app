import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;
const ANTHROPIC_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;

// ─── Gemini Initializer ─────────────────────────────────────────────────────
let genAI = null;
let model = null;

function getGeminiModel() {
  if (!model) {
    if (!GEMINI_API_KEY) throw new Error('Gemini API key missing');
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  }
  return model;
}

// ─── OpenAI Helper (Proxy) ──────────────────────────────────────────────────
async function askOpenAI(prompt) {
  const response = await fetch('/openai-proxy/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500
    })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`OpenAI error: ${error.error?.message || response.statusText}`);
  }
  
  const data = await response.json();
  return data.choices[0].message.content;
}

// ─── Anthropic Helper (Proxy) ───────────────────────────────────────────────
async function askAnthropic(prompt) {
  // Using Pollinations as proxy since direct Anthropic calls fail from browser
  const response = await fetch('/ai-proxy/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1024
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`AI API error: ${error.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// ─── Fail-safe Keyless AI (Pollinations Proxy) ──────────────────────────────
async function askFailSafeAI(prompt) {
  const response = await fetch('/ai-proxy/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1024
    })
  });
  
  if (!response.ok) {
    throw new Error(`Pollinations API error: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.choices[0].message.content;
}

// ─── Request queue ──────────────────────────────────────────────────────────
let queue = Promise.resolve();
const MIN_GAP_MS = 2000;

function enqueue(fn) {
  queue = queue
    .then(() => delay(MIN_GAP_MS))
    .then(fn)
    .catch(err => { throw err; });
  return queue;
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ─── Quadruple Fallback Logic ───────────────────────────────────────────────
async function withFallback(fn, prompt, retries = 1) {
  // Layer 1: Gemini (User Priority)
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (err?.status === 429 && i < retries) {
        await delay(3000);
        continue;
      }
      break; 
    }
  }

  // Layer 2: OpenAI
  console.warn('Gemini failed. Trying OpenAI...');
  try {
    return await askOpenAI(prompt);
  } catch (err) {
    console.error('OpenAI failed:', err);
    
    // Layer 3: Anthropic
    console.warn('OpenAI failed. Trying Anthropic...');
    try {
      return await askAnthropic(prompt);
    } catch (err) {
      console.error('Anthropic failed:', err);
      
      // Layer 4: FAIL-SAFE (No Key Required)
      console.warn('All keyed providers failed. Using fail-safe AI...');
      try {
        return await askFailSafeAI(prompt);
      } catch (err) {
        console.error('Fail-safe AI failed:', err);
        throw new Error('All AI services are temporarily unavailable. Please check your internet connection.');
      }
    }
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────
export async function askGemini(prompt) {
  return enqueue(() =>
    withFallback(async () => {
      const m = getGeminiModel();
      const result = await m.generateContent(prompt);
      return result.response.text();
    }, prompt)
  );
}
