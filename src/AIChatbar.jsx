import React, { useState, useEffect, useRef } from 'react';
import { Send, AlertCircle, Leaf, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { askGemini } from './gemini.js';

// ─── AQI helpers ────────────────────────────────────────────────────────────

function aqiLabel(val) {
  if (!val || val === '--') return { label: 'Unknown', color: '#aaa', bad: false };
  if (val <= 40)  return { label: 'Good',      color: '#57d97a', bad: false };
  if (val <= 80)  return { label: 'Fair',      color: '#f5c842', bad: false };
  if (val <= 120) return { label: 'Moderate',  color: '#f5a623', bad: true  };
  if (val <= 200) return { label: 'Poor',      color: '#e94560', bad: true  };
  return              { label: 'Very Poor', color: '#ff2d55', bad: true  };
}

// ─── AQI Alert Card (Gemini powered) ─────────────────────────────────────────

function AQIAlertCard({ aqi, locationName, weatherData, collapsed = false }) {
  const [tips, setTips] = useState('');
  const [loading, setLoading] = useState(false);
  const info = aqiLabel(aqi);

  useEffect(() => {
    if (!aqi || aqi === '--' || !info.bad) { setTips(''); return; }
    setLoading(true);
    setTips('');
    const temp = weatherData?.weather?.current?.temperature_2m ?? '';
    const humidity = weatherData?.weather?.current?.relative_humidity_2m ?? '';
    const wind = weatherData?.weather?.current?.wind_speed_10m ?? '';
    const prompt = `You are an air quality expert. The Air Quality Index in ${locationName} is currently ${aqi} (rated "${info.label}"). Temperature: ${temp}°C, Humidity: ${humidity}%, Wind: ${wind} km/h. Give exactly 4 short, practical bullet points (use • symbol) that local residents and farmers can follow to protect their health and crops. Be specific to the conditions. No intro, just bullets.`;
    askGemini(prompt)
      .then(t => setTips(t))
      .catch(() => setTips('• Avoid outdoor activity during peak hours.\n• Wear an N95 mask outdoors.\n• Keep windows closed and use air purifiers indoors.\n• Farmers: delay field work until AQI improves.'))
      .finally(() => setLoading(false));
  }, [aqi, locationName]);

  if (!aqi || aqi === '--') return null;

  return (
    <div style={{
      background: 'rgba(0,0,0,0.55)',
      border: `1.5px solid ${info.color}66`,
      borderRadius: '18px', padding: '1.1rem 1.25rem',
      backdropFilter: 'blur(10px)', marginTop: '0.2rem',
      maxHeight: collapsed ? '72px' : '280px',
      overflowY: collapsed ? 'hidden' : 'auto',
      transition: 'max-height 0.3s ease'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
        {info.bad ? <AlertTriangle size={18} color={info.color} /> : <Leaf size={18} color={info.color} />}
        <span style={{ fontWeight: 700, color: info.color, fontSize: '1rem' }}>
          AQI {aqi} — {info.label}
        </span>
      </div>

      {collapsed ? (
        <p style={{ fontSize: '0.8rem', opacity: 0.65 }}>Expand for personalized air-quality tips.</p>
      ) : info.bad ? (
        <div style={{ fontSize: '0.85rem', lineHeight: 1.65, opacity: 0.92, whiteSpace: 'pre-wrap' }}>
          {loading ? <span style={{ opacity: 0.5 }}>⏳ Gemini AI generating tips…</span> : tips}
        </div>
      ) : (
        <p style={{ fontSize: '0.85rem', opacity: 0.65 }}>Air quality is good — safe to go outside! 🌿</p>
      )}
    </div>
  );
}

// ─── Main Chat Component (Gemini powered) ─────────────────────────────────────

export default function AIChatbar({ weatherData, locationName }) {
  const [messages, setMessages] = useState([{
    role: 'model',
    text: '👋 Hi! I\'m your Gemini-powered weather assistant. Ask me anything about weather, farming, air quality, crops, or climate!'
  }]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [aqiExpanded, setAqiExpanded] = useState(true);
  const scrollRef = useRef(null);

  // Update greeting when location changes
  useEffect(() => {
    if (locationName && locationName !== 'Locating...') {
      setMessages([{
        role: 'model',
        text: `👋 Hi! I'm your Gemini AI for ${locationName}. Ask me about crops, air quality, UV safety, farming tips, or anything weather-related!`
      }]);
    }
  }, [locationName]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const aqi = weatherData?.aqi?.current?.european_aqi;
  const temp = weatherData?.weather?.current?.temperature_2m;
  const humidity = weatherData?.weather?.current?.relative_humidity_2m;
  const wind = weatherData?.weather?.current?.wind_speed_10m;
  const code = weatherData?.weather?.current?.weather_code;
  const uv = weatherData?.weather?.daily?.uv_index_max?.[0];
  const pressure = weatherData?.weather?.current?.surface_pressure;

  const buildContext = () => {
    if (!weatherData) return '';
    return `You are a helpful weather and farming AI assistant. Keep responses concise (3-5 sentences max) and practical.

Current conditions in ${locationName}:
- Temperature: ${temp}°C (Feels like: ${weatherData?.weather?.current?.apparent_temperature}°C)
- Humidity: ${humidity}%
- Wind Speed: ${wind} km/h
- Weather Code: ${code}
- UV Index: ${uv ?? 'unknown'}
- AQI: ${aqi ?? 'unknown'}
- Surface Pressure: ${pressure} hPa

Only answer questions related to weather, climate, farming, crops, air quality, and natural conditions. If asked about unrelated topics, politely redirect to weather/farming topics.

`;
  };

  const handleSend = async (textOverride) => {
    const text = (textOverride || input).trim();
    if (!text || isTyping) return;
    setMessages(prev => [...prev, { role: 'user', text }]);
    setInput('');
    setIsTyping(true);

    try {
      const prompt = buildContext() + 'User question: ' + text;
      const reply = await askGemini(prompt);
      setMessages(prev => [...prev, { role: 'model', text: reply }]);
    } catch (e) {
      console.error('Gemini error:', e);
      setMessages(prev => [...prev, { role: 'model', text: '⚠️ Could not connect to Gemini AI right now. Please try again.' }]);
    }
    setIsTyping(false);
  };

  const chipPrompts = [
    'What crops should I grow right now?',
    'Is the air quality safe today?',
    'UV safety tips for today?',
    'Give me a full weather summary'
  ];

  return (
    <aside className="chat-shell" style={{
      display: 'flex', flexDirection: 'column',
      gap: '1rem', height: '100%', minHeight: 0, overflow: 'hidden'
    }}>

      {/* ── AQI Smart Card ── */}
      <div className="glass-panel chat-aqi-card" style={{ padding: '1.1rem 1.25rem', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        <div className="chat-aqi-header" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div>
            <h3 style={{ fontSize: '0.78rem', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', opacity: 0.55, marginBottom: '0.2rem' }}>Air Quality</h3>
            <p style={{ fontSize: '0.75rem', opacity: 0.6 }}>Gemini AI insights</p>
          </div>
          <button className="metric-pill small" style={{ marginLeft: 'auto' }} onClick={() => setAqiExpanded(prev => !prev)}>
            {aqiExpanded ? 'Hide tips' : 'Show tips'}
          </button>
        </div>
        <div className={`chat-aqi-body${aqiExpanded ? ' expanded' : ' collapsed'}`} style={{ flex: 1 }}>
          <AQIAlertCard aqi={aqi} locationName={locationName} weatherData={weatherData} collapsed={!aqiExpanded} />
        </div>
      </div>

      {/* ── Chat Panel ── */}
      <div className="glass-panel" style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        overflow: 'hidden', padding: 0, minHeight: 0
      }}>
        {/* Header */}
        <div style={{
          padding: '0.85rem 1.25rem',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0
        }}>
          <AlertCircle size={15} color="#50E3C2" />
          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Weather AI Chat</span>
          <span style={{
            fontSize: '0.7rem', background: 'linear-gradient(135deg, #4285F4, #34A853)',
            color: '#fff', borderRadius: '20px', padding: '2px 10px', marginLeft: 'auto', fontWeight: 700
          }}>Gemini AI</span>
        </div>

        {/* Messages */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '1rem',
          display: 'flex', flexDirection: 'column', gap: '0.65rem'
        }}>
          <AnimatePresence initial={false}>
            {messages.map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '90%',
                  background: m.role === 'user'
                    ? 'rgba(80,227,194,0.22)'
                    : 'rgba(255,255,255,0.07)',
                  border: m.role === 'user'
                    ? '1px solid rgba(80,227,194,0.35)'
                    : '1px solid rgba(255,255,255,0.1)',
                  borderRadius: m.role === 'user'
                    ? '18px 18px 4px 18px'
                    : '18px 18px 18px 4px',
                  padding: '0.65rem 1rem',
                }}
              >
                <p style={{ fontSize: '0.87rem', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                  {m.text}
                </p>
              </motion.div>
            ))}
          </AnimatePresence>

          {isTyping && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.3, 0.9, 0.3] }}
              transition={{ repeat: Infinity, duration: 1.1 }}
              style={{ alignSelf: 'flex-start', fontSize: '0.82rem', opacity: 0.5 }}
            >
              ✨ Gemini is thinking…
            </motion.div>
          )}
          <div ref={scrollRef} />
        </div>

        {/* Quick chips */}
        {messages.length <= 1 && (
          <div style={{ padding: '0 1rem 0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {chipPrompts.map(s => (
              <button
                key={s}
                onClick={() => handleSend(s)}
                style={{
                  fontSize: '0.73rem', padding: '0.3rem 0.7rem', borderRadius: '20px',
                  border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.08)',
                  color: 'white', cursor: 'pointer', transition: 'background 0.2s'
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div style={{
          padding: '0.7rem 0.9rem',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          display: 'flex', gap: '0.5rem',
          background: 'rgba(0,0,0,0.25)', flexShrink: 0
        }}>
          <input
            type="text"
            placeholder="Ask Gemini about weather, crops, AQI…"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !isTyping && handleSend()}
            style={{
              flex: 1, padding: '0.6rem 1rem', borderRadius: '20px',
              border: '1px solid rgba(255,255,255,0.18)',
              background: 'rgba(255,255,255,0.07)',
              color: 'white', outline: 'none', fontSize: '0.87rem',
            }}
          />
          <button
            onClick={() => handleSend()}
            disabled={isTyping || !input.trim()}
            style={{
              background: isTyping ? 'rgba(80,227,194,0.3)' : '#50E3C2',
              border: 'none', borderRadius: '50%',
              width: '38px', height: '38px', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: isTyping ? 'not-allowed' : 'pointer', color: '#000',
              transition: 'background 0.2s',
            }}
          >
            <Send size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}
