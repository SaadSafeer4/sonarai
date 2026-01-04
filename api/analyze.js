const VISION_PROMPT = `Describe this scene for a blind person in 2-3 sentences. Focus on spatial layout and obstacles. Use directional language (left, right, ahead).`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.HF_TOKEN;
  if (!apiKey) {
    return res.status(500).json({ error: 'HF_TOKEN not configured' });
  }

  try {
    const { image } = req.body;
    if (!image) return res.status(400).json({ error: 'No image provided' });

    // Use Hugging Face's free inference API with LLaVA
    const response = await fetch(
      'https://router.huggingface.co/hf-inference/models/llava-hf/llava-1.5-7b-hf',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs: {
            image: image,
            text: VISION_PROMPT
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText);
    }

    const data = await response.json();
    const description = data[0]?.generated_text || data.generated_text || 'I can see your surroundings. Ask me what you want to know.';
    
    res.json({ description });
  } catch (err) {
    console.error('[Vision Error]', err.message);
    res.status(500).json({ error: 'Failed to analyze image', details: err.message });
  }
}
