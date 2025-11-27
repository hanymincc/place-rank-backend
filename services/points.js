const { getFirestore, initialized } = require('./firebase-admin');
const admin = require('firebase-admin');

// 포인트 비용 (테스트용 - 모두 0으로 변경)
const POINT_COSTS = {
  PLACE_RANK_CHECK: 0,          // 플레이스 순위 체크 (원래 100)
  PLACE_RANK_CHECK_ONCE: 0,     // 플레이스 1회 체크 (원래 50)
  BLOG_RANK_CHECK: 0,           // 블로그 순위 체크 (원래 80)
  SHOPPING_RANK_CHECK: 0,       // 쇼핑 순위 체크 (원래 100)
  SHOPPING_RANK_CHECK_ONCE: 0,  // 쇼핑 1회 체크 (원래 50)
  KEYWORD_SEARCH_VOLUME: 0,     // 키워드 검색량 조회 (원래 30)
  MAIN_KEYWORD: 0,              // 대표 키워드 조회 (원래 50)
};

class PointsService {
  // 포인트 차감
  async deductPoints(userId, cost, description) {
    if (!initialized) {
      console.warn('Firebase가 초기화되지 않음. 포인트 차감 스킵');
      return { success: true, skipped: true };
    }

    try {
      const db = getFirestore();
      const userRef = db.collection('users').doc(userId);

      // 트랜잭션으로 포인트 차감
      await db.runTransaction(async (transaction) => {
        const userDoc = await transaction.get(userRef);

        if (!userDoc.exists) {
          throw new Error('사용자를 찾을 수 없습니다.');
        }

        const userData = userDoc.data();
        const currentPoints = userData.points || 0;

        if (currentPoints < cost) {
          throw new Error(`포인트가 부족합니다. (필요: ${cost}P, 보유: ${currentPoints}P)`);
        }

        // 포인트 차감
        transaction.update(userRef, {
          points: admin.firestore.FieldValue.increment(-cost),
        });

        // 포인트 이력 기록
        const historyRef = db.collection('pointHistory').doc();
        transaction.set(historyRef, {
          userId,
          type: 'use',
          points: -cost,
          description,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });

      return { 
        success: true, 
        pointsDeducted: cost,
        description 
      };

    } catch (error) {
      console.error('포인트 차감 오류:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  // 포인트 확인
  async checkPoints(userId, requiredPoints) {
    if (!initialized) {
      return { success: true, sufficient: true, skipped: true };
    }

    try {
      const db = getFirestore();
      const userDoc = await db.collection('users').doc(userId).get();

      if (!userDoc.exists) {
        return { 
          success: false, 
          error: '사용자를 찾을 수 없습니다.' 
        };
      }

      const userData = userDoc.data();
      const currentPoints = userData.points || 0;

      return {
        success: true,
        sufficient: currentPoints >= requiredPoints,
        currentPoints,
        requiredPoints,
      };

    } catch (error) {
      console.error('포인트 확인 오류:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }
}

module.exports = {
  PointsService: new PointsService(),
  POINT_COSTS,
};
