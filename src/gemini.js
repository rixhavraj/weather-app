import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

let genAI = null;
let model = null;

function getGeminiModel() {
  if (!model) {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  }
  return model;
}

// ─── OpenAI Helper (using fetch to avoid dependencies) ─────────────────────

async function askOpenAI(prompt) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini', // Fast and reliable fallback
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500
    })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
  }
  
  const data = await response.json();
  return data.choices[0].message.content;
}

// ─── Request queue to prevent 429 rate limiting ──────────────────────────────
let queue = Promise.resolve();
const MIN_GAP_MS = 2500; // Increased to 2.5s to be safe on free tier

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

// Retry logic with Fallback to OpenAI
async function withFallback(fn, prompt, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      const isRateLimit = err?.message?.includes('429') || err?.status === 429;
      
      if (isRateLimit && i < retries) {
        const wait = (i + 1) * 3000;
        console.warn(`Gemini 429 — retrying in ${wait / 1000}s...`);
        await delay(wait);
      } else {
        // If it's a rate limit or other error after retries, fallback to OpenAI
        console.warn('Gemini failed or rate limited. Falling back to OpenAI...');
        try {
          return await askOpenAI(prompt);
        } catch (openAiErr) {
          console.error('Both Gemini and OpenAI failed:', openAiErr);
          throw new Error('All AI providers are currently unavailable.');
        }
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
