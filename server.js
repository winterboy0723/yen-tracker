const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

// MIME 타입 매핑
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// 캐시 변수
let cachedDetail = null;
let lastDetailFetch = 0;
let cachedHistory = null;
let lastHistoryFetch = 0;

// 네이버 금융 API 호출 헬퍼
function fetchNaverJson(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://m.stock.naver.com/'
      }
    };

    https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', err => reject(err));
  });
}

const server = http.createServer(async (req, res) => {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const reqUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = reqUrl.pathname;

  // 1. 네이버 실시간 엔화 고시 환율 API
  if (pathname === '/api/jpy/detail') {
    const now = Date.now();
    if (cachedDetail && (now - lastDetailFetch < 30000)) {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(cachedDetail));
      return;
    }

    try {
      const data = await fetchNaverJson('https://m.stock.naver.com/front-api/marketIndex/productDetail?category=exchange&reutersCode=FX_JPYKRW');
      cachedDetail = data;
      lastDetailFetch = now;
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(data));
    } catch (err) {
      console.error('네이버 실시간 환율 조회 실패:', err.message);
      // 캐시가 있으면 만료되었더라도 반환
      if (cachedDetail) {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(cachedDetail));
      } else {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: '환율 정보를 불러오지 못했습니다.', details: err.message }));
      }
    }
    return;
  }

  // 2. 네이버 엔화 최근 과거 시세 히스토리 API
  if (pathname === '/api/jpy/history') {
    const now = Date.now();
    if (cachedHistory && (now - lastHistoryFetch < 300000)) {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(cachedHistory));
      return;
    }

    try {
      const data = await fetchNaverJson('https://m.stock.naver.com/front-api/marketIndex/prices?category=exchange&reutersCode=FX_JPYKRW&page=1&pageSize=60');
      cachedHistory = data;
      lastHistoryFetch = now;
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(data));
    } catch (err) {
      console.error('네이버 시세 히스토리 조회 실패:', err.message);
      if (cachedHistory) {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(cachedHistory));
      } else {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: '히스토리 정보를 불러오지 못했습니다.', details: err.message }));
      }
    }
    return;
  }

  // 3. 정적 파일 서빙
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
  
  // 보안: 디렉터리 탐색 방지
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('페이지를 찾을 수 없습니다.');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('서버 오류가 발생했습니다.');
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

server.listen(PORT, () => {
  console.log(`[엔화 변동 추적기] 로컬 서버가 포트 ${PORT}에서 실행 중입니다.`);
  console.log(`브라우저 접속 주소: http://localhost:${PORT}`);
});
