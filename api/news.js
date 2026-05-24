export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { theme, query } = req.query;

  try {
    // 1. 抓 Google News RSS（後端直接抓，無 CORS 問題）
    // 加上7天內篩選
    const after = new Date();
    after.setDate(after.getDate() - 7);
    const afterStr = after.toISOString().split('T')[0];
    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}+after:${afterStr}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant`;
    const rssRes = await fetch(rssUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NewsBot/1.0)' }
    });
    const rssText = await rssRes.text();

    // 2. 解析 RSS XML
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let m;
    while ((m = itemRegex.exec(rssText)) !== null && items.length < 5) {
      const block = m[1];
      const titleM  = /<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/.exec(block);
      const linkM   = /<link>(.*?)<\/link>/.exec(block);
      const dateM   = /<pubDate>(.*?)<\/pubDate>/.exec(block);
      const sourceM = /<source[^>]*>(.*?)<\/source>/.exec(block);
      const title   = (titleM?.[1] || titleM?.[2] || '').replace(/\s*-\s*[^-]+$/, '').trim();
      if (title) items.push({
        title,
        link:   linkM?.[1]?.trim() || '',
        date:   dateM?.[1]?.trim() || '',
        source: sourceM?.[1]?.trim() || 'Google 新聞'
      });
    }

    if (!items.length) throw new Error('no news items from RSS');

    const top2 = items.slice(0, 2);

    // 3. 用 Groq 產生摘要（免費）
    const titles = top2.map((a, i) => `${i + 1}. ${a.title}`).join('\n');
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama3-8b-8192',
        max_tokens: 600,
        messages: [{
          role: 'user',
          content: `以下是今天「${theme}」主題的新聞標題：
${titles}

請為每則新聞產生：
- summary：2句話，口語自然，像在跟朋友說這件事，不超過60字
- closing：1句輕鬆收尾，像朋友順手分享那種語氣，不提保險產品名稱，不超過30字

只回傳 JSON array，不要其他文字：
[{"summary":"...","closing":"..."},{"summary":"...","closing":"..."}]`
        }]
      })
    });

    const groqData = await groqRes.json();
    let enriched = [];
    try {
      const raw = groqData.choices?.[0]?.message?.content || '';
      const s = raw.indexOf('['), e = raw.lastIndexOf(']');
      if (s !== -1 && e !== -1) enriched = JSON.parse(raw.slice(s, e + 1));
    } catch (_) {}

    // 4. 組合結果
    const articles = top2.map((a, i) => {
      const d = a.date ? new Date(a.date) : new Date();
      return {
        headline: a.title,
        source:   a.source,
        date:     `${d.getMonth() + 1}月${d.getDate()}日`,
        url:      a.link,
        summary:  enriched[i]?.summary || '',
        closing:  enriched[i]?.closing || ''
      };
    });

    res.status(200).json({ ok: true, articles });

  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
