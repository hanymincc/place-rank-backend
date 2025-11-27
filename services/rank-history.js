const { getFirestore, initialized } = require('./firebase-admin');
const admin = require('firebase-admin');

class RankHistoryService {
  /**
   * 플레이스 순위 히스토리 저장
   */
  async savePlaceRankHistory(userId, placeId, keywordId, rankData) {
    if (!initialized) {
      console.warn('Firebase가 초기화되지 않음. rankHistory 저장 스킵');
      return { success: true, skipped: true };
    }

    try {
      const db = getFirestore();
      const historyRef = db
        .collection('users').doc(userId)
        .collection('placeTargets').doc(placeId)
        .collection('keywords').doc(keywordId)
        .collection('rankHistory').doc();

      await historyRef.set({
        rank: rankData.rank || null,
        page: rankData.page || null,
        searchType: rankData.searchType || 'map_mobile',
        searchedAt: admin.firestore.FieldValue.serverTimestamp(),
        foundPlace: rankData.foundPlace || null,
        errorMessage: rankData.errorMessage || null,
        keyword: rankData.keyword || null,
        placeUrl: rankData.placeUrl || null,
        totalResults: rankData.totalResults || null,
      });

      return { 
        success: true, 
        historyId: historyRef.id 
      };

    } catch (error) {
      console.error('플레이스 rankHistory 저장 오류:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  /**
   * 블로그 순위 히스토리 저장
   */
  async saveBlogRankHistory(userId, blogId, keywordId, rankData) {
    if (!initialized) {
      console.warn('Firebase가 초기화되지 않음. rankHistory 저장 스킵');
      return { success: true, skipped: true };
    }

    try {
      const db = getFirestore();
      const historyRef = db
        .collection('users').doc(userId)
        .collection('blogTargets').doc(blogId)
        .collection('keywords').doc(keywordId)
        .collection('rankHistory').doc();

      await historyRef.set({
        rank: rankData.rank || null,
        page: rankData.page || null,
        searchType: rankData.searchType || 'blog',
        searchedAt: admin.firestore.FieldValue.serverTimestamp(),
        foundPlace: rankData.foundPlace || null,
        errorMessage: rankData.errorMessage || null,
        keyword: rankData.keyword || null,
        blogUrl: rankData.blogUrl || null,
        totalResults: rankData.totalResults || null,
      });

      return { 
        success: true, 
        historyId: historyRef.id 
      };

    } catch (error) {
      console.error('블로그 rankHistory 저장 오류:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  /**
   * 쇼핑 순위 히스토리 저장
   */
  async saveShoppingRankHistory(userId, shopId, keywordId, rankData) {
    if (!initialized) {
      console.warn('Firebase가 초기화되지 않음. rankHistory 저장 스킵');
      return { success: true, skipped: true };
    }

    try {
      const db = getFirestore();
      const historyRef = db
        .collection('users').doc(userId)
        .collection('shopTargets').doc(shopId)
        .collection('keywords').doc(keywordId)
        .collection('rankHistory').doc();

      await historyRef.set({
        rank: rankData.rank || null,
        page: rankData.page || null,
        searchType: rankData.searchType || 'shopping',
        searchedAt: admin.firestore.FieldValue.serverTimestamp(),
        foundPlace: rankData.foundPlace || null,
        errorMessage: rankData.errorMessage || null,
        keyword: rankData.keyword || null,
        productUrl: rankData.productUrl || null,
        totalResults: rankData.totalResults || null,
      });

      return { 
        success: true, 
        historyId: historyRef.id 
      };

    } catch (error) {
      console.error('쇼핑 rankHistory 저장 오류:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  /**
   * 특정 키워드의 순위 히스토리 조회 (플레이스)
   */
  async getPlaceRankHistory(userId, placeId, keywordId, limit = 30) {
    if (!initialized) {
      return { success: false, error: 'Firebase가 초기화되지 않음' };
    }

    try {
      const db = getFirestore();
      const historySnapshot = await db
        .collection('users').doc(userId)
        .collection('placeTargets').doc(placeId)
        .collection('keywords').doc(keywordId)
        .collection('rankHistory')
        .orderBy('searchedAt', 'desc')
        .limit(limit)
        .get();

      const history = [];
      historySnapshot.forEach(doc => {
        history.push({
          id: doc.id,
          ...doc.data(),
        });
      });

      return { 
        success: true, 
        history 
      };

    } catch (error) {
      console.error('플레이스 rankHistory 조회 오류:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  /**
   * 플레이스 타겟 및 키워드 정보 저장/업데이트
   */
  async savePlaceTarget(userId, placeData) {
    if (!initialized) {
      console.warn('Firebase가 초기화되지 않음. placeTarget 저장 스킵');
      return { success: true, skipped: true };
    }

    try {
      const db = getFirestore();
      const placeId = placeData.placeId || db.collection('users').doc().id;
      const placeRef = db
        .collection('users').doc(userId)
        .collection('placeTargets').doc(placeId);

      await placeRef.set({
        name: placeData.name || '',
        naverPlaceUrl: placeData.naverPlaceUrl || '',
        address: placeData.address || null,
        memo: placeData.memo || null,
        isActive: placeData.isActive !== undefined ? placeData.isActive : true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      return { 
        success: true, 
        placeId 
      };

    } catch (error) {
      console.error('placeTarget 저장 오류:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  /**
   * 키워드 정보 저장/업데이트
   */
  async saveKeyword(userId, placeId, keywordData) {
    if (!initialized) {
      console.warn('Firebase가 초기화되지 않음. keyword 저장 스킵');
      return { success: true, skipped: true };
    }

    try {
      const db = getFirestore();
      const keywordId = keywordData.keywordId || db.collection('users').doc().id;
      const keywordRef = db
        .collection('users').doc(userId)
        .collection('placeTargets').doc(placeId)
        .collection('keywords').doc(keywordId);

      await keywordRef.set({
        keyword: keywordData.keyword || '',
        isMain: keywordData.isMain || false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      return { 
        success: true, 
        keywordId 
      };

    } catch (error) {
      console.error('keyword 저장 오류:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }
}

module.exports = new RankHistoryService();
