export default function handler(req, res) {
  const key = process.env.GEMINI_API_KEY;
  res.json({ 
    hasKey: !!key,
    keyLength: key ? key.length : 0,
    keyPrefix: key ? key.substring(0, 8) + '...' : 'none'
  });
}

