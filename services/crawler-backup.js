const puppeteer = require('puppeteer');
const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Place ID 추출 (모바일 + PC 링크 모두 지원)
 */
function extractPlaceId(placeUrl) {
  if (!placeUrl) return null;
  // 모바일: https://m.place.naver.com/restaurant/1614953667/home
  // PC: https://map.naver.com/p/entry/place/1614953667?...
  const m = placeUrl.match(/\/(?:restaurant|place|entry\/place)\/(\d+)/i);
  return m ? m[1] : null;
}

/**
 * Blog ID/LogNo 추출
 */
function extractBlogInfo(blogUrl) {
  if (!blogUrl) return null;
  // https://blog.naver.com/blogId/logNo
  // https://m.blog.naver.com/blogId/logNo
  const m = blogUrl.match(/blog\.naver\.com\/([^\/]+)\/(\d+)/i);
  if (m) return { blogId: m[1], logNo: m[2] };
  return null;
}

/**
 * Shopping Product ID 추출
 */
function extractProductId(productUrl) {
  if (!productUrl) return null;
  // https://smartstore.naver.com/xxx/products/12345
  // https://search.shopping.naver.com/product/12345
  const m = productUrl.match(/products?\/(\d+)/i);
  return m ? m[1] : null;
}

class NaverCrawler {
  constructor() {
    this.browser = null;
  }

  async init() {
    if (!this.browser) {
      console.log('🚀 [Crawler] 브라우저 시작...');
      this.browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu',
          '--window-size=390,844',
          // headless 감지 회피
          '--disable-blink-features=AutomationControlled',
          '--disable-features=IsolateOrigins,site-per-process',
        ]
      });
      console.log('✅ [Crawler] 브라우저 시작 완료!');
    }
    return this.browser;
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  // ============================================================
  // 플레이스 순위 체크 (모바일 + 스크롤 300위까지)
  // ============================================================
  async checkPlaceRank(keyword, placeUrl) {
    console.log(`\n🔍 [플레이스] 순위 체크 시작: "${keyword}"`);
    const startTime = Date.now();

    const targetPlaceId = extractPlaceId(placeUrl);
    console.log(`🎯 [플레이스] 찾는 업체 ID: ${targetPlaceId}, URL: ${placeUrl}`);

    if (!targetPlaceId) {
      return {
        success: false,
        rank: -1,
        error: 'URL에서 Place ID를 추출할 수 없습니다.',
        keyword,
        placeUrl,
      };
    }

    try {
      const browser = await this.init();
      const page = await browser.newPage();

      // 모바일 설정
      await page.setViewport({ width: 390, height: 844 });
      await page.setUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) ' +
        'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
      );

      // headless 감지 회피 (중요!)
      await page.evaluateOnNewDocument(() => {
        // webdriver 속성 제거
        Object.defineProperty(navigator, 'webdriver', {
          get: () => false,
        });
        // plugins 추가
        Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5],
        });
        // languages 설정
        Object.defineProperty(navigator, 'languages', {
          get: () => ['ko-KR', 'ko', 'en-US', 'en'],
        });
      });

      // 위치 설정 (강남역)
      await page.setGeolocation({
        latitude: 37.498095,
        longitude: 127.027610
      });

      // 모바일 네이버 지도 검색 (올바른 URL!)
      const searchUrl = `https://m.map.naver.com/search?query=${encodeURIComponent(keyword)}`;
      console.log(`📍 [플레이스] URL: ${searchUrl}`);

      await page.goto(searchUrl, { waitUntil: 'networkidle0', timeout: 30000 });

      // SPA 로딩 대기 (JavaScript 렌더링 완료까지)
      console.log('⏳ [플레이스] SPA 렌더링 대기 중... (최대 15초)');
      
      let selectorFound = false;
      let retryCount = 0;
      const maxRetries = 15; // 15초까지 대기

      while (!selectorFound && retryCount < maxRetries) {
        try {
          await page.waitForSelector('a[href*="/restaurant/"], a[href*="/place/"]', {
            timeout: 1000, // 1초씩 체크
          });
          selectorFound = true;
          console.log(`✅ [플레이스] 결과 셀렉터 발견! (${retryCount + 1}초 후)`);
        } catch (e) {
          retryCount++;
          if (retryCount % 5 === 0) {
            console.log(`⏳ [플레이스] 아직 로딩 중... (${retryCount}초 경과)`);
          }
        }
      }

      if (!selectorFound) {
        // 셀렉터를 못 찾으면 debug 정보 출력
        const debug = await page.evaluate(() => ({
          url: location.href,
          title: document.title,
          textSample: document.body.innerText.slice(0, 500),
          htmlSample: document.body.innerHTML.slice(0, 2000),
        }));
        console.log('⚠️ [플레이스] 15초 후에도 결과 셀렉터가 안 보임!');
        console.log('🔍 DEBUG URL:', debug.url);
        console.log('🔍 DEBUG Title:', debug.title);
        console.log('🔍 DEBUG Text (500자):', debug.textSample);
        
        // HTML 파일로 저장 (디버깅용)
        const fs = require('fs');
        fs.writeFileSync('./debug-place.html', debug.htmlSample, 'utf8');
        console.log('💾 [플레이스] debug-place.html 저장됨');

        await page.close();
        return {
          success: false,
          rank: -1,
          error: '플레이스 리스트가 로딩되지 않았습니다. (SPA 렌더링 실패)',
          debug: {
            url: debug.url,
            title: debug.title,
            textSample: debug.textSample.slice(0, 200),
          },
          keyword,
          placeUrl,
        };
      }

      await page.waitForTimeout(2000); // 추가 안정화 대기

      // 스크롤 + 파싱 반복 (300위까지)
      const maxRank = 300;
      let rank = -1;
      let foundPlace = null;
      let scrollCount = 0;
      const maxScrolls = 40;
      const seen = new Set();
      let allPlaces = [];

      console.log(`📜 [플레이스] 스크롤 시작 - 최대 ${maxRank}위까지 검색...`);

      while (rank === -1 && scrollCount < maxScrolls) {
        // 현재 화면에서 아이템 파싱 (개선된 셀렉터)
        const items = await page.evaluate(() => {
          const arr = [];
          
          // 모바일 리스트 래퍼를 기준으로 잡기
          const listRoots = document.querySelectorAll('[class*="PlaceList"], [class*="place_list"], [class*="list"], main, section, #_list_scroll');
          
          // 래퍼가 없으면 전체 body에서 찾기
          const searchRoots = listRoots.length > 0 ? listRoots : [document.body];

          searchRoots.forEach(root => {
            // a 태그에서 직접 찾기
            const links = root.querySelectorAll('a[href*="/restaurant/"], a[href*="/place/"]');
            
            links.forEach(link => {
              try {
                const href = link.getAttribute('href') || '';
                
                // 이미 처리한 href인지 확인 (중복 방지)
                const m = href.match(/\/(?:restaurant|place)\/(\d+)/i);
                const placeId = m ? m[1] : null;
                if (!placeId) return;

                // 이름 찾기 (여러 방법 시도)
                let name = '';
                const nameEl = 
                  link.querySelector('[class*="name"], [class*="title"], strong, span') ||
                  link.closest('li')?.querySelector('[class*="name"], [class*="title"], strong') ||
                  link;
                
                if (nameEl) {
                  name = nameEl.textContent.trim();
                  // 너무 긴 텍스트는 첫 줄만
                  if (name.length > 50) {
                    name = name.split('\n')[0].trim();
                  }
                }

                if (!name || name.length < 2) return;

                arr.push({ placeId, name, href });
              } catch (e) {}
            });
          });

          // 중복 제거
          const unique = [];
          const seenIds = new Set();
          arr.forEach(item => {
            if (!seenIds.has(item.placeId)) {
              seenIds.add(item.placeId);
              unique.push(item);
            }
          });

          return unique;
        });

        // 중복 제거 + 순위 누적
        for (const it of items) {
          const key = it.placeId;
          if (!seen.has(key)) {
            seen.add(key);
            const currentRank = allPlaces.length + 1;
            it.rank = currentRank;
            allPlaces.push(it);

            // 타겟 찾기
            if (it.placeId === targetPlaceId && rank === -1) {
              rank = currentRank;
              foundPlace = it;
              console.log(`✅ [플레이스] 타겟 발견! 순위: ${rank}위 - ${it.name}`);
            }
          }
        }

        // 10번마다 로그
        if (scrollCount % 10 === 0) {
          console.log(`📜 [플레이스] ${scrollCount + 1}번 스크롤 - 현재 ${allPlaces.length}개 로드됨`);
        }

        // 찾았거나 300위 넘으면 종료
        if (rank !== -1 || allPlaces.length >= maxRank) break;

        // 스크롤 다운
        await page.evaluate(() => {
          window.scrollBy(0, window.innerHeight * 2);
        });
        await page.waitForTimeout(1500);
        scrollCount++;
      }

      // 최종 결과
      console.log(`\n📊 [플레이스] 최종: ${allPlaces.length}개 검색됨`);
      
      if (allPlaces.length > 0) {
        console.log('🎯 상위 5개:');
        allPlaces.slice(0, 5).forEach(p => {
          console.log(`  ${p.rank}. ${p.name} (ID: ${p.placeId})`);
        });
      }

      if (rank === -1) {
        console.log(`❌ [플레이스] 타겟 ID ${targetPlaceId}를 ${allPlaces.length}개 중에서 찾지 못했습니다`);
      }

      await page.close();

      const duration = Date.now() - startTime;
      console.log(`⏱️ [플레이스] 소요시간: ${duration}ms\n`);

      return {
        success: true,
        rank,
        keyword,
        placeUrl,
        method: '모바일 플레이스 스크롤',
        totalResults: allPlaces.length,
        foundPlace,
        checkedAt: new Date().toISOString(),
      };

    } catch (error) {
      console.error('❌ [플레이스] 크롤링 실패:', error);
      return {
        success: false,
        rank: -1,
        error: error.message,
        keyword,
        placeUrl,
      };
    }
  }

  // ============================================================
  // 블로그 순위 체크 (axios + cheerio - Puppeteer 없이!)
  // ============================================================
  async checkBlogRank(keyword, blogUrl) {
    console.log(`\n🔍 [블로그] 순위 체크 시작: "${keyword}"`);
    const startTime = Date.now();

    const targetBlog = extractBlogInfo(blogUrl);
    console.log(`🎯 [블로그] 찾는 블로그: ${targetBlog ? `${targetBlog.blogId}/${targetBlog.logNo}` : 'N/A'}, URL: ${blogUrl}`);

    if (!targetBlog) {
      return {
        success: false,
        rank: -1,
        error: 'URL에서 Blog ID/LogNo를 추출할 수 없습니다.',
        keyword,
        blogUrl,
      };
    }

    try {
      const maxRank = 300;
      let rank = -1;
      let foundPost = null;
      let totalChecked = 0;

      // 네이버 블로그 검색은 start=1,11,21,31... (10개씩)
      for (let start = 1; start <= maxRank && rank === -1; start += 10) {
        const searchUrl = `https://search.naver.com/search.naver?where=blog&query=${encodeURIComponent(keyword)}&start=${start}`;
        
        if (start === 1 || start % 50 === 1) {
          console.log(`📜 [블로그] ${start}~${start + 9}위 검색 중...`);
        }

        try {
          const response = await axios.get(searchUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept-Language': 'ko-KR,ko;q=0.9',
            },
            timeout: 10000,
          });

          const $ = cheerio.load(response.data);
          
          // 블로그 검색 결과 파싱
          $('.api_txt_lines, .title_link, .sh_blog_title').each((idx, el) => {
            const href = $(el).attr('href') || '';
            const title = $(el).text().trim();
            
            // blog.naver.com/blogId/logNo 패턴 찾기
            const blogMatch = href.match(/blog\.naver\.com\/([^\/\?]+)\/(\d+)/i);
            if (blogMatch) {
              totalChecked++;
              const blogId = blogMatch[1];
              const logNo = blogMatch[2];
              const currentRank = start + idx;

              if (blogId === targetBlog.blogId && logNo === targetBlog.logNo) {
                rank = currentRank;
                foundPost = { blogId, logNo, title, rank: currentRank };
                console.log(`✅ [블로그] 타겟 발견! 순위: ${rank}위 - ${title}`);
              }
            }
          });

        } catch (e) {
          console.log(`⚠️ [블로그] ${start}위 페이지 요청 실패:`, e.message);
        }

        // 요청 간 딜레이 (네이버 차단 방지)
        await new Promise(r => setTimeout(r, 300));
      }

      const duration = Date.now() - startTime;
      console.log(`📊 [블로그] 최종: ${totalChecked}개 검색됨`);
      console.log(`⏱️ [블로그] 소요시간: ${duration}ms\n`);

      return {
        success: true,
        rank,
        keyword,
        blogUrl,
        method: 'HTTP 파싱',
        totalResults: totalChecked,
        foundPost,
        checkedAt: new Date().toISOString(),
      };

    } catch (error) {
      console.error('❌ [블로그] 크롤링 실패:', error);
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
  // 쇼핑 순위 체크 (axios + cheerio - Puppeteer 없이!)
  // ============================================================
  async checkShoppingRank(keyword, productUrl) {
    console.log(`\n🔍 [쇼핑] 순위 체크 시작: "${keyword}"`);
    const startTime = Date.now();

    const targetProductId = extractProductId(productUrl);
    console.log(`🎯 [쇼핑] 찾는 상품 ID: ${targetProductId}, URL: ${productUrl}`);

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

      // 네이버 쇼핑 검색 (pagingIndex=1,2,3...)
      for (let pageIdx = 1; pageIdx <= Math.ceil(maxRank / 40) && rank === -1; pageIdx++) {
        const searchUrl = `https://search.shopping.naver.com/search/all?query=${encodeURIComponent(keyword)}&pagingIndex=${pageIdx}&pagingSize=40`;
        
        if (pageIdx === 1 || pageIdx % 3 === 0) {
          console.log(`📜 [쇼핑] 페이지 ${pageIdx} 검색 중...`);
        }

        try {
          const response = await axios.get(searchUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept-Language': 'ko-KR,ko;q=0.9',
            },
            timeout: 10000,
          });

          const $ = cheerio.load(response.data);
          
          // 쇼핑 검색 결과 파싱
          $('a[href*="products/"], a[href*="product/"]').each((idx, el) => {
            const href = $(el).attr('href') || '';
            const title = $(el).text().trim();
            
            const productMatch = href.match(/products?\/(\d+)/i);
            if (productMatch) {
              totalChecked++;
              const productId = productMatch[1];
              const currentRank = (pageIdx - 1) * 40 + idx + 1;

              if (productId === targetProductId) {
                rank = currentRank;
                foundProduct = { productId, title, rank: currentRank };
                console.log(`✅ [쇼핑] 타겟 발견! 순위: ${rank}위 - ${title}`);
              }
            }
          });

        } catch (e) {
          console.log(`⚠️ [쇼핑] 페이지 ${pageIdx} 요청 실패:`, e.message);
        }

        // 요청 간 딜레이
        await new Promise(r => setTimeout(r, 300));
      }

      const duration = Date.now() - startTime;
      console.log(`📊 [쇼핑] 최종: ${totalChecked}개 검색됨`);
      console.log(`⏱️ [쇼핑] 소요시간: ${duration}ms\n`);

      return {
        success: true,
        rank,
        keyword,
        productUrl,
        method: 'HTTP 파싱',
        totalResults: totalChecked,
        foundProduct,
        checkedAt: new Date().toISOString(),
      };

    } catch (error) {
      console.error('❌ [쇼핑] 크롤링 실패:', error);
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
  // 대표 키워드 추출 (플레이스 페이지에서)
  // ============================================================
  async getMainKeyword(placeUrl) {
    console.log(`\n🔍 [대표키워드] 추출 시작: ${placeUrl}`);
    const startTime = Date.now();

    try {
      const browser = await this.init();
      const page = await browser.newPage();

      await page.setViewport({ width: 390, height: 844 });
      await page.setUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'
      );

      await page.goto(placeUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      await page.waitForTimeout(2000);

      const keywords = await page.evaluate(() => {
        const result = [];
        // 키워드 영역 찾기
        const keywordEls = document.querySelectorAll('[class*="keyword"], [class*="tag"], .chip, .tag');
        keywordEls.forEach(el => {
          const text = el.textContent.trim();
          if (text && text.length > 1 && text.length < 20) {
            result.push(text);
          }
        });
        return result;
      });

      await page.close();

      const duration = Date.now() - startTime;
      console.log(`📊 [대표키워드] 발견: ${keywords.length}개`);
      console.log(`⏱️ [대표키워드] 소요시간: ${duration}ms\n`);

      return {
        success: true,
        keywords,
        placeUrl,
        checkedAt: new Date().toISOString(),
      };

    } catch (error) {
      console.error('❌ [대표키워드] 추출 실패:', error);
      return {
        success: false,
        keywords: [],
        error: error.message,
        placeUrl,
      };
    }
  }
}

// 싱글톤 인스턴스
const crawler = new NaverCrawler();

module.exports = crawler;
