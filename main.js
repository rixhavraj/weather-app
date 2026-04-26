import { setWeatherAnimation } from './animations.js';

// --- Default Configuration & State ---
const state = {
  currentLocation: null, // { name, lat, lon }
  savedLocations: JSON.parse(localStorage.getItem('savedLocations')) || [],
  searchTimeout: null,
  isFahrenheit: false
};

// --- DOM Elements ---

const DOM = {
  searchInput: document.getElementById('search-input'),
  searchResults: document.getElementById('search-results'),
  saveBtn: document.getElementById('save-btn'),
  savedLocationsList: document.getElementById('saved-locations-list'),
  weatherContent: document.getElementById('weather-content'),
  loading: document.getElementById('loading'),
  
  // Weather display
  locName: document.getElementById('loc-text'),
  date: document.getElementById('current-date'),
  temp: document.getElementById('current-temp'),
  icon: document.getElementById('weather-icon'),
  condition: document.getElementById('weather-condition'),
  humidity: document.getElementById('humidity'),
  wind: document.getElementById('wind-speed'),
  feelsLike: document.getElementById('feels-like'),
  uvIndex: document.getElementById('uv-index'),
  visibility: document.getElementById('visibility'),
  pressure: document.getElementById('pressure'),
  sunrise: document.getElementById('sunrise'),
  sunset: document.getElementById('sunset'),

  aqiValue: document.getElementById('aqi-value'),
  aqiStatus: document.getElementById('aqi-status'),
  cropSuggestion: document.getElementById('crop-suggestion'),
  forecastContainer: document.getElementById('forecast-container')
};

function init() {
  renderSavedLocations();
  setupEventListeners();

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => fetchAllWeatherData(pos.coords.latitude, pos.coords.longitude, "Current Location"),
      () => loadDefaultWeather()
    );
  } else {
    loadDefaultWeather();
  }
}

function loadDefaultWeather() {
  if (state.savedLocations.length > 0) {
    const loc = state.savedLocations[0];
    fetchAllWeatherData(loc.lat, loc.lon, loc.name);
  } else {
    fetchAllWeatherData(51.5085, -0.1257, "London, UK");
  }
}

function setupEventListeners() {
  DOM.searchInput.addEventListener('input', (e) => {
    clearTimeout(state.searchTimeout);
    const query = e.target.value.trim();
    if (query.length < 2) {
      DOM.searchResults.classList.add('hidden');
      return;
    }
    state.searchTimeout = setTimeout(() => searchLocation(query), 500);
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-container')) {
      DOM.searchResults.classList.add('hidden');
    }
  });

  DOM.saveBtn.addEventListener('click', () => {
    if (state.currentLocation) toggleSaveLocation(state.currentLocation);
  });
}

// --- API Calls ---
async function fetchAllWeatherData(lat, lon, locationName) {
  showLoading(true);
  try {
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,surface_pressure,visibility&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max&timezone=auto`;
    const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=european_aqi`;

    const [weatherRes, aqiRes] = await Promise.all([
      fetch(weatherUrl),
      fetch(aqiUrl)
    ]);

    const weatherData = await weatherRes.json();
    const aqiData = await aqiRes.json();

    state.currentLocation = { name: locationName, lat, lon };
    updateUI(weatherData, aqiData, locationName);
    updateSaveButtonState();
  } catch (err) {
    console.error('Failed to fetch weather data', err);
    DOM.loading.innerText = 'Failed to load data.';
  }
}

async function searchLocation(query) {
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.results && data.results.length > 0) {
      renderSearchResults(data.results);
    } else {
      DOM.searchResults.innerHTML = '<li class="search-result-item">No results found</li>';
      DOM.searchResults.classList.remove('hidden');
    }
  } catch (err) {
    console.error('Geocoding error', err);
  }
}

// --- UI Updates ---
function renderSearchResults(results) {
  DOM.searchResults.innerHTML = '';
  results.forEach(res => {
    const li = document.createElement('li');
    li.className = 'search-result-item';
    const country = res.country ? `, ${res.country}` : '';
    const admin = res.admin1 ? ` (${res.admin1})` : '';
    li.innerText = `${res.name}${admin}${country}`;
    li.addEventListener('click', () => {
      DOM.searchInput.value = '';
      DOM.searchResults.classList.add('hidden');
      fetchAllWeatherData(res.latitude, res.longitude, li.innerText);
    });
    DOM.searchResults.appendChild(li);
  });
  DOM.searchResults.classList.remove('hidden');
}

function updateUI(weatherData, aqiData, locationName) {
  DOM.weatherContent.classList.remove('hidden');
  DOM.loading.classList.add('hidden');

  const current = weatherData.current;
  const daily = weatherData.daily;

  DOM.locName.innerText = locationName;
  DOM.temp.innerText = Math.round(current.temperature_2m);
  DOM.humidity.innerText = `${current.relative_humidity_2m}%`;
  DOM.wind.innerText = `${current.wind_speed_10m} km/h`;
  DOM.feelsLike.innerText = `${Math.round(current.apparent_temperature)}°C`;
  
  DOM.pressure.innerText = `${Math.round(current.surface_pressure)} hPa`;
  DOM.visibility.innerText = `${(current.visibility / 1000).toFixed(1)} km`;
  
  // UV Index from daily max
  DOM.uvIndex.innerText = daily.uv_index_max[0] ? Math.round(daily.uv_index_max[0]) : '--';
  
  // Time formatting
  const formatTime = (isoString) => {
    return new Date(isoString).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  };
  DOM.sunrise.innerText = daily.sunrise[0] ? formatTime(daily.sunrise[0]) : '--:--';
  DOM.sunset.innerText = daily.sunset[0] ? formatTime(daily.sunset[0]) : '--:--';

  // AQI
  const aqiVal = aqiData.current?.european_aqi || '--';
  DOM.aqiValue.innerText = aqiVal;
  updateAQIStatus(aqiVal);

  // Farming Suggestion
  updateCropSuggestion(current.temperature_2m, current.precipitation);

  // Set animation based on weather code and temp
  const { icon, condition } = setWeatherAnimation(current.weather_code, current.temperature_2m);
  DOM.icon.innerText = icon;
  DOM.condition.innerText = condition;

  const now = new Date();
  DOM.date.innerText = now.toLocaleDateString('en-US', { weekday: 'long', hour: 'numeric', minute: '2-digit' });

  renderForecast(daily);
}

function updateAQIStatus(aqi) {
  if (aqi === '--') {
    DOM.aqiStatus.innerText = 'Unknown';
    DOM.aqiStatus.className = 'aqi-status';
    return;
  }
  
  let status = '', colorClass = '';
  if (aqi <= 40) { status = 'Good'; colorClass = 'aqi-good'; }
  else if (aqi <= 80) { status = 'Fair'; colorClass = 'aqi-moderate'; }
  else if (aqi <= 120) { status = 'Moderate'; colorClass = 'aqi-moderate'; }
  else { status = 'Poor'; colorClass = 'aqi-poor'; }
  
  DOM.aqiStatus.innerText = status;
  DOM.aqiStatus.className = `aqi-status ${colorClass}`;
}

function updateCropSuggestion(temp, precip) {
  let suggestion = '';
  if (temp < 5) {
    suggestion = "Soil is too cold for active growing. Ideal for winter cover crops like Winter Rye or preparing soil for spring.";
  } else if (temp >= 5 && temp < 15) {
    suggestion = "Cool soil temperature. Suitable for cool-season crops like Peas, Spinach, Radishes, and Lettuce.";
  } else if (temp >= 15 && temp <= 28) {
    suggestion = "Optimal soil warmth. Excellent for warm-season crops like Tomatoes, Corn, Beans, and Cucumbers.";
  } else {
    suggestion = "Heat stress level. Ensure deep watering and mulching. Heat-tolerant crops like Okra or Sweet Potatoes thrive.";
  }

  if (precip > 5) {
    suggestion += " High moisture levels—avoid overwatering to prevent root rot.";
  } else if (precip === 0 && temp > 20) {
    suggestion += " Dry conditions—irrigation highly recommended for active crops.";
  }
  
  DOM.cropSuggestion.innerText = suggestion;
}

function renderForecast(daily) {
  DOM.forecastContainer.innerHTML = '';
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  for (let i = 1; i <= 7; i++) { 
    if (!daily.time[i]) break;
    const dateObj = new Date(daily.time[i]);
    const dayName = days[dateObj.getDay()];
    const max = Math.round(daily.temperature_2m_max[i]);
    const min = Math.round(daily.temperature_2m_min[i]);
    const code = daily.weather_code[i];
    
    // Quick icon mapping for forecast
    let fi = '☀️';
    if ([2,3,45,48].includes(code)) fi = '☁️';
    if ([51,53,55,56,57,61,63,65,66,67,80,81,82].includes(code)) fi = '🌧️';
    if ([71,73,75,77,85,86].includes(code)) fi = '❄️';
    if ([95,96,99].includes(code)) fi = '⛈️';

    const node = document.createElement('div');
    node.className = 'forecast-day';
    node.innerHTML = `
      <h4>${dayName}</h4>
      <div class="fc-icon">${fi}</div>
      <div class="fc-temps">
        <span class="fc-max">${max}°</span>
        <span class="fc-min">${min}°</span>
      </div>
    `;
    DOM.forecastContainer.appendChild(node);
  }
}

function showLoading(isLoading) {
  if (isLoading) {
    DOM.weatherContent.classList.add('hidden');
    DOM.loading.classList.remove('hidden');
  } else {
    DOM.loading.classList.add('hidden');
    DOM.weatherContent.classList.remove('hidden');
  }
}

// --- Saved Locations ---
function isLocationSaved(name) { return state.savedLocations.some(l => l.name === name); }

function toggleSaveLocation(loc) {
  if (isLocationSaved(loc.name)) {
    state.savedLocations = state.savedLocations.filter(l => l.name !== loc.name);
  } else {
    state.savedLocations.push(loc);
  }
  localStorage.setItem('savedLocations', JSON.stringify(state.savedLocations));
  updateSaveButtonState();
  renderSavedLocations();
}

function removeSavedLocation(name, event) {
  event.stopPropagation();
  state.savedLocations = state.savedLocations.filter(l => l.name !== name);
  localStorage.setItem('savedLocations', JSON.stringify(state.savedLocations));
  if (state.currentLocation?.name === name) updateSaveButtonState();
  renderSavedLocations();
}

function updateSaveButtonState() {
  DOM.saveBtn.classList.remove('hidden');
  if (state.currentLocation && isLocationSaved(state.currentLocation.name)) {
    DOM.saveBtn.classList.add('active');
    DOM.saveBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg><span>Saved</span>`;
  } else {
    DOM.saveBtn.classList.remove('active');
    DOM.saveBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg><span>Save</span>`;
  }
}

function renderSavedLocations() {
  DOM.savedLocationsList.innerHTML = '';
  if (state.savedLocations.length === 0) {
    DOM.savedLocationsList.innerHTML = '<p class="empty-state">No locations saved yet.</p>';
    return;
  }
  state.savedLocations.forEach(loc => {
    const card = document.createElement('div');
    card.className = 'saved-location-card';
    card.innerHTML = `
      <div class="saved-location-info">
        <h3>${loc.name.split(',')[0]}</h3>
        <p>${loc.name.split(',').slice(1).join(',').trim() || 'Saved Location'}</p>
      </div>
      <button class="remove-btn" title="Remove"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"></path></svg></button>
    `;
    card.addEventListener('click', () => fetchAllWeatherData(loc.lat, loc.lon, loc.name));
    card.querySelector('.remove-btn').addEventListener('click', (e) => removeSavedLocation(loc.name, e));
    DOM.savedLocationsList.appendChild(card);
  });
}

document.addEventListener('DOMContentLoaded', init);
