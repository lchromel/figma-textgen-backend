import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
const app = express();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

const PORT = process.env.PORT || 3000;
const OPENAI_KEY = process.env.OPENAI_KEY;

const limitsJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'limits.json'), 'utf8'));
const toneJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'tone.json'), 'utf8'));

const callOpenAI = async (prompt) => {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
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

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  return content;
};

app.get("/limits", (req, res) => {
  res.json(limitsJson);
});

app.get("/tone", (req, res) => {
  res.json(toneJson);
});

app.post('/generate-text', async (req, res) => {
  const { topic, language, frameName } = req.body;
  const limit = limitsJson[frameName] || {};
  const tone = toneJson.voice || "Friendly and helpful";

  const prompt = `
Generate a Headline${limit.subheadline ? " and Subheadline" : ""}${limit.button ? " and Button" : ""} for "${frameName}".
Topic: "${topic}"
Language: ${language}
Tone of voice: ${tone}
Limit Headline to ${limit.headline || 30} characters.
${limit.subheadline ? `Limit Subheadline to ${limit.subheadline} characters.` : ''}
${limit.button ? `Limit Button to ${limit.button} characters.` : ''}
Respond only with:
Headline: ...
${limit.subheadline ? 'Subheadline: ...' : ''}
${limit.button ? 'Button: ...' : ''}
`.trim();

  try {
    const result = await callOpenAI(prompt);
    const lines = result.split('\n').map(l => l.trim());
    const headline = lines.find(l => l.toLowerCase().startsWith('headline:'))?.split(':').slice(1).join(':').trim();
    const subheadline = lines.find(l => l.toLowerCase().startsWith('subheadline:'))?.split(':').slice(1).join(':').trim();
    const button = lines.find(l => l.toLowerCase().startsWith('button:'))?.split(':').slice(1).join(':').trim();
    res.json({ headline, subheadline, button });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});



app.post('/rewrite-text', async (req, res) => {
  const { instruction, original = "", frameName = "" } = req.body;

  const useEmojis = frameName.toLowerCase().includes("push");
  const emojiLine = useEmojis ? "Add emojis if appropriate (🔥🎯✨🛍️)." : "";

  const prompt = \`
You are rewriting a short marketing text.

Instruction: \${instruction}
Original: \${original}

Rules:
- Make it short and engaging
- Do NOT use quotation marks
- Do NOT mention frame or layout names
\${emojiLine}

Respond only with the new version of the text.
\`.trim();

  try {
    const response = await callOpenAI(prompt);
    const newText = response.trim().replace(/^["']|["']$/g, '');
    res.json({ text: newText });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
