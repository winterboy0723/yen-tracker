module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    const response = await fetch('https://m.stock.naver.com/front-api/marketIndex/prices?category=exchange&reutersCode=FX_JPYKRW&page=1&pageSize=60', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://m.stock.naver.com/'
      }
    });
    const data = await response.json();
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: '네이버 시세 히스토리 조회 실패', details: err.message });
  }
};
