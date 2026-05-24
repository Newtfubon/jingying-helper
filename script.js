export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama3-8b-8192',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: `你是保險業務話術教練。用繁體中文產生一個「今日話術練習」：
① 一個客戶拒絕情境（1句）
② 最佳應對話術（3句，口語自然，像真人在說話）
③ 這個話術的心理技巧（1句）
不要學術語言，不要AI腔。`
        }]
      })
    });

    const data = await groqRes.json();
    const text = data.choices?.[0]?.message?.content || '無法產生，請稍後再試。';
    res.status(200).json({ ok: true, text });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
