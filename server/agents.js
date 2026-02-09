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

  logger.info('🤖 COMMANDER (Gemini): Auditing Network Evolution...');
  
  const stations = db.getStations();
  const stationCount = stations.length;
  
  // Logic: 50 stations per "City Area"
  const areaNumber = Math.floor(stationCount / 50) + 1;
  const isTransitioning = (stationCount > 0 && stationCount % 50 === 0);

  const prompt = `
    You are the Senior Infrastructure Manager. You are professional, strategic, and concise.
    Current Global Stats: ${stationCount} stations across ${areaNumber} urban zones.
    
    MANAGEMENT DIRECTIVE:
    - If station count is < 50, focus on "Urban Consolidation" in the primary area.
    - If station count is exactly ${stationCount} and it's a multiple of 50, trigger "Global Hub Expansion" (Area ${areaNumber + 1}). 
    - You must choose a realistic city name for the current zone (e.g., Tokyo, London, Mumbai).
    - If transitioning, your strategy must include the word "JUMP" and the new city name.
    
    Return JSON: { "strategy": "...", "cityName": "...", "areaType": "Urban|Global" }
  `;

  try {
    const result = await geminiModel.generateContent(prompt);
    const response = await result.response;
    const text = response.text().replace(/```json|```/g, "").trim();
    dailyPlan = JSON.parse(text);
    lastBriefingTime = now;
    
    logger.success(`🤖 MANAGER: Area ${areaNumber} Strategy Locked.`, dailyPlan);
    db.addEvent('COMMANDER', `📜 Management Report: ${dailyPlan.strategy}`);
    return dailyPlan;
  } catch (error) {
    logger.error('MANAGER Failed:', error.message);
    return { strategy: "Maintain existing lines and ensure safety.", cityName: "Central", areaType: "Urban" };
  }
}
/**
 * 2. WORKER AGENT (Groq Llama 3)
 * Executes the plan by building specific stations.
 */
async function expandNetwork() {
  const now = Date.now();
  // USER REQUEST: Strict Throttling (exactly one build per 2h cycle if auto)
  // We allow manual override, but lastWorkerTime prevents spam.
  if (now - lastWorkerTime < 60000) { // 1 min safety buffer for manual clicks
    return { success: false, error: 'Throttled. Infrastructure cooldown in progress.' };
  }
  lastWorkerTime = now;

  const plan = await getDailyBriefing();
  
  try {
    logger.info('🐅 WORKER (Groq): Executing build...', plan);
    
    const stations = db.getStations();
    const lastStation = stations[stations.length - 1];
    const isJump = plan.strategy.includes('JUMP');
    
    const prompt = `
      Role: Lead Field Engineer
      Current Strategy: "${plan.strategy}"
      City Context: "${plan.cityName}"
      Last Coordinates: x:${lastStation.x}, y:${lastStation.y}
      
      TASK: 
      - Build exactly ONE station.
      - If strategy says "JUMP", the new station should be +/- 4000px away from last station.
      - Otherwise, keep distance ~400px.
      
      Return JSON ONLY:
      { "name": "${plan.cityName} ${stations.length + 1}", "x": 123, "y": 456, "connectToId": ${lastStation.id}, "reason": "Eng reason" }
    `;

    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.3-70b-versatile",
      temperature: 0.6,
      response_format: { type: "json_object" }
    });

    const proposal = JSON.parse(completion.choices[0].message.content);
    const newId = db.addStation(proposal.name, proposal.x, proposal.y);
    db.addTrack(proposal.connectToId || lastStation.id, newId);
    
    logger.success('🐅 WORKER: Project Delivered.', proposal);
    db.addEvent('AI_WORKER', `🔨 Built ${proposal.name}. ${proposal.reason}`);
    
    checkFleetBalance();
    return { success: true, stationId: newId, ...proposal };
  } catch (error) {
    logger.error('WORKER Failed:', error.message);
    db.addEvent('SYSTEM', `⚠️ Development Stalled: ${error.message}`);
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
