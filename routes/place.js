const express = require('express');
const router = express.Router();
const crawler = require('../services/crawler');
const { PointsService, POINT_COSTS } = require('../services/points');

// 플레이스 순위 체크
router.post('/check-rank', async (req, res) => {
  try {
    const { keyword, placeUrl, userId } = req.body;

    if (!keyword || !placeUrl) {
      return res.status(400).json({
        success: false,
        message: '키워드와 플레이스 URL이 필요합니다.',
      });
    }

    // 포인트 확인 (userId가 있는 경우)
    if (userId) {
      const pointCheck = await PointsService.checkPoints(userId, POINT_COSTS.PLACE_RANK_CHECK);
      if (!pointCheck.success || !pointCheck.sufficient) {
        return res.status(400).json({
          success: false,
          message: pointCheck.error || `포인트가 부족합니다. (필요: ${POINT_COSTS.PLACE_RANK_CHECK}P)`,
          insufficientPoints: true,
          requiredPoints: POINT_COSTS.PLACE_RANK_CHECK,
          currentPoints: pointCheck.currentPoints,
        });
      }
    }

    // 순위 체크
    const result = await crawler.checkPlaceRank(keyword, placeUrl);

    // 포인트 차감 (userId가 있는 경우)
    if (userId && result.success) {
      const deductResult = await PointsService.deductPoints(
        userId,
        POINT_COSTS.PLACE_RANK_CHECK,
        `플레이스 순위 조회: ${keyword}`
      );

      result.pointsDeducted = deductResult.pointsDeducted;
    }

    res.json(result);

  } catch (error) {
    console.error('플레이스 순위 체크 오류:', error);
    res.status(500).json({
      success: false,
      message: '순위 조회 중 오류가 발생했습니다.',
      error: error.message,
    });
  }
});

// 플레이스 1회 순위 체크 (저렴한 버전)
router.post('/check-rank-once', async (req, res) => {
  try {
    const { keyword, placeUrl, userId } = req.body;

    if (!keyword || !placeUrl) {
      return res.status(400).json({
        success: false,
        message: '키워드와 플레이스 URL이 필요합니다.',
      });
    }

    // 포인트 확인 (userId가 있는 경우)
    if (userId) {
      const pointCheck = await PointsService.checkPoints(userId, POINT_COSTS.PLACE_RANK_CHECK_ONCE);
      if (!pointCheck.success || !pointCheck.sufficient) {
        return res.status(400).json({
          success: false,
          message: pointCheck.error || `포인트가 부족합니다. (필요: ${POINT_COSTS.PLACE_RANK_CHECK_ONCE}P)`,
          insufficientPoints: true,
        });
      }
    }

    // 순위 체크
    const result = await crawler.checkPlaceRank(keyword, placeUrl);

    // 포인트 차감 (userId가 있는 경우)
    if (userId && result.success) {
      await PointsService.deductPoints(
        userId,
        POINT_COSTS.PLACE_RANK_CHECK_ONCE,
        `플레이스 1회 순위 조회: ${keyword}`
      );
      result.pointsDeducted = POINT_COSTS.PLACE_RANK_CHECK_ONCE;
    }

    res.json(result);

  } catch (error) {
    console.error('플레이스 1회 순위 체크 오류:', error);
    res.status(500).json({
      success: false,
      message: '순위 조회 중 오류가 발생했습니다.',
      error: error.message,
    });
  }
});

// 대표 키워드 조회
router.post('/main-keyword', async (req, res) => {
  try {
    const { placeUrl, userId } = req.body;

    if (!placeUrl) {
      return res.status(400).json({
        success: false,
        message: '플레이스 URL이 필요합니다.',
      });
    }

    // 포인트 확인 (userId가 있는 경우)
    if (userId) {
      const pointCheck = await PointsService.checkPoints(userId, POINT_COSTS.MAIN_KEYWORD);
      if (!pointCheck.success || !pointCheck.sufficient) {
        return res.status(400).json({
          success: false,
          message: pointCheck.error || `포인트가 부족합니다. (필요: ${POINT_COSTS.MAIN_KEYWORD}P)`,
          insufficientPoints: true,
        });
      }
    }

    // 대표 키워드 추출
    const result = await crawler.getMainKeyword(placeUrl);

    // 포인트 차감 (userId가 있는 경우)
    if (userId && result.success) {
      await PointsService.deductPoints(
        userId,
        POINT_COSTS.MAIN_KEYWORD,
        `대표 키워드 조회: ${placeUrl}`
      );
      result.pointsDeducted = POINT_COSTS.MAIN_KEYWORD;
    }

    res.json(result);

  } catch (error) {
    console.error('대표 키워드 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '대표 키워드 조회 중 오류가 발생했습니다.',
      error: error.message,
    });
  }
});

// 순위 비교 분석 (여러 키워드)
router.post('/compare-rank', async (req, res) => {
  try {
    const { keywords, placeUrl, userId } = req.body;

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return res.status(400).json({
        success: false,
        message: '키워드 목록이 필요합니다.',
      });
    }

    if (!placeUrl) {
      return res.status(400).json({
        success: false,
        message: '플레이스 URL이 필요합니다.',
      });
    }

    const totalCost = POINT_COSTS.PLACE_RANK_CHECK * keywords.length;

    // 포인트 확인 (userId가 있는 경우)
    if (userId) {
      const pointCheck = await PointsService.checkPoints(userId, totalCost);
      if (!pointCheck.success || !pointCheck.sufficient) {
        return res.status(400).json({
          success: false,
          message: pointCheck.error || `포인트가 부족합니다. (필요: ${totalCost}P)`,
          insufficientPoints: true,
        });
      }
    }

    // 각 키워드별 순위 체크
    const results = [];
    for (const keyword of keywords) {
      try {
        const result = await crawler.checkPlaceRank(keyword, placeUrl);
        results.push({
          keyword,
          ...result,
        });
      } catch (error) {
        results.push({
          keyword,
          success: false,
          error: error.message,
        });
      }
    }

    // 포인트 차감 (userId가 있는 경우)
    if (userId) {
      await PointsService.deductPoints(
        userId,
        totalCost,
        `순위 비교 분석: ${keywords.join(', ')}`
      );
    }

    res.json({
      success: true,
      placeUrl,
      totalKeywords: keywords.length,
      results,
      pointsDeducted: userId ? totalCost : 0,
      checkedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error('순위 비교 분석 오류:', error);
    res.status(500).json({
      success: false,
      message: '순위 비교 분석 중 오류가 발생했습니다.',
      error: error.message,
    });
  }
});

module.exports = router;
