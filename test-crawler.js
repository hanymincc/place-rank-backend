/**
 * 크롤러 테스트 스크립트
 * 실행: node test-crawler.js
 */

const crawler = require('./services/crawler-fixed');

// 테스트할 데이터
const testCases = {
  place: {
    keyword: '강남 맛집',
    url: 'https://m.place.naver.com/restaurant/1614953667/home',
  },
  blog: {
    keyword: '맛집 리뷰',
    url: 'https://blog.naver.com/example/123456789',  // 실제 URL로 변경 필요
  },
  shopping: {
    keyword: '무선 이어폰',
    url: 'https://smartstore.naver.com/store/products/12345',  // 실제 URL로 변경 필요
  },
};

async function runTest(type) {
  console.log('\n' + '='.repeat(60));
  console.log(`🧪 ${type.toUpperCase()} 테스트 시작`);
  console.log('='.repeat(60));

  const testData = testCases[type];
  let result;

  try {
    switch (type) {
      case 'place':
        result = await crawler.checkPlaceRank(testData.keyword, testData.url);
        break;
      case 'blog':
        result = await crawler.checkBlogRank(testData.keyword, testData.url);
        break;
      case 'shopping':
        result = await crawler.checkShoppingRank(testData.keyword, testData.url);
        break;
    }

    console.log('\n📋 결과:');
    console.log(JSON.stringify(result, null, 2));
    
    if (result.success) {
      if (result.rank > 0) {
        console.log(`\n✅ 성공! 순위: ${result.rank}위`);
      } else {
        console.log(`\n⚠️ 성공하였으나 300위 안에 없음`);
      }
    } else {
      console.log(`\n❌ 실패: ${result.error}`);
    }
  } catch (error) {
    console.error(`\n❌ 테스트 오류:`, error);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const type = args[0] || 'all';

  console.log('🚀 크롤러 테스트 시작');
  console.log('📅', new Date().toLocaleString('ko-KR'));
  
  if (type === 'all') {
    // 모든 타입 테스트
    await runTest('place');
    await runTest('blog');
    await runTest('shopping');
  } else if (['place', 'blog', 'shopping'].includes(type)) {
    await runTest(type);
  } else {
    console.log('❓ 사용법: node test-crawler.js [place|blog|shopping|all]');
  }

  // 브라우저 종료
  await crawler.close();
  console.log('\n✅ 테스트 완료!');
  process.exit(0);
}

main().catch(error => {
  console.error('테스트 실행 오류:', error);
  process.exit(1);
});
