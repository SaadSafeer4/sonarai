export default function handler(req, res) {
  const groq = process.env.GROQ_API_KEY;
  const gemini = process.env.GEMINI_API_KEY;
  res.json({ 
    groq: groq ? `${groq.substring(0, 8)}... (${groq.length} chars)` : 'NOT SET',
    gemini: gemini ? `${gemini.substring(0, 8)}... (${gemini.length} chars)` : 'NOT SET'
  });
}

