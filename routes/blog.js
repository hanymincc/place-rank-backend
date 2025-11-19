const express = require('express');
const router = express.Router();
const crawler = require('../services/crawler');
const { PointsService, POINT_COSTS } = require('../services/points');

// 블로그 순위 체크
router.post('/check-rank', async (req, res) => {
  try {
    const { keyword, blogUrl, userId } = req.body;

    if (!keyword || !blogUrl) {
      return res.status(400).json({
        success: false,
        message: '키워드와 블로그 URL이 필요합니다.',
      });
    }

    // 포인트 확인
    if (userId) {
      const pointCheck = await PointsService.checkPoints(userId, POINT_COSTS.BLOG_RANK_CHECK);
      if (!pointCheck.success || !pointCheck.sufficient) {
        return res.status(400).json({
          success: false,
          message: pointCheck.error || `포인트가 부족합니다. (필요: ${POINT_COSTS.BLOG_RANK_CHECK}P)`,
          insufficientPoints: true,
        });
      }
    }

    // 블로그 순위 체크
    const result = await crawler.checkBlogRank(keyword, blogUrl);

    // 포인트 차감
    if (userId && result.success) {
      await PointsService.deductPoints(
        userId,
        POINT_COSTS.BLOG_RANK_CHECK,
        `블로그 순위 조회: ${keyword}`
      );
      result.pointsDeducted = POINT_COSTS.BLOG_RANK_CHECK;
    }

    res.json(result);

  } catch (error) {
    console.error('블로그 순위 체크 오류:', error);
    res.status(500).json({
      success: false,
      message: '블로그 순위 조회 중 오류가 발생했습니다.',
      error: error.message,
    });
  }
});

// 블로그 키워드 분석 (여러 키워드 순위 체크)
router.post('/analyze-keyword', async (req, res) => {
  try {
    const { keywords, blogUrl, userId } = req.body;

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return res.status(400).json({
        success: false,
        message: '키워드 목록이 필요합니다.',
      });
    }

    if (!blogUrl) {
      return res.status(400).json({
        success: false,
        message: '블로그 URL이 필요합니다.',
      });
    }

    const totalCost = POINT_COSTS.BLOG_RANK_CHECK * keywords.length;

    // 포인트 확인
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
        const result = await crawler.checkBlogRank(keyword, blogUrl);
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

    // 포인트 차감
    if (userId) {
      await PointsService.deductPoints(
        userId,
        totalCost,
        `블로그 키워드 분석: ${keywords.join(', ')}`
      );
    }

    res.json({
      success: true,
      blogUrl,
      totalKeywords: keywords.length,
      results,
      pointsDeducted: userId ? totalCost : 0,
      checkedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error('블로그 키워드 분석 오류:', error);
    res.status(500).json({
      success: false,
      message: '블로그 키워드 분석 중 오류가 발생했습니다.',
      error: error.message,
    });
  }
});

module.exports = router;
