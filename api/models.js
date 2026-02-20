export default async function handler(req, res) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'No API key' });
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );
    const data = await response.json();
    
    const models = data.models?.map(m => m.name) || [];
    res.json({ models });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

