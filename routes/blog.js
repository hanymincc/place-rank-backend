const express = require('express');
const router = express.Router();
const naverAPI = require('../services/naver-api');
const { PointsService, POINT_COSTS } = require('../services/points');
const rankHistoryService = require('../services/rank-history');

// 블로그 순위 체크 (네이버 API 사용)
router.post('/check-rank', async (req, res) => {
  try {
    const { keyword, blogUrl, userId, blogId, keywordId } = req.body;

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

    // 네이버 API로 블로그 순위 체크
    const result = await naverAPI.checkBlogRank(keyword, blogUrl);

    // 포인트 차감
    if (userId && result.success) {
      await PointsService.deductPoints(
        userId,
        POINT_COSTS.BLOG_RANK_CHECK,
        `블로그 순위 조회: ${keyword}`
      );
      result.pointsDeducted = POINT_COSTS.BLOG_RANK_CHECK;

      // rankHistory 저장
      if (blogId && keywordId) {
        const rankData = {
          rank: result.rank || null,
          page: result.rank > 0 ? Math.ceil(result.rank / 10) : null,
          searchType: 'blog',
          foundPost: result.foundPost || null,
          errorMessage: result.error || null,
          keyword,
          blogUrl,
          totalResults: result.totalResults || null,
        };

        const historyResult = await rankHistoryService.saveBlogRankHistory(
          userId,
          blogId,
          keywordId,
          rankData
        );

        if (historyResult.success && !historyResult.skipped) {
          result.historyId = historyResult.historyId;
          result.historySaved = true;
        }
      }
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
        const result = await naverAPI.checkBlogRank(keyword, blogUrl);
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

// 블로그 순위 히스토리 조회
router.get('/rank-history', async (req, res) => {
  try {
    const { userId, blogId, keywordId, limit } = req.query;

    if (!userId || !blogId || !keywordId) {
      return res.status(400).json({
        success: false,
        message: 'userId, blogId, keywordId가 필요합니다.',
      });
    }

    const { getFirestore, initialized } = require('../services/firebase-admin');
    if (!initialized) {
      return res.status(503).json({
        success: false,
        message: 'Firebase가 초기화되지 않았습니다.',
      });
    }

    const db = getFirestore();
    const historySnapshot = await db
      .collection('users').doc(userId)
      .collection('blogTargets').doc(blogId)
      .collection('keywords').doc(keywordId)
      .collection('rankHistory')
      .orderBy('searchedAt', 'desc')
      .limit(limit ? parseInt(limit) : 30)
      .get();

    const history = [];
    historySnapshot.forEach(doc => {
      history.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    res.json({
      success: true,
      history,
    });

  } catch (error) {
    console.error('블로그 순위 히스토리 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '순위 히스토리 조회 중 오류가 발생했습니다.',
      error: error.message,
    });
  }
});

module.exports = router;
