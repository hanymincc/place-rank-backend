# 마케팅장터 백엔드 API 🚀

플레이스/블로그/쇼핑 순위 조회 백엔드 서버

---

## 📋 기능

### ✅ 구현된 API

#### 1️⃣ 플레이스 순위 조회
- `POST /api/place/check-rank` - 플레이스 순위 체크 (100P)
- `POST /api/place/check-rank-once` - 1회 순위 체크 (50P)
- `POST /api/place/main-keyword` - 대표 키워드 조회 (50P)
- `POST /api/place/compare-rank` - 순위 비교 분석

#### 2️⃣ 블로그 순위 조회
- `POST /api/blog/check-rank` - 블로그 순위 체크 (80P)
- `POST /api/blog/analyze-keyword` - 키워드 분석

#### 3️⃣ 쇼핑 순위 조회
- `POST /api/shopping/check-rank` - 쇼핑 순위 체크 (100P)
- `POST /api/shopping/check-rank-once` - 1회 순위 체크 (50P)

#### 4️⃣ 키워드 검색량
- `POST /api/keyword/search-volume` - 검색량 조회 (30P)
- `POST /api/keyword/trend` - 트렌드 분석 (30P)

---

## 🛠️ 기술 스택

- **Node.js** + Express
- **Puppeteer** - 웹 크롤링
- **Firebase Admin SDK** - 포인트 차감
- **Railway** - 배포 플랫폼

---

## 🚀 Railway 배포 가이드 (클릭 몇 번으로 완료!)

### 1단계: GitHub에 코드 푸시

```bash
cd place-rank-backend
git init
git add .
git commit -m "Initial commit: Backend API"
git remote add origin https://github.com/YOUR_USERNAME/place-rank-backend.git
git push -u origin main
```

### 2단계: Railway 프로젝트 생성

1. **Railway 접속**
   - https://railway.app/ 방문
   - GitHub 계정으로 로그인

2. **New Project 클릭**
   - "Deploy from GitHub repo" 선택
   - 방금 푸시한 저장소 선택

3. **자동 감지 확인**
   - Railway가 자동으로 Node.js 프로젝트 감지
   - `railway.json` 설정 자동 적용

### 3단계: 환경 변수 설정

Railway 대시보드에서 **Variables** 탭 클릭:

```env
PORT=3001
NODE_ENV=production
```

#### Firebase 서비스 계정 설정 (포인트 차감 기능)

1. **Firebase Console 접속**
   - https://console.firebase.google.com/
   - 프로젝트 선택

2. **서비스 계정 키 생성**
   - 프로젝트 설정 ⚙️ → 서비스 계정
   - "새 비공개 키 생성" 클릭
   - JSON 파일 다운로드

3. **Railway에 환경 변수 추가**
   ```
   FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"...전체 JSON 내용..."}
   ```
   ⚠️ **주의**: JSON 전체를 한 줄로 압축하여 붙여넣기!

#### 네이버 API 설정 (선택사항)

```env
NAVER_CLIENT_ID=your_client_id
NAVER_CLIENT_SECRET=your_client_secret
```

### 4단계: 배포 완료! ✨

- Railway가 자동으로 빌드 및 배포
- 약 2-3분 후 완료
- **배포 URL** 자동 생성 (예: `https://your-app.up.railway.app`)

### 5단계: API 테스트

```bash
# Health check
curl https://your-app.up.railway.app/health

# 플레이스 순위 체크 테스트
curl -X POST https://your-app.up.railway.app/api/place/check-rank \
  -H "Content-Type: application/json" \
  -d '{
    "keyword": "강남 맛집",
    "placeUrl": "https://m.place.naver.com/place/1234567890"
  }'
```

---

## 💻 로컬 개발

### 설치

```bash
npm install
```

### 환경 변수 설정

```bash
cp .env.example .env
# .env 파일 편집
```

### 실행

```bash
# 개발 모드 (nodemon)
npm run dev

# 프로덕션 모드
npm start
```

### 테스트

```bash
# Health check
curl http://localhost:3001/health

# 플레이스 순위 체크
curl -X POST http://localhost:3001/api/place/check-rank \
  -H "Content-Type: application/json" \
  -d '{
    "keyword": "강남 맛집",
    "placeUrl": "https://m.place.naver.com/place/1234567890",
    "userId": "test-user-id"
  }'
```

---

## 📡 API 사용 예시

### 플레이스 순위 체크

```javascript
const response = await fetch('https://your-app.up.railway.app/api/place/check-rank', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    keyword: '강남 맛집',
    placeUrl: 'https://m.place.naver.com/place/1234567890',
    userId: 'user-firebase-uid', // 포인트 차감용
  }),
});

const data = await response.json();
console.log(data);
// {
//   success: true,
//   rank: 3,
//   keyword: '강남 맛집',
//   placeUrl: '...',
//   totalResults: 50,
//   pointsDeducted: 100,
//   checkedAt: '2025-11-19T...'
// }
```

### 블로그 순위 체크

```javascript
const response = await fetch('https://your-app.up.railway.app/api/blog/check-rank', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    keyword: 'Next.js 튜토리얼',
    blogUrl: 'https://blog.naver.com/username/123456',
    userId: 'user-firebase-uid',
  }),
});

const data = await response.json();
```

### 쇼핑 순위 체크

```javascript
const response = await fetch('https://your-app.up.railway.app/api/shopping/check-rank', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    keyword: '노트북',
    productUrl: 'https://shopping.naver.com/products/12345',
    userId: 'user-firebase-uid',
  }),
});

const data = await response.json();
```

### 키워드 검색량 조회

```javascript
const response = await fetch('https://your-app.up.railway.app/api/keyword/search-volume', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    keyword: '마케팅 자동화',
    userId: 'user-firebase-uid',
  }),
});

const data = await response.json();
// {
//   success: true,
//   keyword: '마케팅 자동화',
//   searchVolume: {
//     monthly: 15000,
//     competition: '중간',
//     trend: '상승'
//   },
//   pointsDeducted: 30
// }
```

---

## 🔧 프론트엔드 연동

### Next.js API Route 수정

`marketing-jangter/app/api/place-rank/check/route.js`:

```javascript
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { keyword, placeUrl, userId } = await request.json();

    // Railway 백엔드 호출
    const response = await fetch(process.env.BACKEND_URL + '/api/place/check-rank', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ keyword, placeUrl, userId }),
    });

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('순위 체크 오류:', error);
    return NextResponse.json(
      { success: false, message: '순위 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
```

### Vercel 환경 변수 추가

```env
BACKEND_URL=https://your-app.up.railway.app
```

---

## 💰 포인트 비용

| 기능 | 비용 |
|------|------|
| 플레이스 순위 체크 | 100P |
| 플레이스 1회 체크 | 50P |
| 대표 키워드 조회 | 50P |
| 블로그 순위 체크 | 80P |
| 쇼핑 순위 체크 | 100P |
| 쇼핑 1회 체크 | 50P |
| 키워드 검색량 | 30P |

비용 수정: `services/points.js`의 `POINT_COSTS` 객체

---

## ⚠️ 주의사항

### 1. Puppeteer 메모리 사용
- Railway는 512MB 메모리 제공 (무료 플랜)
- 동시 요청이 많으면 메모리 부족 가능
- Pro 플랜 권장 (8GB 메모리)

### 2. 크롤링 속도
- 순위 체크 시간: 약 5-10초
- 여러 키워드 동시 체크 시 시간 증가

### 3. 네이버 차단 방지
- User-Agent 설정
- 요청 간 딜레이
- 과도한 요청 지양

### 4. Firebase 서비스 계정
- 반드시 환경 변수로 설정
- Git에 절대 커밋하지 말 것
- Railway에서만 설정

---

## 📊 모니터링

### Railway 대시보드

1. **Logs** - 실시간 로그 확인
2. **Metrics** - CPU/메모리 사용량
3. **Deployments** - 배포 이력

### Health Check

```bash
curl https://your-app.up.railway.app/health
```

응답:
```json
{
  "status": "ok",
  "timestamp": "2025-11-19T10:00:00.000Z",
  "service": "place-rank-backend"
}
```

---

## 🔄 업데이트 및 재배포

### 코드 수정 후

```bash
git add .
git commit -m "Update API"
git push origin main
```

Railway가 자동으로 감지하여 재배포!

---

## 🆘 문제 해결

### Q: Puppeteer가 실행되지 않아요
**A:** Railway의 Puppeteer 지원 확인. `railway.json` 설정 확인.

### Q: 메모리 부족 오류
**A:** Railway Pro 플랜으로 업그레이드 또는 동시 요청 제한.

### Q: Firebase 연결 오류
**A:** `FIREBASE_SERVICE_ACCOUNT` 환경 변수 확인. JSON 형식이 올바른지 확인.

### Q: 크롤링이 실패해요
**A:** 
- 네이버 페이지 구조 변경 가능
- `services/crawler.js`의 셀렉터 업데이트 필요
- User-Agent 확인

---

## 📈 성능 최적화

### 1. 브라우저 재사용
현재 구현: 브라우저 싱글톤 패턴
- 매번 새 브라우저를 열지 않음
- 메모리 절약

### 2. 캐싱 (미구현)
```javascript
// 같은 키워드는 5분간 캐싱
const cache = new Map();
```

### 3. Queue 시스템 (미구현)
```javascript
// Bull Queue로 요청 관리
const queue = new Bull('rank-check');
```

---

## 🎉 완료!

Railway로 백엔드가 배포되었습니다!

**다음 단계:**
1. ✅ Railway 배포
2. ✅ 배포 URL 확인
3. ✅ Vercel 환경 변수에 백엔드 URL 추가
4. ✅ 프론트엔드에서 테스트

---

## 📞 지원

문제가 발생하면:
- Railway Logs 확인
- GitHub Issues 생성
- 프론트엔드 README 참조

**마케팅장터 백엔드가 성공적으로 실행 중입니다!** 🚀
