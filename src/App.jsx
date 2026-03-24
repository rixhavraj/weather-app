import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, MapPin, Save, CloudRain, Sun, Wind, Droplets, Sunrise, Sunset, Eye, Navigation, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { setWeatherAnimation } from '../animations.js';
import AIChatbar from './AIChatbar.jsx';
import { askGemini } from './gemini.js';

// --- API Helpers ---
const fetchWeather = async (lat, lon) => {
  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,surface_pressure,visibility&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max&timezone=auto`;
  const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=european_aqi`;
  
  const [wRes, aRes] = await Promise.all([fetch(weatherUrl), fetch(aqiUrl)]);
  return { weather: await wRes.json(), aqi: await aRes.json() };
};

const reverseGeocode = async (lat, lon) => {
  try {
    const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`);
    const data = await res.json();
    return data.city || data.locality || data.principalSubdivision || "Unknown Location";
  } catch (e) {
    return "Current Location";
  }
};

const searchCity = async (query) => {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`;
  const res = await fetch(url);
  const data = await res.json();
  return data.results || [];
};

// --- Main App Component ---
export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [locationName, setLocationName] = useState('Locating...');
  const [savedLocs, setSavedLocs] = useState(() => JSON.parse(localStorage.getItem('savedLocations')) || []);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeMetric, setActiveMetric] = useState('humidity');
  const insightsRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('savedLocations', JSON.stringify(savedLocs));
  }, [savedLocs]);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const name = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
          loadLocation(pos.coords.latitude, pos.coords.longitude, name);
        },
        () => loadLocation(51.5085, -0.1257, "London, UK") // Fallback
      );
    } else {
      loadLocation(51.5085, -0.1257, "London, UK");
    }
  }, []);

  useEffect(() => {
    if (data?.weather?.current) {
      setWeatherAnimation(data.weather.current.weather_code, data.weather.current.temperature_2m);
    }
  }, [data]);

  const loadLocation = async (lat, lon, name) => {
    setLoading(true);
    try {
      const result = await fetchWeather(lat, lon);
      setData({ ...result, lat, lon });
      setLocationName(name);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleSearch = async (e) => {
    const q = e.target.value;
    setSearchQuery(q);
    if (q.length > 2) {
      setIsSearching(true);
      const results = await searchCity(q);
      setSearchResults(results);
      setIsSearching(false);
    } else {
      setSearchResults([]);
    }
  };

  const selectSearchResult = (item) => {
    const name = `${item.name}${item.admin1 ? ', ' + item.admin1 : ''}${item.country ? ', ' + item.country : ''}`;
    loadLocation(item.latitude, item.longitude, name);
    setSearchQuery('');
    setSearchResults([]);
  };

  const toggleSave = () => {
    if (savedLocs.some(l => l.name === locationName)) {
      setSavedLocs(savedLocs.filter(l => l.name !== locationName));
    } else {
      setSavedLocs([...savedLocs, { name: locationName, lat: data.lat, lon: data.lon }]);
    }
  };

  const isSaved = savedLocs.some(l => l.name === locationName);
  const metricInsights = useMemo(() => buildMetricInsights(data, locationName), [data, locationName]);

  const handleMetricSelect = (metricKey) => {
    if (!metricKey) return;
    setActiveMetric(metricKey);
    requestAnimationFrame(() => {
      insightsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  return (
    <div className="app-container">
      
      {/* LEFT: Sidebar & Main Content */}
      <div className="left-column">
        <header className="header flex-between">
          <div className="search-container">
            <Search className="search-icon" size={20} />
            <input 
              type="text" 
              id="search-input" 
              placeholder="Search any city..." 
              value={searchQuery}
              onChange={handleSearch}
              autoComplete="off"
            />
            <AnimatePresence>
              {searchResults.length > 0 && (
                <motion.ul 
                  initial={{ opacity: 0, y: -10 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  exit={{ opacity: 0, y: -10 }}
                  id="search-results" 
                  className="results-dropdown"
                >
                  {searchResults.map(res => (
                    <li key={res.id} className="search-result-item" onClick={() => selectSearchResult(res)}>
                      {res.name}{res.admin1 ? `, ${res.admin1}` : ''}{res.country ? `, ${res.country}` : ''}
                    </li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
          </div>
          <motion.button 
            whileHover={{ scale: 1.05 }} 
            whileTap={{ scale: 0.95 }}
            className={`glass-btn ${isSaved ? 'active' : ''}`} 
            onClick={toggleSave}
          >
            <Save size={18} fill={isSaved ? "currentColor" : "none"} />
            <span>{isSaved ? 'Saved' : 'Save'}</span>
          </motion.button>
        </header>

        <div className="main-layout flex-gap">
          <aside className="sidebar glass-panel dark-overlay" style={{ flex: '0 0 320px', display: 'flex', flexDirection: 'column', padding: '1.5rem', overflow: 'hidden' }}>
            <h2 className="sidebar-title">Saved Locations</h2>
            <div className="locations-list">
              {savedLocs.length === 0 ? <p className="empty-state">No locations saved.</p> : null}
              {savedLocs.map(loc => (
                <motion.div 
                  initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                  key={loc.name} 
                  className="saved-location-card" 
                  onClick={() => loadLocation(loc.lat, loc.lon, loc.name)}
                >
                  <div className="saved-location-info text-shadow">
                    <h3>{loc.name.split(',')[0]}</h3>
                    <p>{loc.name.split(',').slice(1).join(',').trim()}</p>
                  </div>
                  <button className="remove-btn" onClick={(e) => { e.stopPropagation(); setSavedLocs(savedLocs.filter(l => l.name !== loc.name)); }}>✕</button>
                </motion.div>
              ))}
            </div>
          </aside>

          <main className="weather-display glass-panel dark-overlay" style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', padding: '2rem', overflowY: 'auto' }}>
            {loading ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="loading-spinner">Weather Data Loading...</div>
              </div>
            ) : data && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="scrollable-content">
                <div className="weather-top">
                  <div className="location-header text-shadow">
                    <h1 className="loc-title"><MapPin color="#ff5252" size={32} /> {locationName}</h1>
                    <p id="current-date">{new Date().toLocaleString('en-US', { weekday: 'long', hour: 'numeric', minute: '2-digit' })}</p>
                  </div>
                  
                  <div className="temperature-block text-shadow">
                    <div className="temp-wrapper">
                      <span className="temp-large">{Math.round(data?.weather?.current?.temperature_2m || 0)}</span>
                      <span className="temp-unit">°C</span>
                    </div>
                  </div>
                </div>

                <div className="weather-details-grid text-shadow">
                  <DetailCard icon={<Droplets />} label="Humidity" value={`${data?.weather?.current?.relative_humidity_2m || 0}%`} metricKey="humidity" isActive={activeMetric === 'humidity'} onSelect={handleMetricSelect} />
                  <DetailCard icon={<Wind />} label="Wind" value={`${data?.weather?.current?.wind_speed_10m || 0} km/h`} metricKey="wind" isActive={activeMetric === 'wind'} onSelect={handleMetricSelect} />
                  <DetailCard icon={<Sun />} label="Feels Like" value={`${Math.round(data?.weather?.current?.apparent_temperature || 0)}°C`} metricKey="feels_like" isActive={activeMetric === 'feels_like'} onSelect={handleMetricSelect} />
                  <DetailCard icon={<Sun />} label="UV Index" value={Math.round(data?.weather?.daily?.uv_index_max?.[0] || 0)} metricKey="uv" isActive={activeMetric === 'uv'} onSelect={handleMetricSelect} />
                  <DetailCard icon={<AlertCircle />} label="AQI" value={data?.aqi?.current?.european_aqi || '--'} metricKey="aqi" isActive={activeMetric === 'aqi'} onSelect={handleMetricSelect} />
                  <DetailCard icon={<Eye />} label="Visibility" value={`${((data?.weather?.current?.visibility || 0) / 1000).toFixed(1)} km`} metricKey="visibility" isActive={activeMetric === 'visibility'} onSelect={handleMetricSelect} />
                  <DetailCard icon={<Navigation />} label="Pressure" value={`${Math.round(data?.weather?.current?.surface_pressure || 0)} hPa`} metricKey="pressure" isActive={activeMetric === 'pressure'} onSelect={handleMetricSelect} />
                  <DetailCard icon={<Sunrise />} label="Sunrise" value={data?.weather?.daily?.sunrise?.[0] ? new Date(data.weather.daily.sunrise[0]).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--:--'} metricKey="sunrise" isActive={activeMetric === 'sunrise'} onSelect={handleMetricSelect} />
                  <DetailCard icon={<Sunset />} label="Sunset" value={data?.weather?.daily?.sunset?.[0] ? new Date(data.weather.daily.sunset[0]).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--:--'} metricKey="sunset" isActive={activeMetric === 'sunset'} onSelect={handleMetricSelect} />
                </div>

                <div className="forecast-section">
                  <h3 className="card-title text-shadow">7-Day Forecast</h3>
                  <div className="forecast-container">
                    {(data?.weather?.daily?.time || []).slice(1, 8).map((time, i) => {
                      const idx = i + 1; // skip today
                      const dayName = new Date(time).toLocaleDateString('en-US', { weekday: 'short' });
                      const max = Math.round(data.weather.daily.temperature_2m_max[idx]);
                      const min = Math.round(data.weather.daily.temperature_2m_min[idx]);
                      return (
                        <div key={time} className="forecast-day text-shadow">
                          <h4>{dayName}</h4>
                          <div className="fc-temps"><span>{max}°</span><span className="fc-min">{min}°</span></div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div ref={insightsRef}>
                  <MetricExplorer
                    insights={metricInsights}
                    activeMetric={activeMetric}
                    onMetricChange={handleMetricSelect}
                    locationName={locationName}
                    weatherData={data}
                  />
                </div>
              </motion.div>
            )}
          </main>
        </div>
      </div>

      {/* RIGHT: AI Chat Sidebar */}
      <div className="chat-column">
        <AIChatbar weatherData={data} locationName={locationName} />
      </div>

    </div>
  );
}

function DetailCard({ icon, label, value, metricKey, onSelect, isActive }) {
  const clickable = Boolean(metricKey && onSelect);
  const handleClick = () => {
    if (!clickable) return;
    onSelect(metricKey);
  };

  return (
    <div
      className={`detail-card${clickable ? ' selectable' : ''}${isActive ? ' active' : ''}`}
      onClick={handleClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      } : undefined}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', opacity: 0.8 }}>
        {React.cloneElement(icon, { size: 16 })}
        <span className="detail-label" style={{ margin: 0 }}>{label}</span>
      </div>
      <p className="detail-value">{value}</p>
    </div>
  );
}

function MetricExplorer({ insights, activeMetric, onMetricChange, locationName, weatherData }) {
  const keys = Object.keys(insights || {});
  if (!keys.length) return null;
  const selectedKey = keys.includes(activeMetric) ? activeMetric : keys[0];
  const insight = insights[selectedKey];

  const [aiInsight, setAiInsight] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    if (!insight || !weatherData) return;
    setAiLoading(true);
    setAiInsight('');
    const current = weatherData.weather?.current || {};
    const prompt = `You are a weather and farming expert. The user is in ${locationName}. They want a focused analysis of "${insight.label}" which is currently ${insight.valueLabel}.

Current conditions: Temperature ${current.temperature_2m}°C, Humidity ${current.relative_humidity_2m}%, Wind ${current.wind_speed_10m} km/h, AQI ${weatherData.aqi?.current?.european_aqi ?? 'unknown'}.

Provide:
1. A 2-sentence expert analysis of what this ${insight.label} value means for daily life
2. A practical tip for farmers
3. A health/safety recommendation

Keep total response under 80 words. Be specific to the actual values.`;

    askGemini(prompt)
      .then(t => setAiInsight(t))
      .catch(() => setAiInsight(''))
      .finally(() => setAiLoading(false));
  }, [selectedKey, locationName]);

  return (
    <section className="metric-explorer glass-panel">
      <div className="metric-explorer-head">
        <div>
          <p className="metric-eyebrow">Focused Insight</p>
          <h3>{insight.label}</h3>
          <p className="metric-location">{locationName}</p>
        </div>
        <div className="metric-pill-wrap">
          {keys.map((key) => (
            <button
              key={key}
              className={`metric-pill${key === selectedKey ? ' active' : ''}`}
              onClick={() => onMetricChange(key)}
            >
              {insights[key].label}
            </button>
          ))}
        </div>
      </div>

      <div className="metric-explorer-body">
        <div className="metric-summary-block">
          <div className="metric-value-chip">{insight.valueLabel}</div>
          <p>{insight.summary}</p>
        </div>
        <div className="metric-detail-block">
          <h4>✨ Gemini AI Analysis</h4>
          {aiLoading ? (
            <p style={{ opacity: 0.5, fontSize: '0.85rem' }}>⏳ Generating expert insight...</p>
          ) : aiInsight ? (
            <p style={{ fontSize: '0.85rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{aiInsight}</p>
          ) : (
            <ul>
              {insight.detailBullets.map((item, index) => (
                <li key={`${selectedKey}-detail-${index}`}>{item}</li>
              ))}
            </ul>
          )}
        </div>
        {insight.moreOptions?.length ? (
          <div className="metric-options-block">
            <h4>More ways to use this</h4>
            <div className="metric-option-grid">
              {insight.moreOptions.map((opt) => (
                <span key={`${selectedKey}-${opt}`} className="metric-option-chip">{opt}</span>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function buildMetricInsights(data, locationName) {
  if (!data?.weather?.current) return {};
  const current = data.weather.current;
  const daily = data.weather.daily || {};
  const loc = locationName || 'your area';
  const aqi = data.aqi?.current?.european_aqi;
  const uv = daily.uv_index_max?.[0];
  const sunrise = daily.sunrise?.[0];
  const sunset = daily.sunset?.[0];

  const withDefault = (value, suffix = '') => (value === undefined || value === null ? '--' : `${value}${suffix}`);

  const getHumidityMood = (val = 0) => {
    if (val >= 85) return 'tropical and heavy';
    if (val >= 65) return 'sticky but manageable';
    if (val >= 40) return 'comfortable';
    if (val >= 20) return 'dry';
    return 'very dry';
  };

  const describeAqi = (val) => {
    if (!val && val !== 0) return 'Unknown';
    if (val <= 40) return 'Good';
    if (val <= 80) return 'Fair';
    if (val <= 120) return 'Moderate';
    if (val <= 200) return 'Poor';
    return 'Very Poor';
  };

  const wind = current.wind_speed_10m;
  const humidity = current.relative_humidity_2m;
  const feelsRaw = current.apparent_temperature ?? current.temperature_2m;
  const feels = typeof feelsRaw === 'number' ? Math.round(feelsRaw) : null;
  const visibility = current.visibility ? (current.visibility / 1000).toFixed(1) : '--';
  const pressureRaw = current.surface_pressure;
  const pressure = typeof pressureRaw === 'number' ? Math.round(pressureRaw) : null;
  const uvRounded = typeof uv === 'number' ? Math.round(uv) : null;

  const formatTime = (value) => (value ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--');

  return {
    humidity: {
      label: 'Humidity',
      valueLabel: withDefault(humidity, '%'),
      summary: humidity !== undefined ? `Relative humidity is ${humidity}% in ${loc}, which feels ${getHumidityMood(humidity)}.` : 'Humidity data is not available right now.',
      detailBullets: [
        humidity > 80 ? 'High moisture encourages fog and mildew—ventilate indoor spaces.' : 'Moisture levels are moderate—comfortable for most indoor activities.',
        humidity > 70 ? 'Plan extra spacing for crops to reduce fungal pressure.' : 'Irrigation can be spaced out with soil checks every few hours.',
        humidity < 35 ? 'Dry air may cause skin or throat irritation—hydrate and consider a humidifier.' : 'Outdoor workouts will feel slightly heavier due to moisture.'
      ],
      moreOptions: ['Schedule irrigation reminders', 'Log moisture in your farm diary', 'Share humidity status with the AI chat']
    },
    wind: {
      label: 'Wind',
      valueLabel: withDefault(wind, ' km/h'),
      summary: `Wind is blowing at ${withDefault(wind, ' km/h')} in ${loc}, offering ${wind > 30 ? 'strong gusts' : wind > 15 ? 'a noticeable breeze' : 'a calm background flow'}.`,
      detailBullets: [
        wind > 45 ? 'Secure lightweight objects and postpone spraying pesticides.' : 'Good window for airing out spaces without dust storms.',
        wind > 25 ? 'Transpiration increases—water shallow-rooted plants early.' : 'Spraying nutrients is safe; drift risk is low.',
        'Use the AI chat to request route suggestions for outdoor plans if gusts pick up.'
      ],
      moreOptions: ['Enable wind alerts', 'Check gust history', 'Send wind briefing to team']
    },
    feels_like: {
      label: 'Feels Like',
      valueLabel: feels !== null ? `${feels}°C` : '--',
      summary: feels !== null ? `It currently feels like ${feels}°C in ${loc} once humidity and wind are combined.` : 'Feels-like temperature is still loading.',
      detailBullets: feels !== null ? [
        feels >= 32 ? 'Heat stress is possible—plan shade breaks.' : feels <= 10 ? 'Layer clothing to manage the chill.' : 'Comfort band—great for extended outdoor time.',
        'Compare feels-like vs actual temp in the chat if you need extra context.',
        'Log how it feels now to build your personal comfort reference.'
      ] : [
        'Feels-like data appears after the first live weather refresh.',
        'Use the raw temperature card for planning until this metric arrives.',
        'Ask the AI chat for manual guidance if you need wardrobe tips meanwhile.'
      ],
      moreOptions: ['Ask AI for outfit suggestions', 'Sync with workout plan', 'Bookmark this comfort level']
    },
    uv: {
      label: 'UV Index',
      valueLabel: uvRounded !== null ? `${uvRounded}` : '--',
      summary: uvRounded !== null ? `UV index peaks at ${uvRounded} today, which is ${uvRounded >= 8 ? 'very high' : uvRounded >= 6 ? 'high' : uvRounded >= 3 ? 'moderate' : 'low'}.` : 'UV data is unavailable.',
      detailBullets: uvRounded !== null ? [
        uvRounded >= 6 ? 'Use SPF 30+, sunglasses, and limit midday exposure.' : 'Midday sun is manageable with light protection.',
        'Farmers can schedule tender plant work near sunrise or sunset to avoid UV spikes.',
        'Toggle UV-specific prompts in the AI chat for custom reminders.'
      ] : [
        'Still waiting on UV feed—refresh if this stays blank.',
        'Use the AQI toggle to gauge outdoor comfort until UV arrives.',
        'Ask the AI chat for the last recorded UV index.'
      ],
      moreOptions: ['Plan outdoor meetings', 'Share UV level with family', 'Enable UV safety checklist']
    },
    aqi: {
      label: 'Air Quality',
      valueLabel: withDefault(aqi),
      summary: aqi ? `AQI is ${aqi} (${describeAqi(aqi)}) in ${loc}.` : 'Air quality data is still loading.',
      detailBullets: [
        aqi ? (aqi > 120 ? 'Limit strenuous outdoor activity and close windows when traffic peaks.' : 'Air is acceptable for most people.') : 'Awaiting live AQI feed.',
        'Masks or air purifiers help when AQI moves above 100.',
        'Use chat shortcuts to ask for AQI-safe workout or commuting guidance.'
      ],
      moreOptions: ['Expand AQI tips', 'Bookmark favorite clean-air hours', 'Share AQI summary']
    },
    visibility: {
      label: 'Visibility',
      valueLabel: visibility === '--' ? '--' : `${visibility} km`,
      summary: visibility === '--' ? 'Visibility data is not available.' : `You can see roughly ${visibility} km across ${loc}.`,
      detailBullets: [
        visibility < 5 ? 'Expect hazy horizons—slow down if driving.' : 'Road conditions should remain clear.',
        'Photographers can plan golden hour shots with this clarity.',
        'Use AI chat for fog-specific alerts if visibility dips below 2 km.'
      ],
      moreOptions: ['Plan commute buffer', 'Check drone flight rules', 'Bookmark scenic hours']
    },
    pressure: {
      label: 'Pressure',
      valueLabel: pressure !== null ? `${pressure} hPa` : '--',
      summary: pressure !== null ? `Surface pressure is ${pressure} hPa, indicating ${pressure < 1005 ? 'unstable or rainy patterns' : pressure > 1020 ? 'stable, calm weather' : 'typical conditions'}.` : 'Pressure data is missing.',
      detailBullets: pressure !== null ? [
        pressure < 1005 ? 'Keep rain gear ready and monitor low-pressure symptoms.' : 'All clear for outdoor events.',
        'Migraines or joint pains can flare when pressure swings quickly.',
        'Ask AI for upcoming pressure trends before planning hikes.'
      ] : [
        'Waiting for live pressure feed—forecast tiles still show trend arrows.',
        'Refresh the page or pick another location if pressure remains blank.',
        'Use AI chat to request regional pressure snapshots in the meantime.'
      ],
      moreOptions: ['Track pressure vs mood', 'Export pressure log', 'Set storm readiness alerts']
    },
    sunrise: {
      label: 'Sunrise',
      valueLabel: formatTime(sunrise),
      summary: sunrise ? `Sunrise hits ${formatTime(sunrise)} in ${loc}.` : 'Sunrise time is not provided.',
      detailBullets: [
        'Line up irrigation or workouts just after sunrise to avoid heat.',
        'Photographers get softer light during the first 30 minutes.',
        'Sync alarms with this slot in the AI chat for routine consistency.'
      ],
      moreOptions: ['Plan golden hour', 'Share wake-up time', 'Pin sunrise to dashboard']
    },
    sunset: {
      label: 'Sunset',
      valueLabel: formatTime(sunset),
      summary: sunset ? `Sunset is expected at ${formatTime(sunset)}.` : 'Sunset time is not provided.',
      detailBullets: [
        'Evening cooling starts roughly 30 minutes before sunset.',
        'Outdoor workers can wrap heavy tasks before dusk for better visibility.',
        'Cue smart lights or reminders at sunset through the AI chat.'
      ],
      moreOptions: ['Plan evening walk', 'Log sunset moods', 'Trigger automation at dusk']
    }
  };
}
