/**
 * AI Railway Simulation - Database Module (sql.js version)
 * Handles SQLite initialization and data access for stations, trains, and events.
 */
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const dbPath = path.join(dataDir, 'simulation.db');

let db = null;

async function initDatabase() {
  const SQL = await initSqlJs();
  
  // Ensure data directory exists
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  // Load existing database or create new one
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }
  
  // Initialize tables
  db.run(`
    CREATE TABLE IF NOT EXISTS stations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      x REAL NOT NULL,
      y REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS trains (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      current_station_id INTEGER,
      target_station_id INTEGER,
      x REAL NOT NULL,
      y REAL NOT NULL,
      speed_kmh REAL DEFAULT 80,
      departure_time DATETIME,
      status TEXT DEFAULT 'idle',
      FOREIGN KEY (current_station_id) REFERENCES stations(id),
      FOREIGN KEY (target_station_id) REFERENCES stations(id)
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tracks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      station_a_id INTEGER,
      station_b_id INTEGER,
      FOREIGN KEY (station_a_id) REFERENCES stations(id),
      FOREIGN KEY (station_b_id) REFERENCES stations(id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);
  
  // Seed initial settings
  const hasAuto = db.exec("SELECT COUNT(*) FROM settings WHERE key = 'auto_enabled'")[0]?.values[0][0] || 0;
  if (hasAuto === 0) {
    db.run("INSERT INTO settings (key, value) VALUES ('auto_enabled', 'false')");
  }
  
  // Seed initial data if empty
  const stationCount = db.exec('SELECT COUNT(*) as count FROM stations')[0]?.values[0][0] || 0;
  if (stationCount === 0) {
    // Two initial stations - 150km apart (realistic inter-city distance)
    // Coordinates are in "km" units for realism (4px = 1km)
    db.run('INSERT INTO stations (name, x, y) VALUES (?, ?, ?)', ['Central Junction', 50, 300]);
    db.run('INSERT INTO stations (name, x, y) VALUES (?, ?, ?)', ['Northfield Terminal', 650, 300]);
    
    // One train starting at Central Junction
    db.run('INSERT INTO trains (name, current_station_id, x, y, speed_kmh, status) VALUES (?, ?, ?, ?, ?, ?)', ['Express-01', 1, 50, 300, 80, 'idle']);
    
    // Initial event
    db.run('INSERT INTO events (type, message) VALUES (?, ?)', ['SYSTEM', 'Railway simulation initialized. Two stations online.']);
    
    // Initial track
    db.run('INSERT INTO tracks (station_a_id, station_b_id) VALUES (?, ?)', [1, 2]);

    saveDatabase();
  }
  
  return db;
}

function saveDatabase() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

function getStations() {
  const result = db.exec('SELECT * FROM stations ORDER BY id');
  if (!result[0]) return [];
  return result[0].values.map(row => ({
    id: row[0], name: row[1], x: row[2], y: row[3], created_at: row[4]
  }));
}

function getTrains() {
  const result = db.exec('SELECT * FROM trains');
  if (!result[0]) return [];
  return result[0].values.map(row => ({
    id: row[0], name: row[1], current_station_id: row[2], target_station_id: row[3],
    x: row[4], y: row[5], speed_kmh: row[6], departure_time: row[7], status: row[8]
  }));
}

function getTrain(id) {
  const result = db.exec('SELECT * FROM trains WHERE id = ?', [id]);
  if (!result[0]?.values[0]) return null;
  const row = result[0].values[0];
  return {
    id: row[0], name: row[1], current_station_id: row[2], target_station_id: row[3],
    x: row[4], y: row[5], speed_kmh: row[6], departure_time: row[7], status: row[8]
  };
}

function getStation(id) {
  const result = db.exec('SELECT * FROM stations WHERE id = ?', [id]);
  if (!result[0]?.values[0]) return null;
  const row = result[0].values[0];
  return { id: row[0], name: row[1], x: row[2], y: row[3], created_at: row[4] };
}

function updateTrain(id, data) {
  const fields = Object.keys(data).map(k => `${k} = ?`).join(', ');
  const values = [...Object.values(data), id];
  db.run(`UPDATE trains SET ${fields} WHERE id = ?`, values);
  saveDatabase();
}

function addStation(name, x, y) {
  db.run('INSERT INTO stations (name, x, y) VALUES (?, ?, ?)', [name, x, y]);
  saveDatabase();
  const result = db.exec('SELECT last_insert_rowid()');
  return result[0].values[0][0];
}

function addEvent(type, message) {
  db.run('INSERT INTO events (type, message) VALUES (?, ?)', [type, message]);
  saveDatabase();
}

function getRecentEvents(limit = 20) {
  const result = db.exec('SELECT * FROM events ORDER BY id DESC LIMIT ?', [limit]);
  if (!result[0]) return [];
  return result[0].values.map(row => ({
    id: row[0], type: row[1], message: row[2], timestamp: row[3]
  }));
}

function setSetting(key, value) {
  db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, String(value)]);
  saveDatabase();
}

function getSetting(key, defaultValue = null) {
  const result = db.exec('SELECT value FROM settings WHERE key = ?', [key]);
  if (!result[0]?.values[0]) return defaultValue;
  return result[0].values[0][0];
}

module.exports = {
  initDatabase,
  getStations,
  getTrains,
  getTrain,
  getStation,
  updateTrain,
  addStation,
  addTrack,
  addTrain,
  addEvent,
  getRecentEvents,
  getTracks,
  resetDatabase,
  setSetting,
  getSetting
};

function getTracks() {
  const result = db.exec('SELECT * FROM tracks');
  if (!result[0]) return [];
  return result[0].values.map(row => ({
    id: row[0], station_a_id: row[1], station_b_id: row[2]
  }));
}

function addTrack(a, b) {
  db.run('INSERT INTO tracks (station_a_id, station_b_id) VALUES (?, ?)', [a, b]);
  saveDatabase();
}

function addTrain(name, stationId) {
  // Get Station Coords
  const result = db.exec('SELECT x, y FROM stations WHERE id = ?', [stationId]);
  if (!result[0]?.values[0]) return null;
  const { x, y } = { x: result[0].values[0][0], y: result[0].values[0][1] };
  
  db.run('INSERT INTO trains (name, current_station_id, x, y, speed_kmh, status) VALUES (?, ?, ?, ?, ?, ?)', 
    [name, stationId, x, y, 100 + Math.floor(Math.random() * 60), 'idle'] // Faster trains (100-160 km/h)
  );
  saveDatabase();
  return db.exec('SELECT last_insert_rowid()')[0].values[0][0];
}

function resetDatabase() {
  if (!db) return;
  db.run('DELETE FROM trains');
  db.run('DELETE FROM events');
  db.run('DELETE FROM stations');
  db.run('DELETE FROM tracks');
  
  try {
    db.run('DELETE FROM sqlite_sequence'); // Reset Auto-Increment counters
  } catch (e) {
    // Table might not exist yet, ignore
  }
  
  // Re-seed with initial data - IDs will now regenerate starting at 1
  db.run('INSERT INTO stations (name, x, y) VALUES (?, ?, ?)', ['Central Junction', 50, 300]);
  db.run('INSERT INTO stations (name, x, y) VALUES (?, ?, ?)', ['Northfield Terminal', 650, 300]);
  db.run('INSERT INTO tracks (station_a_id, station_b_id) VALUES (?, ?)', [1, 2]);
  db.run('INSERT INTO trains (name, current_station_id, x, y, speed_kmh, status) VALUES (?, ?, ?, ?, ?, ?)', ['Express-01', 1, 50, 300, 80, 'idle']);
  db.run('INSERT INTO events (type, message) VALUES (?, ?)', ['SYSTEM', 'Simulation reset. Systems online.']);
  
  saveDatabase();
}
