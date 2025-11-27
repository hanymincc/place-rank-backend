# 블로그 & 쇼핑 순위 검색 수정 가이드

## 🔧 수정 내용

### 문제점
- **기존 방식**: 블로그/쇼핑 검색이 `axios + cheerio`로 구현됨
- **문제**: 네이버 검색은 **SPA(JavaScript)로 렌더링**되어 서버 응답 HTML에 실제 데이터가 없음
- **결과**: 항상 0개 검색되거나 결과가 없음

### 해결책
- **새 방식**: 블로그/쇼핑 검색도 **Puppeteer**로 변경
- JavaScript가 렌더링된 후의 DOM에서 데이터 추출
- 플레이스 검색과 동일한 방식 적용

## 📦 변경된 파일

```
backend/services/
├── crawler.js          ← 새 버전 (Puppeteer 기반)
├── crawler-backup.js   ← 기존 버전 백업
├── crawler-fixed.js    ← 새 버전 원본
└── crawler-old.js      ← 예전 버전
```

## 🧪 로컬 테스트 방법

### 1. 의존성 설치
```bash
cd backend
npm install
```

### 2. 환경변수 확인
`.env` 파일에 Firebase 설정이 되어있는지 확인:
```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-client-email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

### 3. 개별 테스트
```bash
# 플레이스만 테스트
node test-crawler.js place

# 블로그만 테스트
node test-crawler.js blog

# 쇼핑만 테스트
node test-crawler.js shopping

# 전체 테스트
node test-crawler.js all
```

### 4. 서버 실행 후 API 테스트
```bash
# 서버 실행
npm start

# 다른 터미널에서 curl 테스트
# 블로그 테스트
curl -X POST http://localhost:3001/api/blog/check-rank \
  -H "Content-Type: application/json" \
  -d '{"keyword":"맛집 리뷰","blogUrl":"https://blog.naver.com/your_blog/123456789"}'

# 쇼핑 테스트
curl -X POST http://localhost:3001/api/shopping/check-rank \
  -H "Content-Type: application/json" \
  -d '{"keyword":"무선 이어폰","productUrl":"https://smartstore.naver.com/store/products/12345"}'
```

## 📋 테스트용 URL 찾기

### 블로그 URL 찾기
1. 네이버에서 키워드 검색 (예: "맛집 리뷰")
2. VIEW 탭 클릭
3. 아무 블로그 포스트 클릭
4. URL 복사 (예: `https://blog.naver.com/blogid/123456789`)

### 쇼핑 URL 찾기
1. 네이버 쇼핑에서 키워드 검색 (예: "무선 이어폰")
2. 아무 상품 클릭
3. URL 복사 (예: `https://smartstore.naver.com/store/products/12345`)

## ⚠️ 주의사항

### Railway 배포 시
- Railway는 Puppeteer를 지원하므로 그대로 배포 가능
- 메모리 사용량이 증가할 수 있으니 모니터링 필요

### Vercel (프론트엔드)
- Vercel에서는 Puppeteer 사용 불가
- 현재 구조 유지 (프론트엔드 → 백엔드 API 호출)

### 타임아웃
- 블로그/쇼핑 300위까지 검색 시 30-60초 소요될 수 있음
- 프론트엔드 타임아웃 90초로 설정되어 있음 ✅

## 🔍 로그 확인

새 크롤러는 상세한 로그를 출력합니다:

```
🔍 [블로그] 순위 체크 시작: "맛집 리뷰"
🎯 [블로그] 찾는 블로그: blogid/123456789
📜 [블로그] 1~10위 검색 중...
📜 [블로그] 51~60위 검색 중...
✅ [블로그] 타겟 발견! 순위: 57위 - 맛집 리뷰 포스...
📊 [블로그] 최종: 57개 검색됨
⏱️ [블로그] 소요시간: 12345ms
```

## 🚀 Railway 배포

로컬 테스트 후 Railway에 배포:

```bash
# Railway CLI 사용
railway up

# 또는 GitHub 연동 시 자동 배포
git add .
git commit -m "Fix: Puppeteer-based blog/shopping search"
git push
```

## 📞 문제 해결

### "브라우저 시작 실패"
- Puppeteer가 제대로 설치되었는지 확인
- Railway에서는 nixpacks.toml 설정 확인

### "300위 안에 없음" 결과
- 실제로 해당 URL이 검색 결과에 없을 수 있음
- 다른 키워드로 테스트해보기

### "Product ID 추출 실패"
- URL 형식 확인
- 지원 형식:
  - `https://smartstore.naver.com/store/products/12345`
  - `https://search.shopping.naver.com/product/12345`
