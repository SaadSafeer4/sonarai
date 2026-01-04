import { GoogleGenerativeAI } from '@google/generative-ai';

const VISION_PROMPT = `Describe this scene for a blind person in 2-3 sentences.
Focus on spatial layout and obstacles. Use directional language (left, right, ahead).
Prioritize safety-relevant information.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const { image } = req.body;
    if (!image) return res.status(400).json({ error: 'No image provided' });

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
    const base64 = image.replace(/^data:image\/\w+;base64,/, '');
    
    const result = await model.generateContent([
      VISION_PROMPT,
      { inlineData: { mimeType: 'image/jpeg', data: base64 } }
    ]);

    const description = result.response.text();
    res.json({ description });
  } catch (err) {
    console.error('[Vision Error]', err.message);
    if (err.message?.includes('API key')) {
      return res.status(500).json({ error: 'Invalid API key' });
    }
    res.status(500).json({ error: 'Failed to analyze image', details: err.message });
  }
}

