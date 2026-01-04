export default function handler(req, res) {
  const groq = process.env.GROQ_API_KEY;
  const together = process.env.TOGETHER_API_KEY;
  res.json({ 
    groq: groq ? `${groq.substring(0, 8)}... (${groq.length} chars)` : 'NOT SET',
    together: together ? `${together.substring(0, 8)}... (${together.length} chars)` : 'NOT SET'
  });
}

