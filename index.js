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
  const { prompt, topic, language } = req.body;

  try {
    const result = await callOpenAI(prompt);
    console.log('OpenAI raw result:', result);
    // Try to parse the response as JSON
    try {
      const jsonResult = JSON.parse(result);
      res.json(jsonResult);
    } catch (parseError) {
      // Try to extract JSON from the response using regex
      const match = result.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          const jsonResult = JSON.parse(match[0]);
          res.json(jsonResult);
          return;
        } catch (e) {}
      }
      // If parsing fails, try to extract the text in the old format
      const lines = result.split('\n').map(l => l.trim());
      const headline = lines.find(l => l.toLowerCase().startsWith('headline:'))?.split(':').slice(1).join(':').trim();
      const subheadline = lines.find(l => l.toLowerCase().startsWith('subheadline:'))?.split(':').slice(1).join(':').trim();
      const button = lines.find(l => l.toLowerCase().startsWith('button:'))?.split(':').slice(1).join(':').trim();
      
      // If we have a frameName in the request, return in the old format
      if (req.body.frameName) {
        res.json({ headline, subheadline, button });
      } else {
        // Otherwise, wrap in the new format
        res.json({
          frames: [{
            name: req.body.frameName || "unknown",
            headline,
            subheadline,
            button
          }]
        });
      }
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/rewrite-text', async (req, res) => {
  const { prompt, topic, language } = req.body;

  try {
    const result = await callOpenAI(prompt);
    
    // Try to parse the response as JSON
    try {
      const jsonResult = JSON.parse(result);
      res.json(jsonResult);
    } catch (parseError) {
      // If parsing fails, return the text directly
      const text = result.trim().replace(/^['"“""]+|['""""]+$/g, '');
      res.json({ text });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
