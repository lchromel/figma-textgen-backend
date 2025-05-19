import express from 'express';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import cors from 'cors';

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const OPENAI_KEY = process.env.OPENAI_KEY;
const PORT = process.env.PORT || 3000;

// Загружаем конфиги
const limits = JSON.parse(fs.readFileSync(path.join(__dirname, 'limits.json'), 'utf8'));
const tone = JSON.parse(fs.readFileSync(path.join(__dirname, 'tone.json'), 'utf8'));

const callOpenAI = async (prompt) => {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }]
    })
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
};

app.get('/limits', (_, res) => res.json(limits));
app.get('/tone', (_, res) => res.json(tone));

// Batch генерация
app.post('/generate-batch', async (req, res) => {
  const { topic, language, frames } = req.body;

  const instructions = frames.map((f, i) => {
    const lim = limits[f.name] || {};
    return `${i + 1}. ${f.name}
Headline (max ${lim.headline || 30})
${lim.subheadline ? `Subheadline (max ${lim.subheadline})` : ''}
${lim.button ? `Button (max ${lim.button})` : ''}`.trim();
  }).join("\n\n");

  const prompt = [
    "You are a creative copywriter.",
    "Generate texts for the following UI blocks:",
    instructions,
    "",
    `Topic: ${topic}`,
    `Language: ${language}`,
    `Tone of voice: ${tone.voice}`,
    "",
    "Rules:",
    "- Do not use quotation marks",
    "- Do not mention layout or frame names literally",
    "- For Push: you may use emojis like 🔥🎯✨🛍️",
    "- Return each block in format:",
    "FrameName",
    "Headline: ...",
    "Subheadline: ...",
    "Button: ..."
  ].join("\n");

  try {
    const raw = await callOpenAI(prompt);
    const lines = raw.split("\n");
    const result = {};
    let current = null;
    for (let line of lines) {
      if (limits[line.trim()]) {
        current = line.trim();
        result[current] = {};
      } else if (current) {
        if (/^headline:/i.test(line)) result[current].headline = line.split(":").slice(1).join(":").trim().replace(/^["“”']+|["“”']+$/g, '');
        if (/^subheadline:/i.test(line)) result[current].subheadline = line.split(":").slice(1).join(":").trim().replace(/^["“”']+|["“”']+$/g, '');
        if (/^button:/i.test(line)) result[current].button = line.split(":").slice(1).join(":").trim().replace(/^["“”']+|["“”']+$/g, '');
      }
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Rewrite endpoint
app.post('/rewrite-text', async (req, res) => {
  const { instruction, original, frameName } = req.body;
  const lim = limits[frameName] || {};
  const emojiLine = frameName.toLowerCase().includes("push") ? "Include emojis if appropriate (🔥🎯✨🛍️)." : "";

  const prompt = [
    "You are rewriting a short UI text.",
    `Instruction: ${instruction}`,
    `Original: ${original}`,
    "",
    "Guidelines:",
    `- Max length: ${lim.headline || 30}`,
    `- Tone: ${tone.voice}`,
    "- Do NOT use quotation marks",
    "- Do NOT mention layout names",
    emojiLine,
    "",
    "Respond only with the new version, no framing or extra notes."
  ].join("\n");

  try {
    const response = await callOpenAI(prompt);
    const clean = response.trim().replace(/^['"“”]+|['"“”]+$/g, '');
    res.json({ text: clean });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`✅ Backend running on http://localhost:${PORT}`));
