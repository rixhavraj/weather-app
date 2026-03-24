// Advanced Animations Module

export function setWeatherAnimation(weatherCode, currentTemp) {
  const app = document.getElementById('app');
  const animationLayer = document.getElementById('animation-layer');
  
  animationLayer.innerHTML = '';
  app.className = '';

  let themeClass = 'theme-clear'; 
  let icon = '☀️';
  let condition = 'Clear';

  // Base classification
  if (weatherCode === 0 || weatherCode === 1) {
    themeClass = 'theme-clear'; icon = '☀️'; condition = 'Clear';
  } else if (weatherCode === 2 || weatherCode === 3) {
    themeClass = 'theme-clouds'; icon = '☁️'; condition = 'Cloudy'; createClouds(animationLayer);
  } else if ([45, 48].includes(weatherCode)) {
    themeClass = 'theme-clouds'; icon = '🌫️'; condition = 'Fog';
  } else if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(weatherCode)) {
    themeClass = 'theme-rain'; icon = '🌧️'; condition = 'Rain'; createRain(animationLayer);
  } else if ([71, 73, 75, 77, 85, 86].includes(weatherCode)) {
    themeClass = 'theme-snow'; icon = '❄️'; condition = 'Snow'; createSnow(animationLayer);
  } else if ([95, 96, 99].includes(weatherCode)) {
    themeClass = 'theme-thunder'; icon = '⛈️'; condition = 'Thunderstorm';
    createRain(animationLayer); createLightning(animationLayer);
  }

  if (currentTemp > 35) {
    themeClass = 'theme-hot';
    createHeatwave(animationLayer);
  }
  // Background is now static sky blue per user request
  // app.classList.add(themeClass);
  return { icon, condition, themeClass };
}

function createRain(container) {
  const rainCount = 120;
  for (let i = 0; i < rainCount; i++) {
    const drop = document.createElement('div');
    drop.style.position = 'absolute';
    drop.style.background = 'linear-gradient(to bottom, rgba(255,255,255,0), rgba(255,255,255,0.8))';
    drop.style.width = '2px';
    drop.style.height = `${Math.random() * 25 + 15}px`;
    drop.style.left = `${Math.random() * 105}vw`;
    drop.style.top = `${Math.random() * -100}px`;
    const duration = Math.random() * 0.4 + 0.4;
    const delay = Math.random() * 2;
    drop.style.animation = `fallRain ${duration}s linear ${delay}s infinite`;
    // Add natural slant
    drop.style.transform = 'rotate(10deg)';
    container.appendChild(drop);
  }

  if (!document.getElementById('anim-styles-rain')) {
    const style = document.createElement('style');
    style.id = 'anim-styles-rain';
    style.innerHTML = `
      @keyframes fallRain {
        to { transform: translateY(110vh) translateX(-20vh) rotate(10deg); }
      }
    `;
    document.head.appendChild(style);
  }
}

function createSnow(container) {
  const snowCount = 200;
  for (let i = 0; i < snowCount; i++) {
    const flake = document.createElement('div');
    flake.style.position = 'absolute';
    flake.style.background = 'white';
    flake.style.borderRadius = '50%';
    const size = Math.random() * 5 + 3;
    flake.style.width = `${size}px`;
    flake.style.height = `${size}px`;
    flake.style.left = `${Math.random() * 105}vw`;
    flake.style.top = `${Math.random() * -100}px`;
    flake.style.opacity = Math.random() * 0.8 + 0.2;
    flake.style.boxShadow = '0 0 5px rgba(255,255,255,0.8)';
    const duration = Math.random() * 4 + 3;
    const delay = Math.random() * 5;
    flake.style.animation = `fallSnow ${duration}s linear ${delay}s infinite`;
    container.appendChild(flake);
  }

  if (!document.getElementById('anim-styles-snow')) {
    const style = document.createElement('style');
    style.id = 'anim-styles-snow';
    style.innerHTML = `
      @keyframes fallSnow {
        0% { transform: translateY(-10px) translateX(0); }
        33% { transform: translateY(30vh) translateX(15px); }
        66% { transform: translateY(60vh) translateX(-15px); }
        100% { transform: translateY(110vh) translateX(0); }
      }
    `;
    document.head.appendChild(style);
  }
}

function createClouds(container) {
  const cloudCount = 8;
  for (let i = 0; i < cloudCount; i++) {
    const cloud = document.createElement('div');
    cloud.style.position = 'absolute';
    cloud.style.background = 'radial-gradient(ellipse at center, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0) 70%)';
    
    const width = Math.random() * 400 + 300;
    cloud.style.width = `${width}px`;
    cloud.style.height = `${width / 2}px`;
    
    cloud.style.left = `${Math.random() * 120 - 10}vw`;
    cloud.style.top = `${Math.random() * 40}vh`; 
    
    const duration = Math.random() * 80 + 40;
    const delay = Math.random() * -80; 
    cloud.style.animation = `floatCloud ${duration}s linear ${delay}s infinite alternate`;
    
    container.appendChild(cloud);
  }

  if (!document.getElementById('anim-styles-clouds')) {
    const style = document.createElement('style');
    style.id = 'anim-styles-clouds';
    style.innerHTML = `
      @keyframes floatCloud {
        from { transform: translateX(-15vw); }
        to { transform: translateX(15vw); }
      }
    `;
    document.head.appendChild(style);
  }
}

function createLightning(container) {
  const flash = document.createElement('div');
  flash.style.position = 'absolute';
  flash.style.inset = '0';
  flash.style.background = 'white';
  flash.style.opacity = '0';
  flash.style.pointerEvents = 'none';
  flash.style.animation = 'flashLightning 7s infinite';
  container.appendChild(flash);

  if (!document.getElementById('anim-styles-lightning')) {
    const style = document.createElement('style');
    style.id = 'anim-styles-lightning';
    style.innerHTML = `
      @keyframes flashLightning {
        0%, 93%, 96%, 100% { opacity: 0; }
        94%, 98% { opacity: 0.9; }
        95% { opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }
}

function createHeatwave(container) {
  // SVG Filter for heat distortion
  const svg = document.createElement('div');
  svg.innerHTML = `
    <svg style="width:0;height:0;position:absolute;">
      <filter id="heat">
        <feTurbulence type="fractalNoise" baseFrequency="0.01 0.05" numOctaves="2" result="noise" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="10" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  `;
  container.appendChild(svg);
  document.body.style.filter = 'url(#heat)';
  
  // Clean up filter when changed
  const observer = new MutationObserver((mutations) => {
    if (!document.getElementById('app').className.includes('theme-hot')) {
      document.body.style.filter = 'none';
      observer.disconnect();
    }
  });
  observer.observe(document.getElementById('app'), { attributes: true });
}

function createFrost(container) {
  // Add a frozen border effect
  const frost = document.createElement('div');
  frost.style.position = 'absolute';
  frost.style.inset = '0';
  frost.style.boxShadow = 'inset 0 0 150px rgba(255,255,255,0.8), inset 0 0 50px rgba(200,230,255,0.6)';
  frost.style.pointerEvents = 'none';
  frost.style.zIndex = '5';
  container.appendChild(frost);
}
