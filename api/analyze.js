const VISION_PROMPT = `Describe this scene for a blind person in 2-3 sentences.
Focus on spatial layout and obstacles. Use directional language (left, right, ahead).
Prioritize safety-relevant information.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
  }

  try {
    const { image } = req.body;
    if (!image) return res.status(400).json({ error: 'No image provided' });

    const base64 = image.replace(/^data:image\/\w+;base64,/, '');

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: VISION_PROMPT },
              { inline_data: { mime_type: 'image/jpeg', data: base64 } }
            ]
          }]
        })
      }
    );

    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message);
    }

    const description = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Could not analyze image';
    res.json({ description });
  } catch (err) {
    console.error('[Vision Error]', err.message);
    res.status(500).json({ error: 'Failed to analyze image', details: err.message });
  }
}
