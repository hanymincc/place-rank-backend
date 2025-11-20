const admin = require('firebase-admin');

let firebaseApp = null;

/**
 * Firebase Admin 초기화
 */
function initializeFirebase() {
  if (firebaseApp) {
    return firebaseApp;
  }

  try {
    let serviceAccount;

    // 방법 1: JSON 문자열로 받기 (기존 방식)
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      try {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        
        // Private key의 \n 처리
        if (serviceAccount.private_key) {
          serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
        }
      } catch (parseError) {
        console.error('❌ FIREBASE_SERVICE_ACCOUNT JSON 파싱 실패:', parseError.message);
        throw parseError;
      }
    } 
    // 방법 2: 개별 환경 변수로 받기 (대안)
    else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
      console.log('📝 개별 환경 변수로 Firebase 설정 중...');
      
      // Private key 처리: 실제 줄바꿈으로 변환
      let privateKey = process.env.FIREBASE_PRIVATE_KEY;
      
      // \\n을 실제 줄바꿈으로 변환
      if (privateKey.includes('\\n')) {
        privateKey = privateKey.replace(/\\n/g, '\n');
      }
      
      serviceAccount = {
        type: "service_account",
        project_id: process.env.FIREBASE_PROJECT_ID,
        private_key: privateKey,
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        client_id: process.env.FIREBASE_CLIENT_ID || "",
        auth_uri: "https://accounts.google.com/o/oauth2/auth",
        token_uri: "https://oauth2.googleapis.com/token",
        auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs"
      };
    } else {
      throw new Error('Firebase 환경 변수가 설정되지 않았습니다.');
    }

    // Firebase Admin 초기화
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });

    console.log('✅ Firebase Admin 초기화 성공');
    return firebaseApp;
  } catch (error) {
    console.error('Firebase Admin 초기화 오류:', error);
    // Firebase 없이도 서버는 계속 실행되도록 함
    return null;
  }
}

// Firebase 초기화
initializeFirebase();

// Firestore 참조
const db = firebaseApp ? admin.firestore() : null;

module.exports = { admin, db, initializeFirebase };
