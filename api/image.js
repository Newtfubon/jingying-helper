export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { prompt, seed } = req.query;
  if (!prompt) return res.status(400).json({ error: 'no prompt' });

  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=800&height=500&seed=${seed || 42}&nologo=true&model=flux`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 28000);
    
    const imgRes = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NewsBot/1.0)' },
      signal: controller.signal
    });
    clearTimeout(timer);

    if (!imgRes.ok) throw new Error('pollinations status: ' + imgRes.status);

    const buffer = await imgRes.arrayBuffer();
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(Buffer.from(buffer));
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
