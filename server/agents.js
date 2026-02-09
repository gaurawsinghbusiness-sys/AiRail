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
// User requested "Gemini 3 Flash" -> Using 2.0 Flash Exp as closest valid API string
const geminiModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// State
let dailyPlan = null;
let lastBriefingTime = 0;
const BRIEFING_INTERVAL = 24 * 60 * 60 * 1000; // 24 Hours (Real-time) - Can be accelerated

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
    return dailyPlan; // Stick to the plan
  }

  logger.info('🤖 COMMANDER (Gemini): Generating Daily Briefing...');
  
  const stations = db.getStations();
  const prompt = `
    You are the Strategic Commander for a Railway Network.
    Current Stations: ${stations.length}.
    
    Generate a 1-sentence strategic goal for today's expansion (e.g., "Expand north to connect the industrial sector" or "Densify the central loop").
    Return JSON: { "strategy": "..." }
  `;

  try {
    const result = await geminiModel.generateContent(prompt);
    const response = await result.response;
    const text = response.text().replace(/```json|```/g, "").trim();
    dailyPlan = JSON.parse(text);
    lastBriefingTime = now;
    
    logger.success('🤖 COMMANDER: Plan Locked.', dailyPlan);
    db.addEvent('COMMANDER', `📜 Daily Strategy: ${dailyPlan.strategy}`);
    return dailyPlan;
  } catch (error) {
    logger.error('COMMANDER Failed:', error.message);
    return { strategy: "Maintain and reliability focus." }; // Fallback
  }
}

/**
 * 2. WORKER AGENT (Groq Llama 3)
 * Executes the plan by building specific stations.
 */
async function expandNetwork() {
  const now = Date.now();
  if (now - lastWorkerTime < WORKER_INTERVAL_MS) {
    return { success: false, error: 'Worker cooling down...' };
  }
  lastWorkerTime = now;

  // 1. Get Strategy
  const plan = await getDailyBriefing();
  
  // 2. Execute Step
  logger.info('🐅 WORKER (Groq): Executing build task...', plan);
  
  const stations = db.getStations();
  const lastStation = stations[stations.length - 1];
  
  const prompt = `
    Role: Railway Engineer (Worker)
    Strategy: "${plan.strategy}"
    Last Station: ${lastStation.name} (${lastStation.x}, ${lastStation.y})
    Canvas: 800x600 px.
    
    Task: Create 1 new station connected to the last one.
    Constraint: Keep Y between 50 and 550. X must be > lastStation.x + 200. Distance ~300-500px.
    
    Return JSON ONLY:
    { "name": "Station Name", "x": 123, "y": 456, "reason": "Tactical reason" }
  `;

  try {
    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.3-70b-versatile", // Updated from decommissioned llama3-70b-8192
      temperature: 0.7,
      response_format: { type: "json_object" }
    });

    const content = completion.choices[0].message.content;
    const proposal = JSON.parse(content);
    
    // Safety Check: Append Only (Logic handled by DB insert, ID is auto-increment)
    const newId = db.addStation(proposal.name, proposal.x, proposal.y);
    
    logger.success('🐅 WORKER: Build Complete.', proposal);
    db.addEvent('AI_WORKER', `🔨 Built ${proposal.name}. ${proposal.reason}`);
    
    return { success: true, stationId: newId, ...proposal };

  } catch (error) {
    logger.error('WORKER Failed:', error.message);
    // EXPOSE ERROR TO UI FOR DEBUGGING
    db.addEvent('SYSTEM', `⚠️ Worker Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Fallback Removed per User Request ("REMOVE OFFILINE WORKERS")

module.exports = { expandNetwork };
