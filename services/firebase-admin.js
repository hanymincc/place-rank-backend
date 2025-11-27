const admin = require('firebase-admin');

let firebaseApp = null;
let db = null;
let initialized = false;

/**
 * Firebase Admin 초기화
 */
function initializeFirebase() {
  if (firebaseApp) {
    return firebaseApp;
  }

  try {
    let serviceAccount;

    // 방법 1: 개별 환경 변수 + Base64 인코딩된 Private Key
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY_BASE64 && process.env.FIREBASE_CLIENT_EMAIL) {
      console.log('📝 Base64 인코딩된 개별 환경 변수로 Firebase 설정 중...');
      
      // Base64 디코딩
      const privateKeyDecoded = Buffer.from(process.env.FIREBASE_PRIVATE_KEY_BASE64, 'base64').toString('utf-8');
      
      serviceAccount = {
        type: "service_account",
        project_id: process.env.FIREBASE_PROJECT_ID,
        private_key: privateKeyDecoded,
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        client_id: process.env.FIREBASE_CLIENT_ID || "",
        auth_uri: "https://accounts.google.com/o/oauth2/auth",
        token_uri: "https://oauth2.googleapis.com/token",
        auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs"
      };
    }
    // 방법 2: 개별 환경 변수 (일반 Private Key)
    else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
      console.log('📝 개별 환경 변수로 Firebase 설정 중...');
      
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
    }
    // 방법 3: JSON 문자열로 받기
    else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      console.log('📝 JSON 문자열로 Firebase 설정 중...');
      
      try {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        
        if (serviceAccount.private_key) {
          serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
        }
      } catch (parseError) {
        console.error('❌ FIREBASE_SERVICE_ACCOUNT JSON 파싱 실패:', parseError.message);
        throw parseError;
      }
    } else {
      throw new Error('Firebase 환경 변수가 설정되지 않았습니다.');
    }

    // Firebase Admin 초기화
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });

    // Firestore 참조 설정
    db = admin.firestore();
    initialized = true;

    console.log('✅ Firebase Admin 초기화 성공');
    return firebaseApp;
  } catch (error) {
    console.error('❌ Firebase Admin 초기화 오류:', error);
    // Firebase 없이도 서버는 계속 실행되도록 함
    initialized = false;
    db = null;
    return null;
  }
}

/**
 * Firestore 인스턴스 반환
 */
function getFirestore() {
  if (!db) {
    throw new Error('Firebase가 초기화되지 않았습니다.');
  }
  return db;
}

// Firebase 초기화
initializeFirebase();

module.exports = { 
  admin, 
  db, 
  getFirestore, 
  initialized, 
  initializeFirebase 
};
