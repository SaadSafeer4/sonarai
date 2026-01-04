const SYSTEM_PROMPT = `You are a helpful assistant for a blind person using smart glasses.
Be concise (1-3 sentences). Use spatial language. Say "I notice" instead of "I see".
You have access to the most recent scene description to answer follow-up questions.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
  }

  try {
    const { message, sceneContext, conversationHistory = [] } = req.body;
    if (!message) return res.status(400).json({ error: 'No message provided' });

    let prompt = SYSTEM_PROMPT;
    if (sceneContext) prompt += `\n\nCurrent scene: "${sceneContext}"`;
    else prompt += '\n\nNo scene captured yet.';
    
    if (conversationHistory.length) {
      prompt += '\n\nRecent conversation:';
      conversationHistory.slice(-4).forEach(h => {
        prompt += `\n${h.role}: ${h.content}`;
      });
    }
    
    prompt += `\n\nUser: ${message}\nAssistant:`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );

    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message);
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Could not generate response';
    res.json({ response: text });
  } catch (err) {
    console.error('[Chat Error]', err.message);
    res.status(500).json({ error: 'Failed to generate response', details: err.message });
  }
}
