/**
 * AI Railway Simulation - Game Logic
 * Infinite Canvas using CSS Transforms for high-performance panning/zooming.
 */

// State
let stations = [];
let trains = [];
let events = [];
let simulationInterval = null;

// Infinite Canvas State
let viewX = 0;
let viewY = 0;
let zoomLevel = 1.0;
let isDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;
let targetViewX = 0;
let targetViewY = 0;

// Constants - REALISTIC PHYSICS
const PIXELS_PER_KM = 4;
const SIMULATION_SPEED = 60;
const TICK_RATE = 50; 

// DOM Elements
const canvas = document.getElementById('simulation-canvas');
const container = document.querySelector('.canvas-container');
const commsFeed = document.getElementById('comms-feed');
const trainStatusEl = document.getElementById('train-status');
const stationCountEl = document.getElementById('station-count');
const trainCountEl = document.getElementById('train-count');
const expandBtn = document.getElementById('expand-btn');
const viewCoordsEl = document.getElementById('view-coords');
const viewZoomEl = document.getElementById('view-zoom');

// ============== INITIALIZATION ==============

async function init() {
  await fetchState();
  
  // Set initial view to center on the action (approx middle of 0,0 map)
  viewX = 350; 
  viewY = 100;
  targetViewX = viewX;
  targetViewY = viewY;
  
  startSimulation();
  setupEventListeners();
  
  // Start Clock
  setInterval(updateUTCClock, 1000);
  updateUTCClock();
  
  if (expandBtn) expandBtn.addEventListener('click', triggerAIExpansion);
    
  // Start animation loop for sub-pixel smooth transforms
  requestAnimationFrame(animate);
}

function updateUTCClock() {
  const now = new Date();
  const timeString = now.toUTCString().split(' ')[4];
  const dateString = now.toISOString().split('T')[0];
  const clockEl = document.getElementById('utc-clock');
  if (clockEl) {
    clockEl.textContent = `${dateString} ${timeString} UTC`;
  }
}

function setupEventListeners() {
  if (!container) return;

  container.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    isDragging = true;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    window.manualScrolling = true;
    clearTimeout(manualScrollTimeout);
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    
    const dx = e.clientX - lastMouseX;
    const dy = e.clientY - lastMouseY;
    
    viewX += dx / zoomLevel;
    viewY += dy / zoomLevel;
    targetViewX = viewX;
    targetViewY = viewY;
    
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    
    updateTransform();
  });

  window.addEventListener('mouseup', () => {
    isDragging = false;
    manualScrollTimeout = setTimeout(() => {
      window.manualScrolling = false;
    }, 5000);
  });

  container.addEventListener('wheel', (e) => {
    e.preventDefault();
    
    const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.min(Math.max(zoomLevel * scaleFactor, 0.1), 5.0);
    
    if (newZoom !== zoomLevel) {
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      const worldX = mouseX / zoomLevel - viewX;
      const worldY = mouseY / zoomLevel - viewY;
      
      zoomLevel = newZoom;
      
      viewX = mouseX / zoomLevel - worldX;
      viewY = mouseY / zoomLevel - worldY;
      targetViewX = viewX;
      targetViewY = viewY;
      
      updateTransform();
    }
  }, { passive: false });
}

function updateTransform() {
  const viewport = document.getElementById('viewport');
  if (viewport) {
    viewport.setAttribute('transform', `scale(${zoomLevel}) translate(${viewX}, ${viewY})`);
  }
  
  // Update CSS grid background offset
  const gridX = (viewX * zoomLevel) % 40;
  const gridY = (viewY * zoomLevel) % 40;
  canvas.style.setProperty('--grid-offset-x', `${gridX}px`);
  canvas.style.setProperty('--grid-offset-y', `${gridY}px`);
  
  if (viewCoordsEl) viewCoordsEl.textContent = `${Math.round(-viewX)}, ${Math.round(-viewY)}`;
  if (viewZoomEl) viewZoomEl.textContent = `${zoomLevel.toFixed(1)}x`;
}

function animate() {
  if (window.manualScrolling === false) {
    viewX += (targetViewX - viewX) * 0.1;
    viewY += (targetViewY - viewY) * 0.1;
    updateTransform();
  }
  
  renderDynamicElements();
  requestAnimationFrame(animate);
}

// ============== DATA FETCHING ==============

async function fetchState() {
  try {
    const res = await fetch('/api/state');
    const data = await res.json();
    stations = data.stations;
    trains = data.trains;
    events = data.events;
    updateHeaderStats();
    renderCommsFeed();
    render(); 
  } catch (err) {
    console.error('Failed to fetch state:', err);
  }
}

// ============== RENDERING ==============

function render() {
  if (!canvas) return;
  canvas.innerHTML = '';
  const viewport = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  viewport.id = 'viewport';
  canvas.appendChild(viewport);
  
  for (let i = 0; i < stations.length - 1; i++) {
    drawTrack(stations[i], stations[i + 1], viewport);
  }
  
  stations.forEach(station => drawStation(station, viewport));
  
  updateTransform();
  renderTrainStatus();
}

function renderDynamicElements() {
  const viewport = document.getElementById('viewport');
  if (!viewport) return;
  
  const existingTrains = viewport.querySelectorAll('.train-icon');
  existingTrains.forEach(t => t.remove());
  
  trains.forEach(train => drawTrain(train, viewport));
}

function drawStation(station, parent) {
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.classList.add('station-node');
  g.onclick = () => dispatchTrainTo(station.id);
  
  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle.setAttribute('cx', station.x);
  circle.setAttribute('cy', station.y);
  circle.setAttribute('r', 25);
  circle.setAttribute('fill', '#fff');
  circle.setAttribute('stroke', '#000');
  circle.setAttribute('stroke-width', '4');
  
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  icon.setAttribute('x', station.x);
  icon.setAttribute('y', station.y + 7);
  icon.setAttribute('text-anchor', 'middle');
  icon.setAttribute('font-size', '20');
  icon.textContent = '▣';
  
  const labelBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  labelBg.setAttribute('x', station.x - 70);
  labelBg.setAttribute('y', station.y + 35);
  labelBg.setAttribute('width', 140);
  labelBg.setAttribute('height', 24);
  labelBg.setAttribute('fill', '#fff');
  labelBg.setAttribute('stroke', '#000');
  labelBg.setAttribute('stroke-width', '2');
  
  const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  label.classList.add('station-label');
  label.setAttribute('x', station.x);
  label.setAttribute('y', station.y + 52);
  label.setAttribute('text-anchor', 'middle');
  label.setAttribute('font-size', '14');
  label.setAttribute('font-weight', '800');
  label.textContent = station.name.toUpperCase();
  
  g.appendChild(circle);
  g.appendChild(icon);
  g.appendChild(labelBg);
  g.appendChild(label);
  parent.appendChild(g);
}

function drawTrack(stationA, stationB, parent) {
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.classList.add('track-line');
  line.setAttribute('x1', stationA.x);
  line.setAttribute('y1', stationA.y);
  line.setAttribute('x2', stationB.x);
  line.setAttribute('y2', stationB.y);
  line.setAttribute('stroke', '#000');
  line.setAttribute('stroke-width', '4');
  line.setAttribute('stroke-dasharray', '8 8');
  parent.appendChild(line);
}

function drawTrain(train, parent) {
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.classList.add('train-icon');
  
  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect.setAttribute('x', train.x - 20);
  rect.setAttribute('y', train.y - 20);
  rect.setAttribute('width', 40);
  rect.setAttribute('height', 40);
  rect.setAttribute('fill', train.status === 'moving' ? '#000' : '#fff');
  rect.setAttribute('stroke', '#000');
  rect.setAttribute('stroke-width', '4');
  
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  icon.setAttribute('x', train.x);
  icon.setAttribute('y', train.y + 8);
  icon.setAttribute('text-anchor', 'middle');
  icon.setAttribute('font-size', '24');
  icon.setAttribute('fill', train.status === 'moving' ? '#fff' : '#000');
  icon.textContent = '▶';
  
  g.appendChild(rect);
  g.appendChild(icon);
  parent.appendChild(g);

  if (train.status === 'moving' && !window.manualScrolling) {
    targetViewX = -train.x + (container.clientWidth / 2) / zoomLevel;
    targetViewY = -train.y + (container.clientHeight / 2) / zoomLevel;
  }
}

function renderCommsFeed() {
  if (!commsFeed) return;
  commsFeed.innerHTML = '';
  events.slice().reverse().slice(0, 15).forEach(event => {
    const entry = document.createElement('div');
    entry.classList.add('comms-entry');
    
    if (event.type === 'DISPATCH') entry.classList.add('dispatch');
    else if (event.type === 'ARRIVAL') entry.classList.add('arrival');
    else if (event.type === 'AI_EXPANSION') entry.classList.add('ai');
    else entry.classList.add('system');
    
    const time = new Date(event.timestamp).toLocaleTimeString();
    entry.innerHTML = `
      <div class="comms-time">[${time}]</div>
      <div class="comms-message">${event.message}</div>
    `;
    commsFeed.appendChild(entry);
  });
}

function renderTrainStatus() {
  if (!trainStatusEl) return;
  trainStatusEl.innerHTML = '';
  trains.forEach(train => {
    const card = document.createElement('div');
    card.classList.add('train-card');
    let statusInfo = '';
    if (train.status === 'moving' && train.target_station_id) {
      const target = stations.find(s => s.id === train.target_station_id);
      const source = stations.find(s => s.id === train.current_station_id);
      if (target && source) {
        const totalDist = Math.sqrt(Math.pow(target.x - source.x, 2) + Math.pow(target.y - source.y, 2)) / PIXELS_PER_KM;
        statusInfo = `<div class="stat"><strong>ROUTE:</strong> ${source.name} → ${target.name}</div>
                      <div class="stat"><strong>SPEED:</strong> ${train.speed_kmh} KM/H</div>`;
      }
    } else {
      const currentStation = stations.find(s => s.id === train.current_station_id);
      statusInfo = `<div class="stat"><strong>STATUS:</strong> IDLE at ${currentStation?.name || 'Unknown'}</div>`;
    }
    card.innerHTML = `<h3>${train.name}</h3>${statusInfo}`;
    trainStatusEl.appendChild(card);
  });
}

function updateHeaderStats() {
  if (stationCountEl) stationCountEl.textContent = `Stations: ${stations.length}`;
  if (trainCountEl) trainCountEl.textContent = `Trains: ${trains.length}`;
}

// ============== SIMULATION ==============

function startSimulation() {
  simulationInterval = setInterval(simulationTick, TICK_RATE);
}

async function simulationTick() {
  let stateChanged = false;
  for (const train of trains) {
    if (train.status !== 'moving' || !train.target_station_id) continue;
    const target = stations.find(s => s.id === train.target_station_id);
    if (!target) continue;

    const simSecondsPerTick = (TICK_RATE / 1000) * SIMULATION_SPEED;
    const kmPerTick = train.speed_kmh * (simSecondsPerTick / 3600);
    const pixelsPerTick = kmPerTick * PIXELS_PER_KM;

    const dx = target.x - train.x;
    const dy = target.y - train.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance <= pixelsPerTick) {
      train.x = target.x;
      train.y = target.y;
      train.status = 'idle';
      train.current_station_id = target.id;
      train.target_station_id = null;
      await fetch(`/api/train/${train.id}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ x: train.x, y: train.y, status: 'idle', current_station_id: target.id })
      });
      await fetchState();
      stateChanged = true;
    } else {
      train.x += (dx / distance) * pixelsPerTick;
      train.y += (dy / distance) * pixelsPerTick;
    }
  }
}

async function dispatchTrainTo(stationId) {
  const train = trains.find(t => t.status === 'idle');
  if (!train) return alert('No idle trains!');
  
  // Robust ID/Name matching
  let resolvedId = stationId;
  if (typeof stationId === 'string') {
    const s = stations.find(s => s.name.toLowerCase() === stationId.toLowerCase() || s.id == stationId);
    if (s) resolvedId = s.id;
  }

  try {
    const res = await fetch(`/api/train/${train.id}/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetStationId: resolvedId })
    });
    
    if (res.ok) {
      await fetchState();
    } else {
      const err = await res.json();
      console.warn('Dispatch denied:', err.error);
    }
  } catch (err) {
    console.error('Dispatch failed:', err);
  }
}

async function triggerAIExpansion() {
  if (expandBtn && expandBtn.style.display !== 'none') {
    expandBtn.disabled = true;
    expandBtn.textContent = '🤖 EXPANDING...';
  }
  try {
    const res = await fetch('/api/expand', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      // Add a "DevOps" log locally for immediate feedback
      events.unshift({
        type: 'SYSTEM',
        message: `🚀 Auto-Deploy: New station constructed. Optimizing routes...`,
        timestamp: new Date().toISOString()
      });
      renderCommsFeed();
      await fetchState();
    }
  } catch (err) { console.error('AI Expansion failed:', err); }
  finally {
    if (expandBtn) {
      expandBtn.disabled = false;
      expandBtn.textContent = '🤖 AI EXPAND';
    }
  }
}

// Auto-Development Logic
let autoExpandInterval = null;

function setupAutoControls() {
  const autoBtn = document.getElementById('auto-btn');
  
  if (autoBtn) {
    autoBtn.addEventListener('click', () => {
      if (autoExpandInterval) {
        clearInterval(autoExpandInterval);
        autoExpandInterval = null;
        autoBtn.textContent = '🤖 AUTO: OFF';
        autoBtn.classList.remove('btn-active');
        autoBtn.classList.add('btn-off');
      } else {
        // Trigger every 20 seconds (3 RPM Limit)
        const intervalMs = 20000; 
        autoExpandInterval = setInterval(triggerAIExpansion, intervalMs);
        triggerAIExpansion(); // Immediate trigger
        autoBtn.textContent = '🤖 AUTO: ON';
        autoBtn.classList.remove('btn-off');
        autoBtn.classList.add('btn-active');
      }
    });
  }
}

// Draw Signal Lights on Tracks
function drawTrack(stationA, stationB, parent) {
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.classList.add('track-line');
  line.setAttribute('x1', stationA.x);
  line.setAttribute('y1', stationA.y);
  line.setAttribute('x2', stationB.x);
  line.setAttribute('y2', stationB.y);
  line.setAttribute('stroke', '#000');
  line.setAttribute('stroke-width', '4');
  line.setAttribute('stroke-dasharray', '8 8');
  parent.appendChild(line);

  // Signal Light (Midpoint)
  const midX = (stationA.x + stationB.x) / 2;
  const midY = (stationA.y + stationB.y) / 2;
  
  const signalGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  const signalBox = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  signalBox.setAttribute('x', midX - 6);
  signalBox.setAttribute('y', midY - 12);
  signalBox.setAttribute('width', 12);
  signalBox.setAttribute('height', 24);
  signalBox.setAttribute('fill', '#333');
  
  const light = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  light.setAttribute('cx', midX);
  light.setAttribute('cy', midY); // Default Green/Red logic would go here
  light.setAttribute('r', 4);
  
  // Simple Mock Logic: Randomly Red/Green for visual flair (since we don't have real block logic yet)
  // In a real system, this would check if a train is on the segment
  const isSegmentOccupied = Math.random() > 0.7; 
  light.setAttribute('fill', isSegmentOccupied ? '#ff0000' : '#00ff00');
  
  signalGroup.appendChild(signalBox);
  signalGroup.appendChild(light);
  parent.appendChild(signalGroup);
}

let manualScrollTimeout;
// Start
init();

function setupNavigationControls() {
  const panAmount = 100;
  
  document.getElementById('pan-up')?.addEventListener('click', () => {
    targetViewY += panAmount / zoomLevel;
    window.manualScrolling = true;
    resetManualScrollTimeout();
  });
  
  document.getElementById('pan-down')?.addEventListener('click', () => {
    targetViewY -= panAmount / zoomLevel;
    window.manualScrolling = true;
    resetManualScrollTimeout();
  });
  
  document.getElementById('pan-left')?.addEventListener('click', () => {
    targetViewX += panAmount / zoomLevel;
    window.manualScrolling = true;
    resetManualScrollTimeout();
  });
  
  document.getElementById('pan-right')?.addEventListener('click', () => {
    targetViewX -= panAmount / zoomLevel;
    window.manualScrolling = true;
    resetManualScrollTimeout();
  });
  
  document.getElementById('pan-reset')?.addEventListener('click', () => {
    targetViewX = -600;
    targetViewY = -400;
    zoomLevel = 0.4;
    updateZoomSlider();
    window.manualScrolling = true;
    resetManualScrollTimeout();
  });
  
  document.getElementById('zoom-in')?.addEventListener('click', () => {
    adjustZoom(1.2);
  });
  
  document.getElementById('zoom-out')?.addEventListener('click', () => {
    adjustZoom(0.8);
  });
  
  const slider = document.getElementById('zoom-slider');
  slider?.addEventListener('input', (e) => {
    const newZoom = parseFloat(e.target.value);
    applyZoom(newZoom);
  });
}

function adjustZoom(factor) {
  const newZoom = Math.min(Math.max(zoomLevel * factor, 0.1), 5.0);
  applyZoom(newZoom);
}

function applyZoom(newZoom) {
  if (newZoom === zoomLevel) return;
  
  // Zoom relative to center of screen
  const rect = container.getBoundingClientRect();
  const centerX = rect.width / 2;
  const centerY = rect.height / 2;
  
  const worldX = centerX / zoomLevel - viewX;
  const worldY = centerY / zoomLevel - viewY;
  
  zoomLevel = newZoom;
  
  viewX = centerX / zoomLevel - worldX;
  viewY = centerY / zoomLevel - worldY;
  targetViewX = viewX;
  targetViewY = viewY;
  
  updateZoomSlider();
  updateTransform();
}

function updateZoomSlider() {
  const slider = document.getElementById('zoom-slider');
  if (slider) slider.value = zoomLevel;
}

function resetManualScrollTimeout() {
  clearTimeout(manualScrollTimeout);
  manualScrollTimeout = setTimeout(() => {
    window.manualScrolling = false;
  }, 5000);
}

// Update setupEventListeners to include navigation AND auto controls
const originalSetupEventListeners = setupEventListeners;
setupEventListeners = function() {
  originalSetupEventListeners();
  setupNavigationControls();
  setupAutoControls();
};
