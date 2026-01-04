import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3001;
const API_KEY = process.env.GEMINI_API_KEY;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

if (!API_KEY || API_KEY === 'your_key_here') {
  console.warn('\n⚠️  No Gemini API key found!');
  console.warn('   Get one at: https://aistudio.google.com/app/apikey');
  console.warn('   Add to .env: GEMINI_API_KEY=your_key\n');
}

const genAI = new GoogleGenerativeAI(API_KEY || 'MISSING');

const VISION_PROMPT = `Describe this scene for a blind person in 2-3 sentences.
Focus on spatial layout and obstacles. Use directional language (left, right, ahead).
Prioritize safety-relevant information.`;

const CHAT_PROMPT = `You are a helpful assistant for a blind person using smart glasses.
Be concise (1-3 sentences). Use spatial language. Say "I notice" instead of "I see".
You have access to the most recent scene description to answer follow-up questions.`;

// Analyze image
app.post('/api/analyze', async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) return res.status(400).json({ error: 'No image provided' });

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const base64 = image.replace(/^data:image\/\w+;base64,/, '');
    
    const result = await model.generateContent([
      VISION_PROMPT,
      { inlineData: { mimeType: 'image/jpeg', data: base64 } }
    ]);

    const description = result.response.text();
    console.log('[Vision]', description.slice(0, 80) + '...');
    res.json({ description });
  } catch (err) {
    console.error('[Vision Error]', err.message);
    if (err.message?.includes('API key')) {
      return res.status(500).json({ error: 'Invalid API key. Check your .env file.' });
    }
    res.status(500).json({ error: 'Failed to analyze image', details: err.message });
  }
});

// Chat response
app.post('/api/chat', async (req, res) => {
  try {
    const { message, sceneContext, conversationHistory = [] } = req.body;
    if (!message) return res.status(400).json({ error: 'No message provided' });

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    let prompt = CHAT_PROMPT;
    if (sceneContext) prompt += `\n\nScene: "${sceneContext}"`;
    else prompt += '\n\nNo scene captured yet.';
    
    if (conversationHistory.length) {
      prompt += '\n\nRecent:';
      conversationHistory.slice(-4).forEach(t => {
        prompt += `\n${t.role}: ${t.content}`;
      });
    }
    
    prompt += `\n\nUser: ${message}\nAssistant:`;
    
    const result = await model.generateContent(prompt);
    const response = result.response.text();
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
