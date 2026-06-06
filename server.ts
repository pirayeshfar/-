import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Lazy-initialized Gemini API client
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      console.warn("⚠️ Warning: GEMINI_API_KEY is not defined in the environment. AI Analysis requests will fail.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key || "dummy-key",
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// REST endpoint for AI Acoustic analysis
app.post("/api/analyze-acoustics", async (req, res) => {
  try {
    const { peakHz, avgHz, volumeDb, band, profile, description } = req.body;

    const systemPrompt = `You are an expert sound engineer and acoustician.
The user is running a real-time web audio analyzer that captures frequency data.
Your goal is to explain and identify this sound based on its frequency metrics:
- Peak frequency: ${peakHz} Hz
- Average frequency: ${avgHz} Hz
- Relative volume/amplitude: ${volumeDb} dB
- Acoustic Band: ${band} (e.g. Infrasound, Human Bass, Human Midrange, Human Highs, Ultrasound)
- Spectral Profile: ${profile} 

Please respond in a highly engaging, professional, bilingual format (in both English and Persian/Farsi):
1. First, provide a neat outline of potential real-world sources generating this specific signature (e.g., mosquito hum, bat vocalization, computer cooling fan, key rattling, human speech, subsonic mechanical truck, whistle, water faucet).
2. Explain the physical science/acoustics behind this frequency band (i.e. if standard speakers can reproduce it, if humans can hear it, its physical wavelength, or its propagation properties).
3. Keep the entire response elegant, clear, and highly scannable using markdown headings, bold terms, and neat bullet points. Ensure both English text and Persian translation are present block-by-block. Use Farsi as a primary or supplementary language in Farsi segments.`;

    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: systemPrompt,
    });

    const aiText = response.text || "Could not generate analysis.";
    res.json({ success: true, text: aiText });
  } catch (error: any) {
    console.error("AI Analysis Error:", error);
    res.status(500).json({ success: false, error: error.message || "Internal server error" });
  }
});

// Start listening and configure Vite
async function start() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in DEVELOPMENT mode with Vite middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in PRODUCTION mode...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running at http://localhost:${PORT}`);
  });
}

start();
