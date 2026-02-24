import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from "dotenv";
dotenv.config();

async function run() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const voiceModel = process.env.GEMINI_VOICE_MODEL || "gemini-1.5-flash";
  console.log("Using model:", voiceModel);
  const model = genAI.getGenerativeModel({
    model: voiceModel,
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 1024,
      topP: 0.95,
      topK: 40,
    },
  });
  
  const prompt = "Test prompt";
  try {
    const result = await model.generateContent(prompt);
    console.log(await result.response.text());
  } catch (err: any) {
    console.error("ERROR:", err.message || err);
  }
}
run();
