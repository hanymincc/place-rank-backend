const admin = require('firebase-admin');

// Firebase Admin 초기화
let initialized = false;

function initializeFirebase() {
  if (initialized) return;

  try {
    // 환경 변수에서 서비스 계정 정보 가져오기
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT 
      ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
      : null;

    if (serviceAccount) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log('✅ Firebase Admin 초기화 완료');
    } else {
      console.warn('⚠️ Firebase 서비스 계정이 설정되지 않았습니다. 포인트 차감 기능이 작동하지 않습니다.');
    }

    initialized = true;
  } catch (error) {
    console.error('Firebase Admin 초기화 오류:', error);
  }
}

initializeFirebase();

// Firestore 인스턴스
function getFirestore() {
  if (!initialized || !admin.apps.length) {
    throw new Error('Firebase가 초기화되지 않았습니다.');
  }
  return admin.firestore();
}

module.exports = {
  admin,
  getFirestore,
  initialized,
};
