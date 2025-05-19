import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());
app.use(express.json());

const limits = JSON.parse(fs.readFileSync(path.join(__dirname, "limits.json"), "utf8"));
const tone = JSON.parse(fs.readFileSync(path.join(__dirname, "tone.json"), "utf8"));

app.get("/limits", (req, res) => res.json(limits));
app.get("/tone", (req, res) => res.json(tone));

app.post("/generate-text", async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;
  const { prompt } = req.body;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7
      })
    });

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content?.trim() || "";
    res.json({ text });
  } catch (e) {
    res.status(500).json({ error: "OpenAI request failed" });
  }
});


app.post('/generate-batch-text', async (req, res) => {
  const { topic, language, frames } = req.body;
  const tone = toneJson.voice || "Friendly and helpful";

  let prompt = `You are a helpful creative assistant. Based on the topic "${topic}", language "${language}", and tone "${tone}", generate text blocks for the following frames. Respect character limits. Respond only with clean structured output.` + "\n\n";

  frames.forEach((frame, index) => {
    prompt += `Frame ${index + 1}: ${frame.name}\n`;
    prompt += `Headline (max ${frame.limits.headline || 30} chars)\n`;
    if (frame.limits.subheadline) {
      prompt += `Subheadline (max ${frame.limits.subheadline} chars)\n`;
    }
    if (frame.limits.button) {
      prompt += `Button (max ${frame.limits.button} chars)\n`;
    }
    prompt += "\n";
  });

  const output = await callOpenAI(prompt);
  res.send({ result: output });
});


app.listen(PORT, () => console.log("Backend running on port " + PORT));