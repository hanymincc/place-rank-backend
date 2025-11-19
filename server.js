require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/place', require('./routes/place'));
app.use('/api/blog', require('./routes/blog'));
app.use('/api/shopping', require('./routes/shopping'));
app.use('/api/keyword', require('./routes/keyword'));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'place-rank-backend'
  });
});

// Root
app.get('/', (req, res) => {
  res.json({
    service: '마케팅장터 순위 조회 API',
    version: '1.0.0',
    endpoints: {
      place: {
        checkRank: 'POST /api/place/check-rank',
        checkRankOnce: 'POST /api/place/check-rank-once',
        mainKeyword: 'POST /api/place/main-keyword',
        compareRank: 'POST /api/place/compare-rank',
      },
      blog: {
        checkRank: 'POST /api/blog/check-rank',
        analyzeKeyword: 'POST /api/blog/analyze-keyword',
      },
      shopping: {
        checkRank: 'POST /api/shopping/check-rank',
        checkRankOnce: 'POST /api/shopping/check-rank-once',
      },
      keyword: {
        searchVolume: 'POST /api/keyword/search-volume',
        trend: 'POST /api/keyword/trend',
      }
    }
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    success: false, 
    message: '서버 오류가 발생했습니다.',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    message: '요청한 엔드포인트를 찾을 수 없습니다.' 
  });
});

app.listen(PORT, () => {
  console.log(`🚀 서버가 포트 ${PORT}에서 실행 중입니다.`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
});
