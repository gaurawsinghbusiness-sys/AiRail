/**
 * AI Railway Simulation - AI Agents Module
 * Dual-Agent Architecture: Gemini (Commander) + Groq (Worker)
 */
const { GoogleGenerativeAI } = require("@google/generative-ai");
const Groq = require("groq-sdk");
const db = require('./db');
const logger = require('./logger');

// Initialize AI Clients
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// User requested "Gemini 3 Flash" -> Found "gemini-3-flash-preview" in available models
const geminiModel = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// State
let dailyPlan = null;
let lastBriefingTime = 0;
const BRIEFING_INTERVAL = 2 * 60 * 60 * 1000; // 2 Hours (Real-time) - User Request: "12:00 am, 2:00 am"

// Rate Limiting (Groq is fast, but let's keep it sane)
const WORKER_INTERVAL_MS = 10000; // 10s per build
let lastWorkerTime = 0;

/**
 * 1. COMMANDER AGENT (Gemini 1.5 Flash)
 * Generates high-level strategic plan once per "day".
 */
async function getDailyBriefing() {
  const now = Date.now();
  if (dailyPlan && (now - lastBriefingTime < BRIEFING_INTERVAL)) {
    return dailyPlan;
  }

  logger.info('� MARATHON AGENT: Beginning Strategic Planning Phase...');
  
  const stations = db.getStations();
  const stationCount = stations.length;
  const areaNumber = Math.floor(stationCount / 50) + 1;

  const prompt = `
    Role: Senior Infrastructure Manager (Strategist)
    Track: The Marathon Agent
    Goal: Plan long-term network growth.
    
    Current Stats: ${stationCount} stations, Area ${areaNumber}.
    
    TASK:
    1. Analyze the current network density. 
    2. Define a strategic directive (Urban Expansion or Inter-City Jump if count >= 50).
    3. Generate a "Thought Signature" - your internal reasoning for this choice.
    
    Format: JSON
    {
      "thoughtSignature": "Inner monologue about topography and long-term goals...",
      "strategy": "Concise strategy statement",
      "cityName": "Realistic City Name",
      "areaType": "Urban|Global"
    }
  `;

  try {
    const result = await geminiModel.generateContent(prompt);
    const response = await result.response;
    const text = response.text().replace(/```json|```/g, "").trim();
    dailyPlan = JSON.parse(text);
    lastBriefingTime = now;
    
    db.addEvent('AI_EXPANSION', `[THOUGHT] ${dailyPlan.thoughtSignature}`);
    db.addEvent('COMMANDER', `📜 STRATEGY: ${dailyPlan.strategy}`);
    return dailyPlan;
  } catch (error) {
    logger.error('PLAN Phase Failed:', error.message);
    return { strategy: "Maintain system stability.", cityName: "Central", thoughtSignature: "Safety-first protocol engaged." };
  }
}

/**
 * PHASE 2: PROPOSE (Groq Engineer)
 */
async function proposeBuild(plan, stations) {
  const lastStation = stations[stations.length - 1];
  const isJump = plan.strategy.includes('JUMP');
  
  const contextStations = stations.slice(-5).map(s => ({ id: s.id, name: s.name, x: s.x, y: s.y }));

  const prompt = `
    Role: Lead Railway Engineer (Execution)
    Strategy: ${plan.strategy}
    City: ${plan.cityName}
    Area: ${plan.areaType}
    
    CONTEXT (Last 5 Stations):
    ${JSON.stringify(contextStations)}
    
    ACTION: Propose ONE new station. 
    - The new station MUST connect to one of the existing IDs: ${contextStations.map(s => s.id).join(', ')}.
    - Coordinate System: 4px = 1km. 
    - Choose realistic distances (50-300km from connection point).
    
    JSON: { "name": "Station Name", "x": number, "y": number, "connectToId": existing_id, "thoughtSignature": "Brief engineering rationale" }
  `;

  const completion = await groq.chat.completions.create({
    messages: [{ role: "user", content: prompt }],
    model: "llama-3.3-70b-versatile",
    response_format: { type: "json_object" }
  });

  return JSON.parse(completion.choices[0].message.content);
}

/**
 * PHASE 3: VERIFY (Gemini Surveyor)
 * The "Self-Correction" loop check.
 */
async function verifyBuild(proposal, stations) {
  const prompt = `
    Role: Project Surveyor (Quality Control)
    Proposal: ${JSON.stringify(proposal)}
    Context: Existing ${stations.length} stations.
    
    TASK: Verify if the proposed coordinates and name are sensible. 
    Check for:
    - Coordinate collisions (too close to others).
    - Sensible naming.
    
    JSON: { "valid": true/false, "feedback": "Why it failed or pass" }
  `;

  const result = await geminiModel.generateContent(prompt);
  const text = result.response.text().replace(/```json|```/g, "").trim();
  return JSON.parse(text);
}
/**
 * 2. WORKER AGENT (Groq Llama 3)
 * Executes the plan by building specific stations.
 */
async function expandNetwork() {
  const now = Date.now();
  if (now - lastWorkerTime < 60000) { 
    return { success: false, error: 'Marathon Agent is cooling down between cycles.' };
  }
  lastWorkerTime = now;

  // 1. PHASE: PLAN
  const plan = await getDailyBriefing();
  const stations = db.getStations();

  try {
    let proposal = null;
    let verification = { valid: false };
    let attempts = 0;
    const maxAttempts = 3;

    // ORCHESTRATION LOOP: Propose -> Verify -> Correct
    while (!verification.valid && attempts < maxAttempts) {
      attempts++;
      logger.info(`🐅 ORCHESTRATOR: Attempt ${attempts} - Proposing build...`);
      
      // 2. PHASE: PROPOSE
      proposal = await proposeBuild(plan, stations);
      db.addEvent('AI_EXPANSION', `[THOUGHT] ${proposal.thoughtSignature}`);
      
      // 3. PHASE: VERIFY
      verification = await verifyBuild(proposal, stations);
      
      if (!verification.valid) {
        db.addEvent('SYSTEM', `🔄 SELF-CORRECT: Proposal rejected by Surveyor. Feedback: ${verification.feedback}. Retrying...`);
        logger.warn(`🐅 ORCHESTRATOR: Verification failed. ${verification.feedback}`);
      }
    }

    if (!verification.valid) throw new Error("Could not reach verified consensus after multiple attempts.");

    // 4. PHASE: EXECUTE
    const newId = db.addStation(proposal.name, proposal.x, proposal.y);
    
    // SAFETY: If AI hallucinated a connectToId (or sent a String), force Number and check validity
    const validStations = db.getStations();
    let connectionId = Number(proposal.connectToId);
    
    if (isNaN(connectionId) || !validStations.find(s => s.id === connectionId)) {
      // Fallback: Connect to the station created BEFORE the one we just added (the previous tail)
      if (validStations.length >= 2) {
        connectionId = validStations[validStations.length - 2].id;
        logger.warn(`🐅 ORCHESTRATOR: Hallucination/Type mismatch detected. Falling back to connection ID: ${connectionId}`);
      } else {
        // Absolute fallback for first connection
        connectionId = validStations[0].id;
      }
    }
    
    db.addTrack(connectionId, newId);
    
    logger.success(' ORCHESTRATOR: Execution Phase Complete.', proposal);
    db.addEvent('CONSTRUCTION', `🏗️ Built ${proposal.name} at (${proposal.x}, ${proposal.y}) connected to Hub #${connectionId}`);
    
    checkFleetBalance();
    return { success: true, stationId: newId, ...proposal };
  } catch (error) {
    logger.error('ORCHESTRATION Failed:', error.message);
    db.addEvent('SYSTEM', `⚠️ SYSTEM ERROR: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Auto-Spawn Trains Logic (Run after successful build)
// Simple rule: 1 Train per 3 Stations
async function checkFleetBalance() {
  const stations = db.getStations();
  const trains = db.getTrains();
  
  if (stations.length > trains.length * 3) {
    logger.info('🚄 FLEET MANAGER: Spawning new train to meet demand...');
    const startStation = stations[Math.floor(Math.random() * stations.length)];
    const trainName = `Express-${String(trains.length + 1).padStart(2, '0')}`;
    
    db.addTrain(trainName, startStation.id);
    db.addEvent('SYSTEM', `🚄 New Rolling Stock Acquired: ${trainName}`);
  }
}

// Fallback Removed per User Request ("REMOVE OFFILINE WORKERS")

module.exports = { expandNetwork };
