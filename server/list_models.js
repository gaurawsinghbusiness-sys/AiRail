require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function listModels() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Dummy init
    // Actually, we need to use the model manager if available, or just try to generate with a fallback
    // But the SDK doesn't always have a clean 'listModels' on the main client in older versions.
    // Let's try to infer from the error message of a bad model, or just try the requested model.
    
    console.log("Checking specific models...");
    
    const candidates = [
      "gemini-2.0-flash-exp",
      "gemini-2.0-flash",
      "gemini-1.5-flash",
      "gemini-1.5-pro",
      "gemini-3.0-flash", // User request
    ];

    for (const m of candidates) {
      process.stdout.write(`Testing ${m}... `);
      try {
        const model = genAI.getGenerativeModel({ model: m });
        const result = await model.generateContent("Test");
        console.log("✅ AVAILABLE");
      } catch (err) {
        if (err.message.includes("404")) {
          console.log("❌ 404 NOT FOUND");
        } else {
          console.log(`❌ ERROR: ${err.message.split(' ')[0]}...`);
        }
      }
    }

  } catch (err) {
    console.error(err);
  }
}

listModels();
