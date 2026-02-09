const { initDatabase, resetDatabase, getStations } = require('./server/db');
const fs = require('fs');
const path = require('path');

async function runTest() {
  console.log('--- STARTING RESET VERIFICATION ---');
  
  // 1. Init
  await initDatabase();
  console.log('DB Initialized.');
  
  // 2. Check current state
  let stations = getStations();
  console.log(`Current Stations: ${stations.length}`);
  
  // 3. Trigger Reset
  console.log('Triggering resetDatabase()...');
  resetDatabase();
  
  // 4. Check state immediately after
  stations = getStations();
  console.log(`Post-Reset Stations (Memory): ${stations.length}`);
  
  if (stations.length === 2) {
    console.log('✅ In-Memory Reset Successful');
  } else {
    console.error('❌ In-Memory Reset FAILED');
  }
  
  // 5. Check Persistence
  // Reload DB from file to verify save
  console.log('Reloading DB from disk...');
  await initDatabase();
  stations = getStations();
  console.log(`Post-Reload Stations (Disk): ${stations.length}`);
  
   if (stations.length === 2) {
    console.log('✅ Disk Persistence Successful');
  } else {
    console.error('❌ Disk Persistence FAILED');
  }
}

runTest();
