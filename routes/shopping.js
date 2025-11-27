const express = require('express');
const router = express.Router();
const naverAPI = require('../services/naver-api');
const { PointsService, POINT_COSTS } = require('../services/points');
const rankHistoryService = require('../services/rank-history');

// 쇼핑 순위 체크 (네이버 API 사용)
router.post('/check-rank', async (req, res) => {
  try {
    const { keyword, productUrl, userId, shopId, keywordId } = req.body;

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

    // 네이버 API로 쇼핑 순위 체크
    const result = await naverAPI.checkShoppingRank(keyword, productUrl);

    // 포인트 차감
    if (userId && result.success) {
      await PointsService.deductPoints(
        userId,
        POINT_COSTS.SHOPPING_RANK_CHECK,
        `쇼핑 순위 조회: ${keyword}`
      );
      result.pointsDeducted = POINT_COSTS.SHOPPING_RANK_CHECK;

      // rankHistory 저장
      if (shopId && keywordId) {
        const rankData = {
          rank: result.rank || null,
          page: result.rank > 0 ? Math.ceil(result.rank / 40) : null,
          searchType: 'shopping',
          foundProduct: result.foundProduct || null,
          errorMessage: result.error || null,
          keyword,
          productUrl,
          totalResults: result.totalResults || null,
        };

        const historyResult = await rankHistoryService.saveShoppingRankHistory(
          userId,
          shopId,
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
    const { keyword, productUrl, userId, shopId, keywordId } = req.body;

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

    // 네이버 API로 쇼핑 순위 체크
    const result = await naverAPI.checkShoppingRank(keyword, productUrl);

    // 포인트 차감
    if (userId && result.success) {
      await PointsService.deductPoints(
        userId,
        POINT_COSTS.SHOPPING_RANK_CHECK_ONCE,
        `쇼핑 1회 순위 조회: ${keyword}`
      );
      result.pointsDeducted = POINT_COSTS.SHOPPING_RANK_CHECK_ONCE;

      // rankHistory 저장
      if (shopId && keywordId) {
        const rankData = {
          rank: result.rank || null,
          page: result.rank > 0 ? Math.ceil(result.rank / 40) : null,
          searchType: 'shopping',
          foundProduct: result.foundProduct || null,
          errorMessage: result.error || null,
          keyword,
          productUrl,
          totalResults: result.totalResults || null,
        };

        const historyResult = await rankHistoryService.saveShoppingRankHistory(
          userId,
          shopId,
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
    console.error('쇼핑 1회 순위 체크 오류:', error);
    res.status(500).json({
      success: false,
      message: '쇼핑 순위 조회 중 오류가 발생했습니다.',
      error: error.message,
    });
  }
});

// 쇼핑 순위 히스토리 조회
router.get('/rank-history', async (req, res) => {
  try {
    const { userId, shopId, keywordId, limit } = req.query;

    if (!userId || !shopId || !keywordId) {
      return res.status(400).json({
        success: false,
        message: 'userId, shopId, keywordId가 필요합니다.',
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
      .collection('shopTargets').doc(shopId)
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
    console.error('쇼핑 순위 히스토리 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '순위 히스토리 조회 중 오류가 발생했습니다.',
      error: error.message,
    });
  }
});

module.exports = router;
