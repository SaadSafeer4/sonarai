const SYSTEM_PROMPT = `You are a helpful assistant for a blind person. Be concise (1-3 sentences). Use spatial language.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.HF_TOKEN;
  if (!apiKey) {
    return res.status(500).json({ error: 'HF_TOKEN not configured' });
  }

  try {
    const { message, sceneContext } = req.body;
    if (!message) return res.status(400).json({ error: 'No message provided' });

    let prompt = SYSTEM_PROMPT;
    if (sceneContext) prompt += `\n\nScene: ${sceneContext}`;
    prompt += `\n\nUser: ${message}\nAssistant:`;

    const response = await fetch(
      'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: { max_new_tokens: 150, return_full_text: false }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText);
    }

    const data = await response.json();
    const text = data[0]?.generated_text || 'I can help you. What would you like to know?';
    
    res.json({ response: text.trim() });
  } catch (err) {
    console.error('[Chat Error]', err.message);
    res.status(500).json({ error: 'Failed to generate response', details: err.message });
  }
}
