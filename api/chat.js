import { GoogleGenerativeAI } from '@google/generative-ai';

const CHAT_PROMPT = `You are a helpful assistant for a blind person using smart glasses.
Be concise (1-3 sentences). Use spatial language. Say "I notice" instead of "I see".
You have access to the most recent scene description to answer follow-up questions.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const { message, sceneContext, conversationHistory = [] } = req.body;
    if (!message) return res.status(400).json({ error: 'No message provided' });

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    
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
    res.json({ response });
  } catch (err) {
    console.error('[Chat Error]', err.message);
    res.status(500).json({ error: 'Failed to generate response', details: err.message });
  }
}

