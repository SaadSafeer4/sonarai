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

    // Extract base64 data
    const base64 = image.replace(/^data:image\/\w+;base64,/, '');

    // Use BLIP for image captioning (simpler, more reliable)
    const response = await fetch(
      'https://api-inference.huggingface.co/models/Salesforce/blip-image-captioning-large',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        body: Buffer.from(base64, 'base64')
      }
    );

    const data = await response.json();
    
    if (data.error) {
      throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
    }

    const caption = data[0]?.generated_text || 'a scene';
    const description = `I notice ${caption}. Ask me follow-up questions about what you'd like to know.`;
    
    res.json({ description });
  } catch (err) {
    console.error('[Vision Error]', err.message);
    res.status(500).json({ error: 'Failed to analyze image', details: err.message });
  }
}
