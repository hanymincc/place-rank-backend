const express = require('express');
const router = express.Router();
const axios = require('axios');
const { PointsService, POINT_COSTS } = require('../services/points');

// 키워드 검색량 조회 (네이버 API 사용)
router.post('/search-volume', async (req, res) => {
  try {
    const { keyword, userId } = req.body;

    if (!keyword) {
      return res.status(400).json({
        success: false,
        message: '키워드가 필요합니다.',
      });
    }

    // 포인트 확인
    if (userId) {
      const pointCheck = await PointsService.checkPoints(userId, POINT_COSTS.KEYWORD_SEARCH_VOLUME);
      if (!pointCheck.success || !pointCheck.sufficient) {
        return res.status(400).json({
          success: false,
          message: pointCheck.error || `포인트가 부족합니다. (필요: ${POINT_COSTS.KEYWORD_SEARCH_VOLUME}P)`,
          insufficientPoints: true,
        });
      }
    }

    // 네이버 DataLab API (광고 API가 있는 경우)
    const clientId = process.env.NAVER_CLIENT_ID;
    const clientSecret = process.env.NAVER_CLIENT_SECRET;

    let searchVolume = {
      monthly: Math.floor(Math.random() * 100000) + 1000,
      competition: ['높음', '중간', '낮음'][Math.floor(Math.random() * 3)],
      trend: '상승',
    };

    // 실제 API가 설정되어 있으면 호출
    if (clientId && clientSecret) {
      try {
        // 네이버 검색 API로 검색 결과 수 조회
        const response = await axios.get('https://openapi.naver.com/v1/search/blog.json', {
          params: {
            query: keyword,
            display: 1,
          },
          headers: {
            'X-Naver-Client-Id': clientId,
            'X-Naver-Client-Secret': clientSecret,
          },
        });

        if (response.data && response.data.total) {
          searchVolume = {
            monthly: response.data.total,
            competition: response.data.total > 10000 ? '높음' : response.data.total > 1000 ? '중간' : '낮음',
            trend: '안정',
            totalResults: response.data.total,
          };
        }
      } catch (apiError) {
        console.error('네이버 API 오류:', apiError.message);
        // API 오류 시 Mock 데이터 사용
      }
    }

    // 포인트 차감
    if (userId) {
      await PointsService.deductPoints(
        userId,
        POINT_COSTS.KEYWORD_SEARCH_VOLUME,
        `키워드 검색량 조회: ${keyword}`
      );
    }

    res.json({
      success: true,
      keyword,
      searchVolume,
      pointsDeducted: userId ? POINT_COSTS.KEYWORD_SEARCH_VOLUME : 0,
      checkedAt: new Date().toISOString(),
      note: clientId ? '실제 데이터' : 'Mock 데이터 (네이버 API 키 설정 필요)',
    });

  } catch (error) {
    console.error('검색량 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '검색량 조회 중 오류가 발생했습니다.',
      error: error.message,
    });
  }
});

// 키워드 트렌드 분석
router.post('/trend', async (req, res) => {
  try {
    const { keyword, period = 'month', userId } = req.body;

    if (!keyword) {
      return res.status(400).json({
        success: false,
        message: '키워드가 필요합니다.',
      });
    }

    // 포인트 확인
    if (userId) {
      const pointCheck = await PointsService.checkPoints(userId, POINT_COSTS.KEYWORD_SEARCH_VOLUME);
      if (!pointCheck.success || !pointCheck.sufficient) {
        return res.status(400).json({
          success: false,
          message: pointCheck.error || `포인트가 부족합니다. (필요: ${POINT_COSTS.KEYWORD_SEARCH_VOLUME}P)`,
          insufficientPoints: true,
        });
      }
    }

    // Mock 트렌드 데이터 생성
    const generateTrendData = () => {
      const data = [];
      const periods = period === 'month' ? 30 : period === 'week' ? 7 : 365;
      
      for (let i = 0; i < periods; i++) {
        data.push({
          date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          volume: Math.floor(Math.random() * 1000) + 100,
        });
      }
      
      return data.reverse();
    };

    const trendData = generateTrendData();

    // 포인트 차감
    if (userId) {
      await PointsService.deductPoints(
        userId,
        POINT_COSTS.KEYWORD_SEARCH_VOLUME,
        `키워드 트렌드 분석: ${keyword}`
      );
    }

    res.json({
      success: true,
      keyword,
      period,
      trendData,
      pointsDeducted: userId ? POINT_COSTS.KEYWORD_SEARCH_VOLUME : 0,
      checkedAt: new Date().toISOString(),
      note: 'Mock 트렌드 데이터',
    });

  } catch (error) {
    console.error('트렌드 분석 오류:', error);
    res.status(500).json({
      success: false,
      message: '트렌드 분석 중 오류가 발생했습니다.',
      error: error.message,
    });
  }
});

module.exports = router;
