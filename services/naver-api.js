/**
 * 네이버 검색 API 서비스
 * - 블로그 검색
 * - 쇼핑 검색
 * - 데이터랩 (트렌드 분석)
 */

const axios = require('axios');

const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID;
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;

// API 기본 설정
const naverApi = axios.create({
  headers: {
    'X-Naver-Client-Id': NAVER_CLIENT_ID,
    'X-Naver-Client-Secret': NAVER_CLIENT_SECRET,
  },
  timeout: 10000,
});

/**
 * Blog ID/LogNo 추출
 */
function extractBlogInfo(blogUrl) {
  if (!blogUrl) return null;
  
  // https://blog.naver.com/blogId/logNo
  let m = blogUrl.match(/blog\.naver\.com\/([^\/\?]+)\/(\d+)/i);
  if (m) return { blogId: m[1], logNo: m[2] };
  
  // PostView.naver?blogId=xxx&logNo=123
  m = blogUrl.match(/blogId=([^&]+).*logNo=(\d+)/i);
  if (m) return { blogId: m[1], logNo: m[2] };
  
  return null;
}

/**
 * Product ID 추출
 */
function extractProductId(productUrl) {
  if (!productUrl) return null;
  
  // smartstore.naver.com/.../products/12345
  let m = productUrl.match(/products?\/(\d+)/i);
  if (m) return m[1];
  
  // nvMid=12345
  m = productUrl.match(/nvMid=(\d+)/i);
  if (m) return m[1];
  
  // productId=12345
  m = productUrl.match(/productId=(\d+)/i);
  if (m) return m[1];
  
  return null;
}

class NaverSearchAPI {
  constructor() {
    this.checkConfig();
  }

  checkConfig() {
    if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
      console.warn('⚠️ [NaverAPI] 네이버 API 키가 설정되지 않았습니다!');
      console.warn('⚠️ [NaverAPI] .env 파일에 NAVER_CLIENT_ID, NAVER_CLIENT_SECRET를 설정하세요.');
    } else {
      console.log('✅ [NaverAPI] 네이버 API 설정 완료');
    }
  }

  // ============================================================
  // 블로그 순위 검색 (네이버 API)
  // ============================================================
  async checkBlogRank(keyword, blogUrl) {
    console.log(`\n🔍 [블로그-API] 순위 체크 시작: "${keyword}"`);
    const startTime = Date.now();

    const targetBlog = extractBlogInfo(blogUrl);
    console.log(`🎯 [블로그-API] 찾는 블로그: ${targetBlog ? `${targetBlog.blogId}/${targetBlog.logNo}` : 'N/A'}`);

    if (!targetBlog) {
      return {
        success: false,
        rank: -1,
        error: 'URL에서 Blog ID/LogNo를 추출할 수 없습니다. (형식: blog.naver.com/아이디/글번호)',
        keyword,
        blogUrl,
      };
    }

    try {
      const maxRank = 300; // 최대 검색 순위
      let rank = -1;
      let foundPost = null;
      let totalChecked = 0;
      const seen = new Set();

      // 네이버 API는 start 최대 1000, display 최대 100
      // 100개씩 3번 요청 = 300위까지
      for (let start = 1; start <= maxRank && rank === -1; start += 100) {
        const display = Math.min(100, maxRank - start + 1);
        
        console.log(`📜 [블로그-API] ${start}~${start + display - 1}위 검색 중...`);

        try {
          const response = await naverApi.get('https://openapi.naver.com/v1/search/blog', {
            params: {
              query: keyword,
              display: display,
              start: start,
              sort: 'sim', // 정확도순 (기본값)
            },
          });

          const items = response.data.items || [];
          
          for (const item of items) {
            const link = item.link || '';
            const blogInfo = extractBlogInfo(link);
            
            if (blogInfo) {
              const key = `${blogInfo.blogId}/${blogInfo.logNo}`;
              
              if (!seen.has(key)) {
                seen.add(key);
                totalChecked++;
                
                if (blogInfo.blogId === targetBlog.blogId && blogInfo.logNo === targetBlog.logNo) {
                  rank = totalChecked;
                  foundPost = {
                    blogId: blogInfo.blogId,
                    logNo: blogInfo.logNo,
                    title: item.title.replace(/<[^>]*>/g, ''), // HTML 태그 제거
                    link: item.link,
                    rank,
                  };
                  console.log(`✅ [블로그-API] 타겟 발견! 순위: ${rank}위`);
                  break;
                }
              }
            }
          }

          // 더 이상 결과가 없으면 종료
          if (items.length < display) {
            console.log(`📊 [블로그-API] 검색 결과 끝 (총 ${totalChecked}개)`);
            break;
          }

        } catch (apiError) {
          console.error(`⚠️ [블로그-API] API 요청 실패:`, apiError.message);
          if (apiError.response) {
            console.error('응답 상태:', apiError.response.status);
            console.error('응답 데이터:', apiError.response.data);
          }
        }

        // API 요청 간 딜레이 (Rate Limit 방지)
        await new Promise(r => setTimeout(r, 100));
      }

      const duration = Date.now() - startTime;
      console.log(`📊 [블로그-API] 최종: ${totalChecked}개 검색됨`);
      console.log(`⏱️ [블로그-API] 소요시간: ${duration}ms\n`);

      return {
        success: true,
        rank,
        keyword,
        blogUrl,
        method: '네이버 검색 API',
        totalResults: totalChecked,
        foundPost,
        checkedAt: new Date().toISOString(),
      };

    } catch (error) {
      console.error('❌ [블로그-API] 오류:', error);
      return {
        success: false,
        rank: -1,
        error: error.message,
        keyword,
        blogUrl,
      };
    }
  }

  // ============================================================
  // 쇼핑 순위 검색 (네이버 API)
  // ============================================================
  async checkShoppingRank(keyword, productUrl) {
    console.log(`\n🔍 [쇼핑-API] 순위 체크 시작: "${keyword}"`);
    const startTime = Date.now();

    const targetProductId = extractProductId(productUrl);
    console.log(`🎯 [쇼핑-API] 찾는 상품 ID: ${targetProductId}`);

    if (!targetProductId) {
      return {
        success: false,
        rank: -1,
        error: 'URL에서 Product ID를 추출할 수 없습니다.',
        keyword,
        productUrl,
      };
    }

    try {
      const maxRank = 300;
      let rank = -1;
      let foundProduct = null;
      let totalChecked = 0;
      const seen = new Set();

      // 100개씩 3번 = 300위까지
      for (let start = 1; start <= maxRank && rank === -1; start += 100) {
        const display = Math.min(100, maxRank - start + 1);
        
        console.log(`📜 [쇼핑-API] ${start}~${start + display - 1}위 검색 중...`);

        try {
          const response = await naverApi.get('https://openapi.naver.com/v1/search/shop', {
            params: {
              query: keyword,
              display: display,
              start: start,
              sort: 'sim', // 정확도순
            },
          });

          const items = response.data.items || [];
          
          for (const item of items) {
            const productId = item.productId || extractProductId(item.link);
            
            if (productId && !seen.has(productId)) {
              seen.add(productId);
              totalChecked++;
              
              if (productId === targetProductId) {
                rank = totalChecked;
                foundProduct = {
                  productId,
                  title: item.title.replace(/<[^>]*>/g, ''),
                  link: item.link,
                  price: item.lprice,
                  mallName: item.mallName,
                  rank,
                };
                console.log(`✅ [쇼핑-API] 타겟 발견! 순위: ${rank}위 - ${item.mallName}`);
                break;
              }
            }
          }

          if (items.length < display) {
            console.log(`📊 [쇼핑-API] 검색 결과 끝 (총 ${totalChecked}개)`);
            break;
          }

        } catch (apiError) {
          console.error(`⚠️ [쇼핑-API] API 요청 실패:`, apiError.message);
          if (apiError.response) {
            console.error('응답 상태:', apiError.response.status);
          }
        }

        await new Promise(r => setTimeout(r, 100));
      }

      const duration = Date.now() - startTime;
      console.log(`📊 [쇼핑-API] 최종: ${totalChecked}개 검색됨`);
      console.log(`⏱️ [쇼핑-API] 소요시간: ${duration}ms\n`);

      return {
        success: true,
        rank,
        keyword,
        productUrl,
        method: '네이버 검색 API',
        totalResults: totalChecked,
        foundProduct,
        checkedAt: new Date().toISOString(),
      };

    } catch (error) {
      console.error('❌ [쇼핑-API] 오류:', error);
      return {
        success: false,
        rank: -1,
        error: error.message,
        keyword,
        productUrl,
      };
    }
  }

  // ============================================================
  // 데이터랩 트렌드 분석 (검색량 추이)
  // ============================================================
  async getSearchTrend(keywords, startDate, endDate, timeUnit = 'week') {
    console.log(`\n📊 [트렌드-API] 검색량 분석 시작`);
    console.log(`📅 기간: ${startDate} ~ ${endDate}`);
    console.log(`🔑 키워드: ${keywords.join(', ')}`);

    try {
      // 키워드 그룹 형식으로 변환
      const keywordGroups = keywords.map(kw => ({
        groupName: kw,
        keywords: [kw],
      }));

      const response = await axios.post(
        'https://openapi.naver.com/v1/datalab/search',
        {
          startDate,
          endDate,
          timeUnit, // date, week, month
          keywordGroups,
        },
        {
          headers: {
            'X-Naver-Client-Id': NAVER_CLIENT_ID,
            'X-Naver-Client-Secret': NAVER_CLIENT_SECRET,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log(`✅ [트렌드-API] 데이터 수신 완료`);

      return {
        success: true,
        data: response.data.results,
        startDate,
        endDate,
        timeUnit,
        checkedAt: new Date().toISOString(),
      };

    } catch (error) {
      console.error('❌ [트렌드-API] 오류:', error.message);
      if (error.response) {
        console.error('응답:', error.response.data);
      }
      return {
        success: false,
        error: error.message,
        keywords,
      };
    }
  }

  // ============================================================
  // 키워드 검색량 비교 (상대값)
  // ============================================================
  async compareKeywords(keywords) {
    // 최근 30일 기준
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    return this.getSearchTrend(keywords, startDate, endDate, 'date');
  }
}

// 싱글톤 인스턴스
const naverSearchAPI = new NaverSearchAPI();

module.exports = naverSearchAPI;
