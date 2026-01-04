import Groq from 'groq-sdk';

const SYSTEM_PROMPT = `You are a helpful assistant for a blind person using smart glasses.
Be concise (1-3 sentences). Use spatial language. Say "I notice" instead of "I see".
You have access to the most recent scene description to answer follow-up questions.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GROQ_API_KEY not configured' });
  }

  try {
    const { message, sceneContext, conversationHistory = [] } = req.body;
    if (!message) return res.status(400).json({ error: 'No message provided' });

    const groq = new Groq({ apiKey });
    
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

    const response = result.choices[0]?.message?.content || 'Could not generate response';
    res.json({ response });
  } catch (err) {
    console.error('[Chat Error]', err.message);
    res.status(500).json({ error: 'Failed to generate response', details: err.message });
  }
}
