const express = require('express');
const router = express.Router();
const crawler = require('../services/crawler');
const { PointsService, POINT_COSTS } = require('../services/points');
const rankHistoryService = require('../services/rank-history');

// 플레이스 순위 체크
router.post('/check-rank', async (req, res) => {
  try {
    let { keyword, placeUrl, userId, placeId, keywordId } = req.body;

    if (!keyword || !placeUrl) {
      return res.status(400).json({
        success: false,
        message: '키워드와 플레이스 URL(또는 ID)이 필요합니다.',
      });
    }

    // 숫자만 입력된 경우 URL로 변환
    if (/^\d+$/.test(placeUrl.trim())) {
      placeUrl = `https://m.place.naver.com/restaurant/${placeUrl.trim()}/home`;
      console.log(`🔄 [플레이스] ID → URL 변환: ${placeUrl}`);
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

      // rankHistory 저장 (placeId, keywordId가 있는 경우)
      if (placeId && keywordId) {
        const rankData = {
          rank: result.rank || null,
          page: result.page || null,
          searchType: 'map_mobile',
          foundPlace: result.foundPlace || null,
          errorMessage: result.error || null,
          keyword,
          placeUrl,
          totalResults: result.totalResults || null,
        };

        const historyResult = await rankHistoryService.savePlaceRankHistory(
          userId,
          placeId,
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
    const { keyword, placeUrl, userId, placeId, keywordId } = req.body;

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

      // rankHistory 저장 (placeId, keywordId가 있는 경우)
      if (placeId && keywordId) {
        const rankData = {
          rank: result.rank || null,
          page: result.page || null,
          searchType: 'map_mobile',
          foundPlace: result.foundPlace || null,
          errorMessage: result.error || null,
          keyword,
          placeUrl,
          totalResults: result.totalResults || null,
        };

        const historyResult = await rankHistoryService.savePlaceRankHistory(
          userId,
          placeId,
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

// 순위 히스토리 조회
router.get('/rank-history', async (req, res) => {
  try {
    const { userId, placeId, keywordId, limit } = req.query;

    if (!userId || !placeId || !keywordId) {
      return res.status(400).json({
        success: false,
        message: 'userId, placeId, keywordId가 필요합니다.',
      });
    }

    const result = await rankHistoryService.getPlaceRankHistory(
      userId,
      placeId,
      keywordId,
      limit ? parseInt(limit) : 30
    );

    res.json(result);

  } catch (error) {
    console.error('순위 히스토리 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '순위 히스토리 조회 중 오류가 발생했습니다.',
      error: error.message,
    });
  }
});

// 플레이스 타겟 목록 조회
router.get('/targets', async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId가 필요합니다.',
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
    const targetsSnapshot = await db
      .collection('users').doc(userId)
      .collection('placeTargets')
      .orderBy('updatedAt', 'desc')
      .get();

    const targets = [];
    for (const doc of targetsSnapshot.docs) {
      const targetData = doc.data();
      
      // 각 타겟의 키워드 목록 가져오기
      const keywordsSnapshot = await db
        .collection('users').doc(userId)
        .collection('placeTargets').doc(doc.id)
        .collection('keywords')
        .get();

      const keywords = keywordsSnapshot.docs.map(kwDoc => ({
        id: kwDoc.id,
        ...kwDoc.data(),
      }));

      targets.push({
        id: doc.id,
        ...targetData,
        keywords,
      });
    }

    res.json({
      success: true,
      targets,
    });

  } catch (error) {
    console.error('타겟 목록 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '타겟 목록 조회 중 오류가 발생했습니다.',
      error: error.message,
    });
  }
});

// 플레이스 타겟 및 키워드 저장
router.post('/save-target', async (req, res) => {
  try {
    const { userId, placeData, keywords } = req.body;

    if (!userId || !placeData) {
      return res.status(400).json({
        success: false,
        message: 'userId와 placeData가 필요합니다.',
      });
    }

    // 플레이스 타겟 저장
    const placeResult = await rankHistoryService.savePlaceTarget(userId, placeData);
    
    if (!placeResult.success) {
      return res.status(500).json(placeResult);
    }

    const placeId = placeResult.placeId;

    // 키워드 저장 (있는 경우)
    if (keywords && Array.isArray(keywords) && keywords.length > 0) {
      for (const keyword of keywords) {
        await rankHistoryService.saveKeyword(userId, placeId, {
          keyword: keyword.keyword,
          isMain: keyword.isMain || false,
        });
      }
    }

    res.json({
      success: true,
      placeId,
      message: '플레이스 타겟이 저장되었습니다.',
    });

  } catch (error) {
    console.error('플레이스 타겟 저장 오류:', error);
    res.status(500).json({
      success: false,
      message: '플레이스 타겟 저장 중 오류가 발생했습니다.',
      error: error.message,
    });
  }
});

module.exports = router;
