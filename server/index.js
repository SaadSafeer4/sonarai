import express from 'express';
import cors from 'cors';
import Groq from 'groq-sdk';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3001;
const API_KEY = process.env.GROQ_API_KEY;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

if (!API_KEY) {
  console.warn('\n⚠️  No Groq API key found!');
  console.warn('   Get one at: https://console.groq.com/keys');
  console.warn('   Add to .env: GROQ_API_KEY=your_key\n');
}

const groq = new Groq({ apiKey: API_KEY || 'MISSING' });

const VISION_PROMPT = `Describe this scene for a blind person in 2-3 sentences.
Focus on spatial layout and obstacles. Use directional language (left, right, ahead).
Prioritize safety-relevant information.`;

const SYSTEM_PROMPT = `You are a helpful assistant for a blind person using smart glasses.
Be concise (1-3 sentences). Use spatial language. Say "I notice" instead of "I see".
You have access to the most recent scene description to answer follow-up questions.`;

app.post('/api/analyze', async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) return res.status(400).json({ error: 'No image provided' });

    const result = await groq.chat.completions.create({
      model: 'llama-3.2-90b-vision-preview',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: VISION_PROMPT },
            { type: 'image_url', image_url: { url: image } }
          ]
        }
      ],
      max_tokens: 300
    });

    const description = result.choices[0]?.message?.content || 'Could not analyze';
    console.log('[Vision]', description.slice(0, 80) + '...');
    res.json({ description });
  } catch (err) {
    console.error('[Vision Error]', err.message);
    res.status(500).json({ error: 'Failed to analyze image', details: err.message });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message, sceneContext, conversationHistory = [] } = req.body;
    if (!message) return res.status(400).json({ error: 'No message provided' });

    let systemContent = SYSTEM_PROMPT;
    if (sceneContext) systemContent += `\n\nCurrent scene: "${sceneContext}"`;
    else systemContent += '\n\nNo scene captured yet.';

    const messages = [
      { role: 'system', content: systemContent },
      ...conversationHistory.slice(-4).map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: message }
    ];

    const result = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages,
      max_tokens: 200
    });

    const response = result.choices[0]?.message?.content || 'Could not respond';
    console.log('[Chat]', response.slice(0, 80) + '...');
    res.json({ response });
  } catch (err) {
    console.error('[Chat Error]', err.message);
    res.status(500).json({ error: 'Failed to generate response', details: err.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`\n🎯 SonarAI server running on http://localhost:${PORT}\n`);
});
