import Groq from 'groq-sdk';

const VISION_PROMPT = `Describe this scene for a blind person in 2-3 sentences.
Focus on spatial layout and obstacles. Use directional language (left, right, ahead).
Prioritize safety-relevant information.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GROQ_API_KEY not configured' });
  }

  try {
    const { image } = req.body;
    if (!image) return res.status(400).json({ error: 'No image provided' });

    const groq = new Groq({ apiKey });
    
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

    const description = result.choices[0]?.message?.content || 'Could not analyze image';
    res.json({ description });
  } catch (err) {
    console.error('[Vision Error]', err.message);
    res.status(500).json({ error: 'Failed to analyze image', details: err.message });
  }
}
