# 🚂 AiRail

**Autonomous Dual-Agent Railway Simulation**

> A collaborative AI simulation where Gemini (Commander) and Llama (Worker) build a persistent, branching railway network on an infinite canvas.

---

## 🚀 The Vision

AiRail explores the frontier of **Multi-Agent Collaboration**. It features a unique dual-agent architecture where two distinct LLMs handle separate layers of a project's lifecycle:

- **Strategic Planning (Google Gemini 3 Flash)**: Acts as the _Commander_. It analyzes the current state of the global map, identifies growth bottlenecks, and issues high-level strategic directives.
- **Tactical Execution (Meta Llama 3.3 via Groq)**: Acts as the _Lead Engineer_. It interprets the Commander's strategic plan and executes pixel-perfect construction, determining precise coordinates for new stations and laying branching tracks.

## ✨ Key Features

- **🤖 Autonomous Growth**: The network expands on its own every 2 hours, driven entirely by AI strategy.
- **♾️ Infinite Zoom Engine**: A custom high-performance rendering engine that supports zooming from 0.1x to 5.0x with CSS3 hardware acceleration.
- **🚦 Realistic Graph Operations**: Supports complex branching junctions, station-to-station track signaling, and real-time train occupancy logic.
- **👁️ VIP Ride Mode**: Click **"RIDE"** on any train to lock the camera and experience the network from the rolling stock's perspective.
- **🌑 Dynamic Environment**: Features a real-time UTC clock with a responsive UI that adapts to simulation events.

## 🛠️ Tech Stack

- **AI**: Gemini 3 Flash (Strategy) & Llama 3.3 (Execution via Groq SDK).
- **Backend**: Node.js & Express.
- **Frontend**: Vanilla JavaScript + SVG + HTML5 Canvas.
- **Database**: SQLite (managed via `sql.js`).
- **Styles**: Custom B&W High-Contrast Design System.

## 🏃 Quick Start

1. **Clone the repo.**
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Set Environment Variables**:
   Create a `.env` file with:
   ```env
   GEMINI_API_KEY=your_key
   GROQ_API_KEY=your_key
   ```
4. **Launch**:
   ```bash
   npm start
   ```
   Open `http://localhost:3000` to watch the simulation.

---

_Created for the Google DeepMind Devpost Hackathon._
