export default function handler(req, res) {
  const key = process.env.OPENROUTER_API_KEY;
  res.json({ 
    openrouter: key ? `${key.substring(0, 8)}... (${key.length} chars)` : 'NOT SET'
  });
}

