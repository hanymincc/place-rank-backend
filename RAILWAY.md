# Railway 환경 변수 설정 가이드

Railway Dashboard → Variables 탭에서 아래 변수들을 설정하세요

## 필수 환경 변수

### 1. PORT
```
PORT=3001
```

### 2. NODE_ENV
```
NODE_ENV=production
```

### 3. FIREBASE_SERVICE_ACCOUNT (중요!)

Firebase Console에서 서비스 계정 JSON 파일을 다운로드한 후:
1. JSON 파일을 텍스트 에디터로 열기
2. 전체 내용을 **한 줄로 압축** (줄바꿈 제거)
3. Railway Variables에 추가

**형식 예시:**
```
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"marketingplaza-73d38","private_key_id":"abc123...","private_key":"-----BEGIN PRIVATE KEY-----\n...","client_email":"firebase-adminsdk-xxxxx@marketingplaza-73d38.iam.gserviceaccount.com","client_id":"123456789","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"https://www.googleapis.com/robot/v1/metadata/x509/..."}
```

## Firebase 서비스 계정 생성 방법

1. Firebase Console 접속: https://console.firebase.google.com/
2. 프로젝트 선택: marketingplaza-73d38
3. 프로젝트 설정 (⚙️) → 서비스 계정
4. "새 비공개 키 생성" 클릭
5. JSON 파일 다운로드
6. 위의 방법대로 Railway에 추가

## 배포 후 확인

배포 완료 후:
1. Settings → Networking → 도메인 복사
2. 프론트엔드 .env.local에서 NEXT_PUBLIC_BACKEND_URL 업데이트
3. Vercel 환경 변수에서 NEXT_PUBLIC_BACKEND_URL 업데이트

**테스트:**
```bash
curl https://your-railway-app.up.railway.app/health
```

응답:
```json
{"status":"ok","timestamp":"..."}
```
