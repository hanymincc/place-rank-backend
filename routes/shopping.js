const express = require('express');
const router = express.Router();
const crawler = require('../services/crawler');
const { PointsService, POINT_COSTS } = require('../services/points');

// 쇼핑 순위 체크
router.post('/check-rank', async (req, res) => {
  try {
    const { keyword, productUrl, userId } = req.body;

    if (!keyword || !productUrl) {
      return res.status(400).json({
        success: false,
        message: '키워드와 상품 URL이 필요합니다.',
      });
    }

    // 포인트 확인
    if (userId) {
      const pointCheck = await PointsService.checkPoints(userId, POINT_COSTS.SHOPPING_RANK_CHECK);
      if (!pointCheck.success || !pointCheck.sufficient) {
        return res.status(400).json({
          success: false,
          message: pointCheck.error || `포인트가 부족합니다. (필요: ${POINT_COSTS.SHOPPING_RANK_CHECK}P)`,
          insufficientPoints: true,
        });
      }
    }

    // 쇼핑 순위 체크
    const result = await crawler.checkShoppingRank(keyword, productUrl);

    // 포인트 차감
    if (userId && result.success) {
      await PointsService.deductPoints(
        userId,
        POINT_COSTS.SHOPPING_RANK_CHECK,
        `쇼핑 순위 조회: ${keyword}`
      );
      result.pointsDeducted = POINT_COSTS.SHOPPING_RANK_CHECK;
    }

    res.json(result);

  } catch (error) {
    console.error('쇼핑 순위 체크 오류:', error);
    res.status(500).json({
      success: false,
      message: '쇼핑 순위 조회 중 오류가 발생했습니다.',
      error: error.message,
    });
  }
});

// 쇼핑 1회 순위 체크 (저렴한 버전)
router.post('/check-rank-once', async (req, res) => {
  try {
    const { keyword, productUrl, userId } = req.body;

    if (!keyword || !productUrl) {
      return res.status(400).json({
        success: false,
        message: '키워드와 상품 URL이 필요합니다.',
      });
    }

    // 포인트 확인
    if (userId) {
      const pointCheck = await PointsService.checkPoints(userId, POINT_COSTS.SHOPPING_RANK_CHECK_ONCE);
      if (!pointCheck.success || !pointCheck.sufficient) {
        return res.status(400).json({
          success: false,
          message: pointCheck.error || `포인트가 부족합니다. (필요: ${POINT_COSTS.SHOPPING_RANK_CHECK_ONCE}P)`,
          insufficientPoints: true,
        });
      }
    }

    // 쇼핑 순위 체크
    const result = await crawler.checkShoppingRank(keyword, productUrl);

    // 포인트 차감
    if (userId && result.success) {
      await PointsService.deductPoints(
        userId,
        POINT_COSTS.SHOPPING_RANK_CHECK_ONCE,
        `쇼핑 1회 순위 조회: ${keyword}`
      );
      result.pointsDeducted = POINT_COSTS.SHOPPING_RANK_CHECK_ONCE;
    }

    res.json(result);

  } catch (error) {
    console.error('쇼핑 1회 순위 체크 오류:', error);
    res.status(500).json({
      success: false,
      message: '쇼핑 순위 조회 중 오류가 발생했습니다.',
      error: error.message,
    });
  }
});

module.exports = router;
