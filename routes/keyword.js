const express = require('express');
const router = express.Router();
const naverAPI = require('../services/naver-api');
const { PointsService, POINT_COSTS } = require('../services/points');

// 키워드 검색량 조회
router.post('/search-volume', async (req, res) => {
  try {
    const { keyword, userId } = req.body;

    if (!keyword) {
      return res.status(400).json({
        success: false,
        message: '키워드가 필요합니다.',
      });
    }

    // 포인트 확인 (테스트 기간 무료)
    if (userId && POINT_COSTS.KEYWORD_SEARCH_VOLUME > 0) {
      const pointCheck = await PointsService.checkPoints(userId, POINT_COSTS.KEYWORD_SEARCH_VOLUME);
      if (!pointCheck.success || !pointCheck.sufficient) {
        return res.status(400).json({
          success: false,
          message: pointCheck.error || `포인트가 부족합니다. (필요: ${POINT_COSTS.KEYWORD_SEARCH_VOLUME}P)`,
          insufficientPoints: true,
        });
      }
    }

    // 네이버 데이터랩으로 최근 30일 트렌드 조회
    const trendResult = await naverAPI.compareKeywords([keyword]);
    
    let searchVolume = {
      keyword,
      relativeVolume: 0,
      trend: '안정',
      competition: '중간',
    };

    if (trendResult.success && trendResult.data && trendResult.data.length > 0) {
      const data = trendResult.data[0].data || [];
      
      // 최근 데이터 평균 계산
      const recentData = data.slice(-7);
      const avgRecent = recentData.reduce((sum, d) => sum + d.ratio, 0) / recentData.length;
      
      // 이전 데이터 평균
      const olderData = data.slice(0, 7);
      const avgOlder = olderData.reduce((sum, d) => sum + d.ratio, 0) / olderData.length;
      
      // 트렌드 판단
      let trend = '안정';
      if (avgRecent > avgOlder * 1.1) trend = '상승';
      else if (avgRecent < avgOlder * 0.9) trend = '하락';
      
      searchVolume = {
        keyword,
        relativeVolume: Math.round(avgRecent),
        trend,
        competition: avgRecent > 70 ? '높음' : avgRecent > 30 ? '중간' : '낮음',
        trendData: data,
      };
    }

    // 포인트 차감
    if (userId && POINT_COSTS.KEYWORD_SEARCH_VOLUME > 0) {
      await PointsService.deductPoints(
        userId,
        POINT_COSTS.KEYWORD_SEARCH_VOLUME,
        `키워드 검색량 조회: ${keyword}`
      );
    }

    res.json({
      success: true,
      ...searchVolume,
      pointsDeducted: userId ? POINT_COSTS.KEYWORD_SEARCH_VOLUME : 0,
      checkedAt: new Date().toISOString(),
      method: '네이버 데이터랩 API',
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

// 키워드 트렌드 분석 (데이터랩 API)
router.post('/trend', async (req, res) => {
  try {
    const { keywords, startDate, endDate, timeUnit = 'week', userId } = req.body;

    // keywords가 문자열이면 배열로 변환
    const keywordList = Array.isArray(keywords) ? keywords : [keywords];

    if (!keywordList || keywordList.length === 0) {
      return res.status(400).json({
        success: false,
        message: '키워드가 필요합니다.',
      });
    }

    if (keywordList.length > 5) {
      return res.status(400).json({
        success: false,
        message: '한 번에 최대 5개 키워드까지 비교할 수 있습니다.',
      });
    }

    // 기본 날짜 설정 (최근 1년)
    const end = endDate || new Date().toISOString().split('T')[0];
    const start = startDate || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // 포인트 확인
    if (userId && POINT_COSTS.KEYWORD_SEARCH_VOLUME > 0) {
      const pointCheck = await PointsService.checkPoints(userId, POINT_COSTS.KEYWORD_SEARCH_VOLUME);
      if (!pointCheck.success || !pointCheck.sufficient) {
        return res.status(400).json({
          success: false,
          message: pointCheck.error || `포인트가 부족합니다. (필요: ${POINT_COSTS.KEYWORD_SEARCH_VOLUME}P)`,
          insufficientPoints: true,
        });
      }
    }

    // 네이버 데이터랩 API 호출
    const result = await naverAPI.getSearchTrend(keywordList, start, end, timeUnit);

    // 포인트 차감
    if (userId && POINT_COSTS.KEYWORD_SEARCH_VOLUME > 0) {
      await PointsService.deductPoints(
        userId,
        POINT_COSTS.KEYWORD_SEARCH_VOLUME,
        `키워드 트렌드 분석: ${keywordList.join(', ')}`
      );
    }

    res.json({
      ...result,
      pointsDeducted: userId ? POINT_COSTS.KEYWORD_SEARCH_VOLUME : 0,
      method: '네이버 데이터랩 API',
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

// 키워드 비교 분석 (여러 키워드 상대 검색량)
router.post('/compare', async (req, res) => {
  try {
    const { keywords, userId } = req.body;

    if (!keywords || !Array.isArray(keywords) || keywords.length < 2) {
      return res.status(400).json({
        success: false,
        message: '비교할 키워드 2개 이상이 필요합니다.',
      });
    }

    if (keywords.length > 5) {
      return res.status(400).json({
        success: false,
        message: '한 번에 최대 5개 키워드까지 비교할 수 있습니다.',
      });
    }

    // 포인트 확인
    if (userId && POINT_COSTS.KEYWORD_SEARCH_VOLUME > 0) {
      const pointCheck = await PointsService.checkPoints(userId, POINT_COSTS.KEYWORD_SEARCH_VOLUME);
      if (!pointCheck.success || !pointCheck.sufficient) {
        return res.status(400).json({
          success: false,
          message: pointCheck.error || `포인트가 부족합니다.`,
          insufficientPoints: true,
        });
      }
    }

    // 네이버 데이터랩 비교
    const result = await naverAPI.compareKeywords(keywords);

    // 포인트 차감
    if (userId && POINT_COSTS.KEYWORD_SEARCH_VOLUME > 0) {
      await PointsService.deductPoints(
        userId,
        POINT_COSTS.KEYWORD_SEARCH_VOLUME,
        `키워드 비교: ${keywords.join(' vs ')}`
      );
    }

    res.json({
      ...result,
      pointsDeducted: userId ? POINT_COSTS.KEYWORD_SEARCH_VOLUME : 0,
      method: '네이버 데이터랩 API',
    });

  } catch (error) {
    console.error('키워드 비교 오류:', error);
    res.status(500).json({
      success: false,
      message: '키워드 비교 중 오류가 발생했습니다.',
      error: error.message,
    });
  }
});

module.exports = router;
