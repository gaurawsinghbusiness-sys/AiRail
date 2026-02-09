/**
 * AI Railway Simulation - Main Server
 * Express server with API routes for simulation state and AI expansion.
 */
const express = require('express');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

const agents = require('./agents');

// ============== API ROUTES ==============

// Get full simulation state
app.get('/api/state', (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  const stations = db.getStations();
  const trains = db.getTrains();
  const events = db.getRecentEvents(30);
  res.json({ stations, trains, events });
});

// Dispatch a train to a station
app.post('/api/train/:id/dispatch', (req, res) => {
  const trainId = parseInt(req.params.id);
  const { targetStationId } = req.body;
  
  const train = db.getTrain(trainId);
  if (!train) return res.status(404).json({ error: `Train ${trainId} not found` });

  const targetStation = db.getStation(targetStationId);
  if (!targetStation) return res.status(404).json({ error: `Station ${targetStationId} not found` });

  const sourceStation = db.getStation(train.current_station_id);
  
  // Prevent dispatching to same station
  if (train.current_station_id == targetStationId) {
    return res.status(400).json({ error: 'Train is already at the target station' });
  }
  
  // Calculate distance
  const dx = targetStation.x - train.x;
  const dy = targetStation.y - train.y;
  const distancePx = Math.sqrt(dx * dx + dy * dy);
  const distanceKm = distancePx / 4;
  
  const timeHours = distanceKm / train.speed_kmh;
  const timeMinutes = Math.round(timeHours * 60);
  
  db.updateTrain(trainId, {
    target_station_id: targetStationId,
    departure_time: new Date().toISOString(),
    status: 'moving'
  });
  
  db.addEvent('DISPATCH', `🚂 ${train.name} dispatched to ${targetStation.name} (${distanceKm.toFixed(1)} km)`);
  
  res.json({ success: true, distanceKm: distanceKm.toFixed(1), etaMinutes: timeMinutes });
});

// Update train position (called by simulation tick)
app.post('/api/train/:id/update', (req, res) => {
  const trainId = parseInt(req.params.id);
  const { x, y, status, current_station_id } = req.body;
  
  const updates = {};
  if (x !== undefined) updates.x = x;
  if (y !== undefined) updates.y = y;
  if (status !== undefined) updates.status = status;
  if (current_station_id !== undefined) {
    updates.current_station_id = current_station_id;
    updates.target_station_id = null;
    updates.departure_time = null;
  }
  
  db.updateTrain(trainId, updates);
  res.json({ success: true });
});

// Add event to comms feed
app.post('/api/events', (req, res) => {
  const { type, message } = req.body;
  db.addEvent(type, message);
  res.json({ success: true });
});

// AI Expansion endpoint
// AI Expansion endpoint
app.post('/api/expand', async (req, res) => {
  try {
    const result = await agents.expandNetwork();
    if (result.error) {
       return res.status(429).json({ success: false, error: result.error });
    }
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'AI expansion failed' });
  }
});

// Reset Simulation
app.post('/api/reset', (req, res) => {
  db.resetDatabase();
  res.json({ success: true, message: 'Simulation reset completely.' });
});

// Start server after DB init
async function start() {
  await db.initDatabase();
  app.listen(PORT, () => {
    console.log(`🚂 AI Railway Simulation running on http://localhost:${PORT}`);
  });
}

start();
