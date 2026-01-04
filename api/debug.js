export default function handler(req, res) {
  const key = process.env.HF_TOKEN;
  res.json({ 
    hf_token: key ? `${key.substring(0, 8)}... (${key.length} chars)` : 'NOT SET'
  });
}

