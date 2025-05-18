import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const OPENAI_KEY = process.env.OPENAI_KEY;

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

app.post('/generate-text', async (req, res) => {
  const { topic, language } = req.body;
  const prompt = `Generate a headline and subheadline for topic "${topic}" in ${language}.
Return in the format:
Headline: ...
Subheadline: ...`;

  try {
    const result = await callOpenAI(prompt);
    const lines = result.split('\n').map(l => l.trim());
    const headline = lines.find(l => l.toLowerCase().startsWith('headline:'))?.split(':').slice(1).join(':').trim();
    const subheadline = lines.find(l => l.toLowerCase().startsWith('subheadline:'))?.split(':').slice(1).join(':').trim();
    res.json({ headline, subheadline });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/rewrite-text', async (req, res) => {
  const { original, instruction } = req.body;
  const prompt = `Rewrite this text: "${original}". Instruction: ${instruction}`;

  try {
    const result = await callOpenAI(prompt);
    res.json({ text: result.trim() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/', (_, res) => {
  res.send('Figma Textgen backend is running.');
});

app.listen(PORT, () => console.log(`Server on http://localhost:${PORT}`));
