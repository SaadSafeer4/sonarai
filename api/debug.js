export default function handler(req, res) {
  const gemini = process.env.GEMINI_API_KEY;
  res.json({ 
    gemini: gemini ? `${gemini.substring(0, 8)}... (${gemini.length} chars)` : 'NOT SET'
  });
}

