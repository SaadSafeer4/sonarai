export default function handler(req, res) {
  const key = process.env.OPENAI_API_KEY;
  res.json({ 
    openai: key ? `${key.substring(0, 8)}... (${key.length} chars)` : 'NOT SET'
  });
}

