# 🚀 Deploying AI Railway Sim to Render

This guide will help you deploy the **Dual-Agent Railway Simulation** to the live web using Render.

## Prerequisites

1.  **GitHub Account**: You need to push this code to a GitHub repository.
2.  **Render Account**: Sign up at [render.com](https://render.com).
3.  **API Keys**:
    - `GEMINI_API_KEY` (from Google AI Studio)
    - `GROQ_API_KEY` (from Groq Cloud)

---

## Step 1: Push Code to GitHub

If you haven't already, initialize a git repository and push this project:

```bash
git init
git add .
git commit -m "Initial commit of AI Railway Sim"
git branch -M main
git remote add origin https://github.com/gaurawsinghbusiness-sys/AiRail.git
git push -u origin main
```

_(Replace `YOUR_USERNAME` with your actual GitHub username and create the repo first)_

---

## Step 2: Create New Blueprint on Render

1.  Log in to your **Render Dashboard**.
2.  Click the **"New +"** button and select **"Blueprint"**.
3.  Connect your GitHub account if prompted.
4.  Select the `ai-railway-sim` repository you just pushed.
5.  Render will automatically detect the `render.yaml` file in the root directory.

---

## Step 3: Configure Environment Variables

Render will show a configuration screen based on the blueprint. It will ask for the following **Environment Variables**:

1.  **`GEMINI_API_KEY`**: Paste your Google Gemini API Key here.
2.  **`GROQ_API_KEY`**: Paste your Groq API Key here.

> **⚠️ CRITICAL**: Without these keys, the "Autonomous" mode will fall back to random math logic instead of real AI intelligence.

---

## Step 4: Deploy

1.  Click **"Apply"** or **"Create Service"**.
2.  Render will start building your application.
3.  Watch the logs! You'll see `npm install` and then `npm start`.
4.  Once live, Render will provide a URL (e.g., `https://ai-railway-sim-xxxx.onrender.com`).

---

## 🔍 Verifying the Deployment

1.  Open the live URL.
2.  Click **"🤖 AUTO: OFF"** to toggle it **ON**.
3.  Watch the **Comms Feed**. You should see logs like:
    - `🤖 COMMANDER (Gemini): Briefing Generated...`
    - `🐅 WORKER (Groq): Building Station...`
4.  If you see "Fallback deployment", check your API Keys in the Render Dashboard under **"Environment"**.

## 💾 A Note on Data Persistence

Since this deployment uses the **Free Tier** by default, the database (`simulation.db`) is **ephemeral**.

- **Meaning**: If the server restarts (which happens on every new deployment), the map will **RESET** to the initial 2 stations.
- **Solution**: For a hackathon demo, this is usually fine (starts fresh for judges). If you need long-term persistence, upgrade to a paid plan and add a **Disk** to the service.

**Good luck with the Hackathon! 🚀**
